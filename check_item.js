
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Enhance JSON.stringify to handle BigInt
BigInt.prototype.toJSON = function () { return this.toString() }

async function main() {
    try {
        const item = await prisma.procurementRequisitionItem.findFirst({
            where: { description: 'River sand' },
            include: { quoteLine: true }
        });
        console.log(JSON.stringify(item, null, 2));

        // Also check for multiple items with similar name to be sure
        const count = await prisma.procurementRequisitionItem.count({ where: { description: 'River sand' } });
        console.log(`Found ${count} items with description "River sand"`);
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
