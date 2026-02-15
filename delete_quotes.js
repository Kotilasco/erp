
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        console.log('Deleting all quotations and related data...');

        // Delete in reverse order of dependency

        // 1. Negotiation Items (depend on Negotiation & QuoteLine)
        await prisma.quoteNegotiationItem.deleteMany({});

        // 2. Negotiations (depend on Quote & Versions)
        await prisma.quoteNegotiation.deleteMany({});

        // 3. Extra Requests (depend on QuoteLine)
        await prisma.quoteLineExtraRequest.deleteMany({});

        // 4. Quote Lines (depend on Quote & Product & Version) 
        // Note: Version also depends on AddedLines, so this is circular?
        // QuoteLine has `addedInVersionId`. QuoteVersion has `addedLines` relation.
        // QuoteLine also has `negotiationItems` (deleted above).
        // Let's delete QuoteLines first. 
        await prisma.quoteLine.deleteMany({});

        // 5. Quote Versions (depend on Quote)
        await prisma.quoteVersion.deleteMany({});

        // ProjectTasks might reference Quote (id: 198)
        await prisma.projectTask.deleteMany({ where: { quoteId: { not: null } } });

        // 6. Finally Quotes
        const { count } = await prisma.quote.deleteMany({});
        console.log(`Deleted ${count} quotations.`);

    } catch (e) {
        console.error('Error deleting quotations:', e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
