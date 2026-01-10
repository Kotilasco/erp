
import { prisma } from './lib/db';

async function main() {
    console.log('--- Debugging Dispatches ---');
    const dispatches = await prisma.dispatch.findMany({
        orderBy: { createdAt: 'desc' },
        select: {
            id: true,
            status: true,
            securitySignedAt: true,
            driverSignedAt: true,
            createdAt: true
        },
        take: 10
    });

    console.log('Recent Dispatches:');
    console.table(dispatches);

    const approvedCount = await prisma.dispatch.count({
        where: {
            status: 'APPROVED',
            securitySignedAt: null
        }
    });

    console.log('Count of (APPROVED + Unsigned):', approvedCount);
    console.log('----------------------------');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
