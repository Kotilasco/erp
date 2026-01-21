
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    try {
        console.log('--- Checking for River sand item ---');
        const items = await prisma.procurementRequisitionItem.findMany({
            where: {
                description: { contains: 'River sand' }
            }
        });

        if (items.length > 0) {
            console.log(`Found ${items.length} items.`);
            console.log(`Found ${items.length} items. Updating first one...`);
            const item = items[0];
            await prisma.procurementRequisitionItem.update({
                where: { id: item.id },
                data: { reviewRejectionReason: "FORCED_DEBUG_REASON" }
            });
            console.log("Update executed.");

            const updated = await prisma.procurementRequisitionItem.findUnique({ where: { id: item.id } });
            console.log("Read back:", updated?.reviewRejectionReason);
        } else {
            console.log('Item not found via description search');
        }

    } catch (error) {
        console.error("Error:", error);
    }
}

main()
    .catch((e) => {
        console.error("DETAILS:", e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
