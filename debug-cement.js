
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const items = await prisma.procurementRequisitionItem.findMany({
        where: {
            requisitionId: 'cmkhxksyq004cunw0vktdl71a',
            description: { contains: 'Cement' }
        },
        select: {
            id: true,
            description: true,
            qty: true,
            amountMinor: true,
            requestedUnitPriceMinor: true,
            reviewRequested: true,
            reviewApproved: true,
            quoteLine: {
                select: {
                    unitPriceMinor: true
                }
            }
        }
    });

    console.log(JSON.stringify(items, (key, value) =>
        typeof value === 'bigint' ? value.toString() : value
        , 2));
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
