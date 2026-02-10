
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const rules = await prisma.formulaRule.findMany({
        orderBy: { code: 'asc' }
    });

    console.log("--- DB Formula Rules ---");
    for (const r of rules) {
        console.log(`[${r.code}]: ${r.expression}`);
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
