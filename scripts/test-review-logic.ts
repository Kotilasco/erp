
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Mimic the logic from actions.ts exactly
async function saveUnitPricesForRequisition(
    requisitionId: string,
    updates: Array<{ itemId: string; unitPriceMajor: number }>,
) {
    if (!updates.length) return;
    // NOTE: Auth checks removed for script

    // The simplified transaction logic from actions.ts
    await prisma.$transaction(async (tx) => {
        for (const upd of updates) {
            // Fetch current state INSIDE transaction to ensure we see the flag
            const current = await tx.procurementRequisitionItem.findUnique({
                where: { id: upd.itemId },
                select: { reviewRequested: true }
            });

            if (!current) continue;

            if (current.reviewRequested) {
                // Logic A: Update Staged
                await tx.procurementRequisitionItem.update({
                    where: { id: upd.itemId },
                    data: {
                        // @ts-ignore
                        stagedUnitPriceMinor: BigInt(Math.max(0, Math.round(upd.unitPriceMajor * 100)))
                    }
                });
            } else {
                // Logic B: Update Requested
                await tx.procurementRequisitionItem.update({
                    where: { id: upd.itemId },
                    data: {
                        requestedUnitPriceMinor: BigInt(Math.max(0, Math.round(upd.unitPriceMajor * 100)))
                    }
                });
            }
        }
    });
}

async function main() {
    console.log('Starting Review Logic Verification (Self-Contained)...');

    const project = await prisma.project.findFirst();
    if (!project) {
        console.error("No project found, skipping test.");
        return;
    }

    const req = await prisma.procurementRequisition.create({
        data: {
            projectId: project.id,
            status: 'DRAFT',
            items: {
                create: {
                    description: 'TEST_ITEM_LOGIC_' + Date.now(),
                    qty: 10,
                    qtyRequested: 10,
                    requestedUnitPriceMinor: 1000n, // 10.00
                    stagedUnitPriceMinor: 0n,
                    reviewRequested: false,
                }
            }
        },
        include: { items: true }
    });

    const item = req.items[0];
    console.log(`Created Item: ${item.id}`);

    try {
        // --- THE CORE TEST ---
        // User Workflow: 
        // 1. Sets Flag (in page.tsx this happens first)
        // 2. Saves Price (in page.tsx this happens second)

        console.log('Step A: Setting reviewRequested = true...');
        await prisma.procurementRequisitionItem.update({
            where: { id: item.id },
            data: { reviewRequested: true, reviewApproved: false }
        });

        console.log('Step B: Saving Unit Price 25.00...');
        // We execute the function which reads the DB state
        await saveUnitPricesForRequisition(req.id, [{ itemId: item.id, unitPriceMajor: 25 }]);

        // 4. Verify Results
        const reloaded = await prisma.procurementRequisitionItem.findUnique({ where: { id: item.id } });
        if (!reloaded) throw new Error('Item lost');

        console.log(`Final State: Review=${reloaded.reviewRequested}, ReqPrice=${reloaded.requestedUnitPriceMinor}, Staged=${reloaded.stagedUnitPriceMinor}`);

        if (reloaded.stagedUnitPriceMinor === 2500n) {
            console.log('SUCCESS: Staged Price updated correctly.');
        } else {
            console.error('FAILURE: Staged Price is ' + reloaded.stagedUnitPriceMinor);
            if (reloaded.requestedUnitPriceMinor === 2500n) {
                console.error('CRITICAL FAILURE: Price was saved to REQUESTED field, meaning it ignored the flag.');
            }
        }

        if (reloaded.requestedUnitPriceMinor === 1000n) {
            console.log('SUCCESS: Requested Price preserved.');
        }

    } finally {
        await prisma.procurementRequisitionItem.delete({ where: { id: item.id } });
        await prisma.procurementRequisition.delete({ where: { id: req.id } });
        await prisma.$disconnect();
    }
}

main();
