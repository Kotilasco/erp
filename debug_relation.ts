
import { prisma } from './lib/db';

async function main() {
    try {
        console.log("Testing Project -> Schedule relation query...");
        // Try to query using the 'schedules' field exactly as in the code
        const project = await prisma.project.findFirst({
            where: {
                schedules: {
                    status: 'ACTIVE'
                }
            },
            select: { id: true, name: true }
        });
        console.log("Query Successful. Found:", project);
    } catch (e) {
        console.error("Query Failed!");
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
