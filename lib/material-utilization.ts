import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';

export type UtilizationItem = {
    id: string;
    description: string;
    unit: string | null;
    dispatchedQty: number;
    returnedQty: number;
    usedQty: number;
    pendingOnSite: number;

    // Context
    projectName: string;
    projectId: string;
    dispatchDate: Date;

    // Stock vs Purchase
    type: 'STOCK' | 'PURCHASE';
    sourceRef?: string; // Vendor Name or 'Warehouse'
};

export type UtilizationSummary = {
    totalDispatchedItems: number;
    totalReturnedItems: number;
    totalUsedItems: number;
    stockItemsCount: number;
    purchaseItemsCount: number;
};

export async function getMaterialUtilization(where: Prisma.ProjectWhereInput): Promise<{ summary: UtilizationSummary; items: UtilizationItem[] }> {
    const projects = await prisma.project.findMany({
        where,
        include: {
            quote: {
                select: { customer: { select: { displayName: true } } }
            },
            dispatches: {
                where: { status: { in: ['DISPATCHED', 'RECEIVED', 'PARTIAL'] } }, // Only active dispatches
                include: {
                    items: {
                        include: {
                            purchase: true,
                            inventoryItem: true
                        }
                    }
                }
            }
        }
    });

    const items: UtilizationItem[] = [];
    let summary: UtilizationSummary = {
        totalDispatchedItems: 0,
        totalReturnedItems: 0,
        totalUsedItems: 0,
        stockItemsCount: 0,
        purchaseItemsCount: 0
    };

    for (const p of projects) {
        const projectName = (p.quote as any)?.customer?.displayName || p.name;

        for (const d of p.dispatches) {
            for (const item of d.items) {
                const dispatched = item.qty || 0;
                // Currently handing out logic might differ, but assuming qty on DispatchItem is what was meant to be sent.
                // If you track `handedOutQty` separately, use that. Let's stick to `qty` for now as the main record.

                const returned = item.returnedQty || 0;
                const used = item.usedOutQty || 0;
                const pending = dispatched - returned - used;

                const isStock = !!item.inventoryItemId;
                const type = isStock ? 'STOCK' : 'PURCHASE';
                const sourceRef = isStock ? 'Warehouse' : (item.purchase?.vendor || 'Vendor');

                items.push({
                    id: item.id,
                    description: item.description,
                    unit: item.unit,
                    dispatchedQty: dispatched,
                    returnedQty: returned,
                    usedQty: used,
                    pendingOnSite: pending,
                    projectName,
                    projectId: p.id,
                    dispatchDate: d.createdAt,
                    type,
                    sourceRef
                });

                // Update Summary
                summary.totalDispatchedItems += dispatched;
                summary.totalReturnedItems += returned;
                summary.totalUsedItems += used;
                if (isStock) summary.stockItemsCount++;
                else summary.purchaseItemsCount++;
            }
        }
    }

    return { summary, items };
}
