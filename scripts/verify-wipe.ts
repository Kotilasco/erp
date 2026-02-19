
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const projects = await prisma.project.count();
    const quotes = await prisma.quote.count();

    console.log(`Projects count: ${projects}`);
    console.log(`Quotes count: ${quotes}`);

    if (projects === 0 && quotes === 0) {
        console.log('✓ Verification successful: Database is clean.');
    } else {
        console.error('❌ Verification failed: Data still exists.');
        process.exit(1);
    }
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
