
import { prisma } from './lib/db';

async function main() {
    try {
        console.log("Testing Project Query...");
        const projects = await prisma.project.findMany({
            where: {
                OR: [
                    // Test each part of the OR clause independently to isolate the issue

                    // 1. CreatedBy - likely fine
                    // { createdById: 'test-id' },

                    // 2. ProjectMember - Check field name
                    // { ProjectMember: { some: { userId: 'test-id' } } },

                    // 3. Schedule Assignees - The suspect part
                    { schedules: { items: { some: { assignees: { some: { userId: 'test-id' } } } } } }
                ]
            },
            take: 1
        });
        console.log("Query Successful", projects);
    } catch (e) {
        console.error("Query Failed:", e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
