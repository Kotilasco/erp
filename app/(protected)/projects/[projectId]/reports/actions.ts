
'use server';

import { prisma } from '@/lib/db';
import { fromMinor } from '@/helpers/money';

export type ReportData = {
    deliveries: DeliveryItem[];
    quoteLines: QuoteLineData[];
    // ... we'll expand this for other reports
};

export type DeliveryItem = {
    id: string;
    description: string;
    unit: string | null;
    qtyDelivered: number;
    qtyUsed: number;
    qtyBalance: number;
    avgRate: number;
    totalAmount: number;
    quoteLineIds: string[];
};

export type QuoteLineData = {
    id: string;
    description: string;
    unit: string | null;
    quantity: number;
    unitPrice: number;
    amount: number;
};

export async function getProjectReportData(projectId: string): Promise<ReportData> {

    // 1. Fetch Dispatches & Items
    // We want items that are "DELIVERED" (i.e. status is DISPATCHED/DELIVERED/APPROVED?) 
    // Actually, "Deliveries Report" implies items sent to site. 
    // We'll consider any dispatch that is NOT 'DRAFT'.
    const dispatches = await prisma.dispatch.findMany({
        where: { projectId, status: { not: 'DRAFT' } },
        include: {
            items: {
                include: {
                    purchase: true,
                    requisitionItem: { select: { quoteLineId: true } }
                }
            }
        }
    });

    // Aggregate Delivery Items
    const deliveryMap = new Map<string, DeliveryItem>();

    for (const d of dispatches) {
        for (const item of d.items) {
            // Group by description + unit (simple fuzzy grouping)
            // If we have a quoteLineId, we could use that as a primary grouping key?
            // For now, let's stick to description/unit but store the quoteLineId if unique/consistent
            const key = `${item.description.toLowerCase().trim()}|${item.unit?.toLowerCase().trim() ?? ''}`;

            const existing = deliveryMap.get(key);

            const qty = Number(item.qty);
            const handedOut = Math.max(0, qty - Number(item.returnedQty ?? 0)); // Net delivered to site
            const used = Number(item.usedOutQty ?? 0);
            const price = item.estPriceMinor ? fromMinor(item.estPriceMinor) : 0; // simplistic avg rate
            const quoteLineId = item.requisitionItem?.quoteLineId;

            if (existing) {
                // Weighted average rate calculation
                const totalVal = (existing.avgRate * existing.qtyDelivered) + (price * handedOut);

                existing.qtyDelivered += handedOut;
                existing.qtyUsed += used;
                existing.qtyBalance = existing.qtyDelivered - existing.qtyUsed;
                // Avoid division by zero
                existing.avgRate = existing.qtyDelivered > 0 ? totalVal / existing.qtyDelivered : 0;
                existing.totalAmount += (price * handedOut);
                if (quoteLineId && !existing.quoteLineIds.includes(quoteLineId)) {
                    existing.quoteLineIds.push(quoteLineId);
                }
            } else {
                deliveryMap.set(key, {
                    id: item.id, // reference ID
                    description: item.description,
                    unit: item.unit ?? null,
                    qtyDelivered: handedOut,
                    qtyUsed: used,
                    qtyBalance: handedOut - used,
                    avgRate: price,
                    totalAmount: price * handedOut,
                    quoteLineIds: quoteLineId ? [quoteLineId] : []
                });
            }
        }
    }


    // 2. Fetch Quote Lines
    const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { quoteId: true }
    });

    let quoteLines: QuoteLineData[] = [];

    if (project?.quoteId) {
        const lines = await prisma.quoteLine.findMany({
            where: { quoteId: project.quoteId },
            orderBy: { description: 'asc' }
        });

        quoteLines = lines.map(line => ({
            id: line.id,
            description: line.description,
            unit: line.unit ?? null,
            quantity: line.quantity,
            unitPrice: line.unitPriceMinor ? fromMinor(line.unitPriceMinor) : 0,
            amount: line.lineTotalMinor ? fromMinor(line.lineTotalMinor) : 0,
        }));
    }

    return {
        deliveries: Array.from(deliveryMap.values()).sort((a, b) => a.description.localeCompare(b.description)),
        quoteLines: quoteLines, // Populated
    };
}
