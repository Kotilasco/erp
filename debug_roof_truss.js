
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Enhance JSON.stringify to handle BigInt
BigInt.prototype.toJSON = function () { return this.toString() }

async function main() {
    try {
        const items = await prisma.procurementRequisitionItem.findMany({
            where: {
                description: 'Roof truss'
            },
            include: {
                quoteLine: true,
                requisition: { select: { id: true, status: true } }
            }
        });

        console.log(`Found ${items.length} items for "Roof truss". Details:`);
        items.forEach(item => {
            console.log(`Item ID: ${item.id} | Req: ${item.requisitionId} (${item.requisition.status})`);
            console.log(`  Qty: ${item.qty} | Requested: ${item.qtyRequested}`);
            console.log(`  ReviewRequested: ${item.reviewRequested}`);
            console.log(`  RequestedPriceMinor: ${item.requestedUnitPriceMinor}`);
            console.log(`  AmountMinor: ${item.amountMinor}`);
            console.log(`  QuoteLine ID: ${item.quoteLineId}`);
            console.log(`  EstPriceMinor: ${item.estPriceMinor}`);
            if (item.quoteLine) {
                console.log(`  QuoteLine UnitPrice: ${item.quoteLine.unitPriceMinor}`);
            } else {
                console.log(`  NO QuoteLine`);
            }
            console.log('---');
        });

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
