
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Mocking logic from actions.ts/page.tsx to simulate the flow without imports
async function simulatePreFundingFlow(reqId: string, itemId: string, stagedPriceMajor: number) {
    // 1. Set Flag
    await prisma.procurementRequisitionItem.update({
        where: { id: itemId },
        data: { reviewRequested: true, reviewApproved: false }
    });

    // 2. Save Price (Simulating saveUnitPricesForRequisition logic)
    await prisma.procurementRequisitionItem.update({
        where: { id: itemId },
        data: {
            // @ts-ignore
            stagedUnitPriceMinor: BigInt(Math.round(stagedPriceMajor * 100))
        }
    });

    // 3. Send In-Place (Simulating sendRequisitionForReviewInPlace)
    const pendingItems = await prisma.procurementRequisitionItem.findMany({
        where: { requisitionId: reqId, reviewRequested: true },
        select: { id: true, stagedUnitPriceMinor: true } // @ts-ignore
    });

    // Validate
    const invalid = pendingItems.find((it: any) => (it.stagedUnitPriceMinor ?? 0n) <= 0n);
    if (invalid) throw new Error('Validation Failed: Staged Price is 0');

    await prisma.procurementRequisition.update({
        where: { id: reqId },
        data: { reviewSubmittedAt: new Date() }
    });
}

async function simulatePostFundingFlow(reqId: string, itemId: string, stagedPriceMajor: number, projectId: string) {
    // 1. Set Flag & 2. Save Price (Same as above)
    await prisma.procurementRequisitionItem.update({
        where: { id: itemId },
        data: {
            reviewRequested: true,
            reviewApproved: false,
            // @ts-ignore
            stagedUnitPriceMinor: BigInt(Math.round(stagedPriceMajor * 100))
        }
    });

    // 3. Send Split (Simulating sendRequisitionForReview)
    // Find items to move
    const itemsToMove = await prisma.procurementRequisitionItem.findMany({
        where: { requisitionId: reqId, reviewRequested: true }
    });

    if (itemsToMove.length === 0) return;

    // Create New Req
    const newReq = await prisma.procurementRequisition.create({
        data: {
            projectId,
            status: 'SUBMITTED',
            note: 'Review Split',
            items: { create: [] }
        }
    });

    // Move Items
    for (const item of itemsToMove) {
        await prisma.procurementRequisitionItem.create({
            data: {
                requisitionId: newReq.id,
                description: item.description,
                unit: item.unit,
                qty: item.qty,
                qtyRequested: item.qtyRequested,
                // THE CRITICAL LOGIC: Transfer Staged to Requested
                // @ts-ignore
                requestedUnitPriceMinor: item.stagedUnitPriceMinor,
                quoteLineId: item.quoteLineId,
                reviewRequested: true
            }
        });

        // Close old
        await prisma.procurementRequisitionItem.update({
            where: { id: item.id },
            data: { qtyRequested: 0, reviewRequested: false }
        });
    }

    return newReq.id;
}


async function main() {
    console.log('Starting PRE/POST Funding Verification...');

    const project = await prisma.project.findFirst();
    if (!project) throw new Error('No project found');

    try {
        // --- TEST 1: PRE-FUNDING (IN-PLACE) ---
        console.log('Testing Pre-Funding (In-Place)...');
        const reqPre = await prisma.procurementRequisition.create({
            data: {
                projectId: project.id, status: 'SUBMITTED',
                items: { create: { description: 'Item_Pre', qty: 10, qtyRequested: 10, requestedUnitPriceMinor: 1000n, stagedUnitPriceMinor: 0n } }
            }, include: { items: true }
        });
        const itemPre = reqPre.items[0];

        await simulatePreFundingFlow(reqPre.id, itemPre.id, 25.00);

        const reloadedPre = await prisma.procurementRequisitionItem.findUnique({ where: { id: itemPre.id } });
        const reloadedReqPre = await prisma.procurementRequisition.findUnique({ where: { id: reqPre.id } });

        if (reloadedPre?.stagedUnitPriceMinor === 2500n && reloadedPre?.requestedUnitPriceMinor === 1000n) {
            console.log('SUCCESS [Pre-Funding]: Staged Price updated, Original Price preserved.');
        } else {
            console.error(`FAILURE [Pre-Funding]: Staged=${reloadedPre?.stagedUnitPriceMinor}, Req=${reloadedPre?.requestedUnitPriceMinor}`);
        }
        if (reloadedReqPre?.reviewSubmittedAt) {
            console.log('SUCCESS [Pre-Funding]: Requisition marked as submitted.');
        } else {
            console.error('FAILURE [Pre-Funding]: Requisition not marked submitted.');
        }


        // --- TEST 2: POST-FUNDING (SPLIT) ---
        console.log('\nTesting Post-Funding (Split)...');
        const reqPost = await prisma.procurementRequisition.create({
            data: {
                projectId: project.id, status: 'APPROVED',
                items: { create: { description: 'Item_Post', qty: 10, qtyRequested: 10, requestedUnitPriceMinor: 1000n, stagedUnitPriceMinor: 0n } }
            }, include: { items: true }
        });
        const itemPost = reqPost.items[0];

        const newReqId = await simulatePostFundingFlow(reqPost.id, itemPost.id, 50.00, project.id);

        if (!newReqId) throw new Error('New Req not created');

        const newReq = await prisma.procurementRequisition.findUnique({ where: { id: newReqId }, include: { items: true } });
        const newItem = newReq?.items[0];
        const oldItem = await prisma.procurementRequisitionItem.findUnique({ where: { id: itemPost.id } });

        if (newItem?.requestedUnitPriceMinor === 5000n) {
            console.log('SUCCESS [Post-Funding]: New item created with correct price (50.00 transferred from Staged).');
        } else {
            console.error(`FAILURE [Post-Funding]: New item price is ${newItem?.requestedUnitPriceMinor}`);
        }

        if (oldItem?.qtyRequested === 0 && oldItem?.reviewRequested === false) {
            console.log('SUCCESS [Post-Funding]: Old item cleared.');
        } else {
            console.error(`FAILURE [Post-Funding]: Old item not cleared (Qty=${oldItem?.qtyRequested}, Review=${oldItem?.reviewRequested})`);
        }

    } catch (e) {
        console.error(e);
    } finally {
        // Cleanup would go here, but omitted for brevity in script
        console.log('Done.');
        await prisma.$disconnect();
    }
}

main();
