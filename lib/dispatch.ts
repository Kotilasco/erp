import { prisma } from '@/lib/db';

/**
 * remainingDispatchQty: (VerifiedGRNs + FinalizedPurchases) - sum(dispatchedQty)
 * We must filter by projectId to ensure isolation and project-wide visibility.
 */
export async function getRemainingDispatchMap(projectId: string, excludeDispatchId?: string) {
  // 1. Get quantities from Verified Goods Received Notes for this PROJECT
  const verifiedGrnItems = await prisma.goodsReceivedNoteItem.findMany({
    where: {
      grn: {
        status: 'VERIFIED',
        purchaseOrder: { projectId }
      },
      poItem: { requisitionItemId: { not: null } }
    },
    include: {
      poItem: { select: { requisitionItemId: true } }
    }
  });

  // 2. Get quantities from explicit Purchase records (excluding PO placeholders)
  const explicitPurchases = await prisma.purchase.findMany({
    where: {
      requisition: { projectId },
      requisitionItemId: { not: null },
      purchaseOrderId: null // Only non-PO purchases, as PO items are handled by GRN
    }
  });

  // 3. Get already dispatched quantities for this PROJECT
  const dispatches = await prisma.dispatchItem.groupBy({
    by: ['requisitionItemId'],
    where: {
      requisitionItemId: { not: null },
      dispatch: {
        projectId,
        id: excludeDispatchId ? { not: excludeDispatchId } : undefined
      },
    },
    _sum: { qty: true } as any,
  });

  const availableByItem = new Map<string, number>();

  // Add from Verified GRNs
  verifiedGrnItems.forEach((vgi) => {
    const rid = vgi.poItem?.requisitionItemId;
    if (rid) {
      const current = availableByItem.get(rid) ?? 0;
      availableByItem.set(rid, current + Number(vgi.qtyAccepted));
    }
  });

  // Add from Explicit Purchases
  explicitPurchases.forEach((p) => {
    const rid = p.requisitionItemId!;
    const current = availableByItem.get(rid) ?? 0;
    availableByItem.set(rid, current + Number(p.qty));
  });

  const dispatchedByItem = new Map<string, number>();
  dispatches.forEach((d: any) => {
    if (d.requisitionItemId) {
      dispatchedByItem.set(d.requisitionItemId, Number(d._sum.qty ?? 0));
    }
  });

  const remaining = new Map<string, number>();
  for (const [rid, available] of availableByItem.entries()) {
    const already = dispatchedByItem.get(rid) ?? 0;
    remaining.set(rid, Math.max(0, available - already));
  }
  return remaining;
}

