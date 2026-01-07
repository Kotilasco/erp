
import { prisma } from '@/lib/db';

export type PendingDispatchItem = {
    id: string; // Project ID
    projectNumber: string | null;
    customerName: string;
    pendingCount: number;
};

/**
 * Calculates projects that have items verified in GRN but not yet fully dispatched.
 * Using the logic from dashboard/page.tsx
 */
export async function getPendingDispatchItems(userId: string, role: string): Promise<PendingDispatchItem[]> {
    const isPM = role === 'PROJECT_OPERATIONS_OFFICER';
    // If user is PM, filter by assigned projects
    // If not PM (e.g. Admin/Security?), maybe show all?
    // Logic from dashboard: role === 'PROJECT_OPERATIONS_OFFICER' ? { assignedToId: userId } : {}
    // But strictly, let's follow the args.

    const myProjects = await prisma.project.findMany({
        where: {
            ...(isPM ? { assignedToId: userId } : {}),
            status: { not: 'COMPLETED' },
        },
        select: { id: true, projectNumber: true, quote: { select: { customer: true } } },
    });

    if (myProjects.length === 0) return [];

    const pIds = myProjects.map((p) => p.id);

    // 1. Get all Verified GRN Items for these projects (Received Stock)
    const verifiedItems = await prisma.goodsReceivedNoteItem.findMany({
        where: {
            grn: { status: 'VERIFIED', purchaseOrder: { projectId: { in: pIds } } },
        },
        select: {
            qtyAccepted: true,
            poItem: { select: { requisitionItemId: true } },
            grn: { select: { purchaseOrder: { select: { projectId: true } } } },
        },
    });

    // 2. Get all Dispatched Items (Sent Stock)
    const dispatchedItems = await prisma.dispatchItem.findMany({
        where: {
            dispatch: { projectId: { in: pIds } },
            requisitionItemId: { not: null },
        },
        select: { qty: true, requisitionItemId: true, dispatch: { select: { projectId: true } } },
    });

    // 3. Aggregate by Project -> RequisitionItem
    const projMap = new Map<string, Map<string, { verified: number; sent: number }>>();

    verifiedItems.forEach((vi) => {
        const pid = vi.grn.purchaseOrder.projectId;
        const rid = vi.poItem?.requisitionItemId;
        if (!rid) return;
        if (!projMap.has(pid)) projMap.set(pid, new Map());
        const pData = projMap.get(pid)!;
        if (!pData.has(rid)) pData.set(rid, { verified: 0, sent: 0 });
        pData.get(rid)!.verified += Number(vi.qtyAccepted);
    });

    dispatchedItems.forEach((di) => {
        const pid = di.dispatch.projectId;
        const rid = di.requisitionItemId!;
        if (!projMap.has(pid)) return;
        const pData = projMap.get(pid)!;
        if (!pData.has(rid)) pData.set(rid, { verified: 0, sent: 0 });
        pData.get(rid)!.sent += Number(di.qty);
    });

    // 4. Filter Projects with Remaining Items
    const pendingProjects: PendingDispatchItem[] = [];

    myProjects.forEach((proj) => {
        const pData = projMap.get(proj.id);
        if (!pData) return;

        let pendingCount = 0;
        for (const vals of pData.values()) {
            if (vals.verified > vals.sent) pendingCount++;
        }

        if (pendingCount > 0) {
            pendingProjects.push({
                id: proj.id,
                projectNumber: proj.projectNumber,
                customerName: proj.quote?.customer?.displayName || 'Unknown Customer',
                pendingCount,
            });
        }
    });

    return pendingProjects;
}
