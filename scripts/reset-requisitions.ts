
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Resetting Procurement Data...');

    // Deleting in order of dependency (Children first)

    // 1. Dispatch Items (refer to Requisition Items)
    console.log('Deleting Dispatch Items...');
    await prisma.dispatchItem.deleteMany({});

    // 2. Fund Disbursements (refer to Funding Requests)
    console.log('Deleting Fund Disbursements...');
    await prisma.fundDisbursement.deleteMany({});

    // 3. Funding Requests (refer to Requisitions)
    console.log('Deleting Funding Requests...');
    await prisma.fundingRequest.deleteMany({});

    // 4. Item Topups (refer to Requisition Items)
    console.log('Deleting Item Topups...');
    await prisma.requisitionItemTopup.deleteMany({});

    // 4a. Goods Received Note Items (Children of GRN)
    console.log('Deleting GRN Items...');
    await prisma.goodsReceivedNoteItem.deleteMany({});

    // 4b. Goods Received Notes (refer to Purchase Orders)
    console.log('Deleting GRNs...');
    await prisma.goodsReceivedNote.deleteMany({});

    // 5. Purchase Order Items (refer to POs & Requisition Items)
    console.log('Deleting Purchase Order Items...');
    await prisma.purchaseOrderItem.deleteMany({});

    // 6. Purchases (refer to Requisitions, Items, POs)
    console.log('Deleting Purchases...');
    await prisma.purchase.deleteMany({});

    // 7. Purchase Orders (refer to Requisitions)
    console.log('Deleting Purchase Orders...');
    await prisma.purchaseOrder.deleteMany({});

    // 8. Requisition Items (refer to Requisitions)
    console.log('Deleting Requisition Items...');
    await prisma.procurementRequisitionItem.deleteMany({});

    // 9. Requisitions (The root)
    console.log('Deleting Requisitions...');
    await prisma.procurementRequisition.deleteMany({});

    console.log('SUCCESS: All procurement data cleared.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
