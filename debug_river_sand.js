
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Enhance JSON.stringify to handle BigInt
BigInt.prototype.toJSON = function () { return this.toString() }

async function main() {
    try {
        // Look for River sand items where requestedUnitPriceMinor is 0 or null
        // AND it has a relevant requisition ID (maybe matching the one user is on)
        // We'll just list all "River sand" items with their pricing details
        const items = await prisma.procurementRequisitionItem.findMany({
            where: {
                description: 'River sand'
            },
            include: {
                quoteLine: true,
                requisition: { select: { id: true, status: true } }
            }
        });

        console.log(`Found ${items.length} items. Details:`);
        items.forEach(item => {
            console.log(`Item ID: ${item.id} | Req: ${item.requisitionId} (${item.requisition.status})`);
            console.log(`  Qty: ${item.qty} | Requested: ${item.qtyRequested}`);
            console.log(`  RequestedPriceMinor: ${item.requestedUnitPriceMinor} (TypeOf: ${typeof item.requestedUnitPriceMinor})`);
            console.log(`  AmountMinor: ${item.amountMinor}`);
            console.log(`  QuoteLine ID: ${item.quoteLineId}`);
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
