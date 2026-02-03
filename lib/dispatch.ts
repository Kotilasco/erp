import { prisma } from '@/lib/db';

/**
 * remainingDispatchQty: purchasedQty - sum(dispatchedQty)
 * If no purchases, remaining = 0
 */
export async function getRemainingDispatchMap(requisitionId: string) {
  // 1. Get quantities from explicit Purchase records
  const purchases = await prisma.purchase.groupBy({
    by: ['requisitionItemId'],
    where: { requisitionId, requisitionItemId: { not: null } },
    _sum: { qty: true } as any,
  });

  // 2. Get quantities from Verified Goods Received Notes
  // (Prisma groupBy doesn't support grouping by relation fields like poItem.requisitionItemId)
  const verifiedGrnItems = await prisma.goodsReceivedNoteItem.findMany({
    where: {
      grn: {
        status: 'VERIFIED',
        purchaseOrder: { requisitionId }
      },
      poItem: { requisitionItemId: { not: null } }
    },
    include: {
      poItem: { select: { requisitionItemId: true } }
    }
  });

  // 3. Get already dispatched quantities
  const dispatches = await prisma.dispatchItem.groupBy({
    by: ['requisitionItemId'],
    where: {
      requisitionItemId: { not: null },
      dispatch: { project: { requisitions: { some: { id: requisitionId } } } },
    },
    _sum: { qty: true } as any,
  });

  const availableByItem = new Map<string, number>();

  // Add from Purchase records
  purchases.forEach((p: any) => {
    if (p.requisitionItemId) {
      availableByItem.set(p.requisitionItemId, Number(p._sum.qty ?? 0));
    }
  });

  // Add from Verified GRNs
  verifiedGrnItems.forEach((vgi) => {
    const rid = vgi.poItem?.requisitionItemId;
    if (rid) {
      const current = availableByItem.get(rid) ?? 0;
      availableByItem.set(rid, current + Number(vgi.qtyAccepted));
    }
  });

  const dispatchedByItem = new Map<string, number>();
  dispatches.forEach((d: any) => {
    if (d.requisitionItemId) {
      dispatchedByItem.set(d.requisitionItemId, Number(d._sum.qty ?? 0));
    }
  });

  const remaining = new Map<string, number>();
  for (const [itemId, available] of availableByItem.entries()) {
    const already = dispatchedByItem.get(itemId) ?? 0;
    remaining.set(itemId, Math.max(0, available - already));
  }
  return remaining;
}

