import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';

export type PnLSummary = {
    contractValueMinor: bigint;
    planningVarianceMinor: bigint; // New: Quote vs Requisition
    negotiationVarianceMinor: bigint;
    procurementVarianceMinor: bigint;
    usageVarianceMinor: bigint;
    returnsValueMinor: bigint;
    netProfitLossMinor: bigint;
};

export type VarianceItem = {
    id: string; // quoteLineId or similar
    description: string;
    category: 'NEGOTIATION' | 'PLANNING' | 'PROCUREMENT' | 'USAGE' | 'RETURNS'; // Added PLANNING
    varianceMinor: bigint; // Positive = Profit/Savings, Negative = Loss
    details: string; // Keep for backward compatibility or simple view
    projectName?: string; // Optional context

    // New structured data for tables
    structuredDetails?: {
        estUnitPriceMinor?: bigint;
        actualUnitPriceMinor?: bigint;
        quantity?: number;
        // For Usage
        quotedQty?: number;
        usedQty?: number;
        unitPriceMinor?: bigint;
    };
};

/**
 * Core P&L Calculation Logic for a single hydrated project.
 */
function calculatePnL(project: any): { summary: PnLSummary; items: VarianceItem[] } {
    const items: VarianceItem[] = [];
    let negotiationVarianceMinor = 0n;
    let planningVarianceMinor = 0n; // New
    let procurementVarianceMinor = 0n;
    let usageVarianceMinor = 0n;
    let returnsValueMinor = 0n;

    // --- 1. Negotiation Variance ---
    const negotiation = project.quote?.negotiations?.[0];
    if (negotiation) {
        // Implementation for negotiation variance logic (currently 0 per original logic)
    }

    // --- 2. Planning Variance (Quote vs Requisition) ---
    // Did we estimate/plan differently on the Requisition than what we Quoted?
    if (project.requisitions) {
        for (const req of project.requisitions) {
            for (const item of req.items) {
                if (item.quoteLineId && project.quote?.lines) {
                    const ql = project.quote.lines.find((l: any) => l.id === item.quoteLineId);
                    if (ql) {
                        const reqQty = item.qtyRequested || item.qty || 0;
                        if (reqQty > 0) {
                            // Requisition Est Unit Price
                            // If estPriceMinor is total, derive unit. 
                            // Warning: estPriceMinor might be 0 if not set.
                            if (item.estPriceMinor > 0n) {
                                const reqUnitBig = item.estPriceMinor / BigInt(Math.max(1, Math.round(reqQty))); // Approximation
                                const quoteUnitBig = ql.unitPriceMinor;

                                const diffUnit = quoteUnitBig - reqUnitBig;
                                // Positive = Savings (Quote > Req Est)
                                // Negative = Loss (Quote < Req Est)

                                // We track the variance on the quantity REQUESTED
                                const variance = diffUnit * BigInt(Math.round(reqQty));

                                if (variance !== 0n) {
                                    planningVarianceMinor += variance;
                                    items.push({
                                        id: item.id,
                                        description: `Planning: ${item.description}`,
                                        category: 'PLANNING',
                                        varianceMinor: variance,
                                        details: `Quote: ${Number(quoteUnitBig) / 100} -> Req: ${Number(reqUnitBig) / 100}`,
                                        structuredDetails: {
                                            estUnitPriceMinor: quoteUnitBig, // "Est" is Quote here
                                            actualUnitPriceMinor: reqUnitBig, // "Act" is Requisition Est here
                                            quantity: reqQty
                                        }
                                    });
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // --- 2. Procurement Variance ---
    if (project.requisitions) {
        for (const req of project.requisitions) {
            for (const item of req.items) {
                // Ensure purchases exist
                if (item.purchases) {
                    for (const purch of item.purchases) {
                        if (purch.qty > 0) {
                            // Calculate Est Unit Price (Total Est / Total Req Qty)
                            const reqQty = item.qtyRequested || item.qty || 1;
                            let baselineTotal = item.estPriceMinor > 0n ? item.estPriceMinor : 0n;

                            // Override with Quote Line if available
                            if (item.quoteLineId && project.quote?.lines) {
                                const ql = project.quote.lines.find((l: any) => l.id === item.quoteLineId);
                                if (ql) {
                                    // Quote Line Unit Price is explicitly unit price
                                    baselineTotal = ql.unitPriceMinor * BigInt(Math.floor(reqQty));
                                }
                            }

                            const baselineUnitPrice = Number(baselineTotal) / reqQty; // derived unit price (float safe for minor units?)
                            // Using BigInt for unit price might lose precision if division not clean. 
                            // Better: Variance = (EstUnit - ActUnit) * Qty
                            // Variance = (EstTotal/ReqQty * PurchQty) - PurchTotal

                            const estCostForBatch = BigInt(Math.round(baselineUnitPrice * purch.qty));
                            const actualCostForBatch = purch.priceMinor; // Total for this purchase

                            const variance = estCostForBatch - actualCostForBatch;

                            if (variance !== 0n) {
                                procurementVarianceMinor += variance;
                                items.push({
                                    id: purch.id,
                                    description: `Procurement: ${item.description || 'Item'} (${purch.vendor})`,
                                    category: 'PROCUREMENT',
                                    varianceMinor: variance,
                                    details: `Est: ${(baselineUnitPrice / 100).toFixed(2)}, Paid: ${(Number(actualCostForBatch) / 100 / purch.qty).toFixed(2)} x ${purch.qty}`,
                                    structuredDetails: {
                                        estUnitPriceMinor: BigInt(Math.round(baselineUnitPrice)),
                                        actualUnitPriceMinor: BigInt(Math.round(Number(purch.priceMinor) / purch.qty)),
                                        quantity: purch.qty
                                    }
                                });
                            }
                        }
                    }
                }
            }
        }
    }

    // --- 3. Usage Variance ---
    if (project.quote?.lines && project.requisitions) {
        const reqsByQuoteLine = new Map<string, { qty: number; items: any[] }>();
        for (const req of project.requisitions) {
            for (const item of req.items) {
                if (item.quoteLineId) {
                    const e = reqsByQuoteLine.get(item.quoteLineId) || { qty: 0, items: [] };
                    e.qty += (item.qtyRequested || 0);
                    e.items.push(item);
                    reqsByQuoteLine.set(item.quoteLineId, e);
                }
            }
        }

        for (const line of project.quote.lines) {
            const usage = reqsByQuoteLine.get(line.id);
            if (usage) {
                if (usage.qty > line.quantity) {
                    const over = usage.qty - line.quantity;
                    const loss = BigInt(Math.round(over)) * line.unitPriceMinor * -1n;
                    usageVarianceMinor += loss;

                    items.push({
                        id: line.id,
                        description: `Over-usage: ${line.description}`,
                        category: 'USAGE',
                        varianceMinor: loss,
                        details: `Quoted: ${line.quantity}, Requested: ${usage.qty} (Total), Over: ${over}`,
                        structuredDetails: {
                            quotedQty: line.quantity,
                            usedQty: usage.qty,
                            quantity: over, // Over amount
                            unitPriceMinor: line.unitPriceMinor
                        }
                    });
                }
            }
        }
    }

    // --- 4. Returns ---
    if (project.dispatches) {
        for (const d of project.dispatches) {
            if (d.items) {
                for (const item of d.items) {
                    if ((item.returnedQty ?? 0) > 0) {
                        let price = 0n;
                        if (item.purchase) price = item.purchase.priceMinor;
                        if (price > 0n) {
                            const val = price * (BigInt(Math.round(item.returnedQty || 0)));
                            returnsValueMinor += val;
                            items.push({
                                id: item.id,
                                description: `Return: ${item.description}`,
                                category: 'RETURNS',
                                varianceMinor: val,
                                details: `Returned ${item.returnedQty} @ ${Number(price) / 100}`,
                                structuredDetails: {
                                    quantity: item.returnedQty,
                                    actualUnitPriceMinor: price
                                }
                            });
                        }
                    }
                }
            }
        }
    }

    // Revenue
    const contractValueMinor = project.quote?.lines?.reduce((acc: bigint, l: any) => acc + l.lineTotalMinor, 0n) || 0n;

    const netProfitLossMinor =
        negotiationVarianceMinor +
        planningVarianceMinor + // Include Planning
        procurementVarianceMinor +
        usageVarianceMinor +
        returnsValueMinor;

    return {
        summary: {
            contractValueMinor,
            planningVarianceMinor, // Export
            negotiationVarianceMinor,
            procurementVarianceMinor,
            usageVarianceMinor,
            returnsValueMinor,
            netProfitLossMinor
        },
        items
    };
}

const pnlQueryInclude = {
    quote: {
        include: {
            lines: true,
            negotiations: {
                where: { status: 'CLOSED_WON' },
                orderBy: { createdAt: 'desc' },
                take: 1,
                include: { originalVersion: true, proposedVersion: true }
            }
        },
    },
    requisitions: {
        where: { status: { in: ['APPROVED', 'ORDERED', 'PURCHASED', 'PARTIAL', 'RECEIVED'] } },
        include: { items: { include: { purchases: true } } },
    },
    // Include dispatches for Returns logic
    dispatches: {
        include: { items: { include: { purchase: true, inventoryItem: true } } }
    },
    // Returns via InventoryAllocation (optional per original logic, but dispatches cover it usually)
    inventoryAllocations: { where: { returnedAt: { not: null } }, include: { inventoryItem: true } },
} satisfies Prisma.ProjectInclude;


export async function getProjectPnL(projectId: string): Promise<{ summary: PnLSummary; items: VarianceItem[] }> {
    const project = await prisma.project.findUnique({
        where: { id: projectId },
        include: pnlQueryInclude
    });

    if (!project || !project.quote) {
        throw new Error('Project or Quote not found');
    }

    return calculatePnL(project);
}

/**
 * Fetches P&L for multiple projects efficiently.
 */
export async function getBulkPnL(where: Prisma.ProjectWhereInput): Promise<{ summary: PnLSummary; items: VarianceItem[] }> {
    const projects = await prisma.project.findMany({
        where,
        include: {
            ...pnlQueryInclude,
            // Also need name context for bulk
            // name is already in Project
        }
    });

    const globalSummary: PnLSummary = {
        contractValueMinor: BigInt(0),
        planningVarianceMinor: BigInt(0), // New
        negotiationVarianceMinor: BigInt(0),
        procurementVarianceMinor: BigInt(0),
        usageVarianceMinor: BigInt(0),
        returnsValueMinor: BigInt(0),
        netProfitLossMinor: BigInt(0)
    };

    let globalItems: VarianceItem[] = [];

    for (const p of projects) {
        if (!p.quote) continue; // Skip if no quote

        const res = calculatePnL(p);
        const projectName = (p.quote as any)?.customer?.displayName || p.name; // Type casting for convenience

        // Aggregate
        globalSummary.contractValueMinor += res.summary.contractValueMinor;
        globalSummary.planningVarianceMinor += res.summary.planningVarianceMinor;
        globalSummary.negotiationVarianceMinor += res.summary.negotiationVarianceMinor;
        globalSummary.procurementVarianceMinor += res.summary.procurementVarianceMinor;
        globalSummary.usageVarianceMinor += res.summary.usageVarianceMinor;
        globalSummary.returnsValueMinor += res.summary.returnsValueMinor;
        globalSummary.netProfitLossMinor += res.summary.netProfitLossMinor;

        // Tag Items
        const tagged = res.items.map(item => ({
            ...item,
            projectName: projectName,
            itemName: item.description, // Keep original description here for table, simpler
            description: item.description // Keep original
        }));
        globalItems = [...globalItems, ...tagged];
    }

    return { summary: globalSummary, items: globalItems };
}
