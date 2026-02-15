const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('--- Debugging Amanda Cruz Assignments ---');

    const amanda = await prisma.employee.findFirst({
        where: {
            OR: [
                { givenName: { contains: 'Amanda' }, surname: { contains: 'Cruz' } },
                { givenName: { contains: 'Amanda Cruz' } }
            ]
        },
        include: {
            scheduleItems: {
                include: {
                    schedule: {
                        include: {
                            project: true
                        }
                    }
                }
            }
        }
    });

    if (!amanda) {
        console.log('Amanda Cruz not found in database.');
        return;
    }

    console.log(`Found Employee: ${amanda.givenName} ${amanda.surname} (ID: ${amanda.id})`);
    console.log(`Assigned to ${amanda.scheduleItems.length} schedule items.`);

    for (const item of amanda.scheduleItems) {
        console.log(`- Task: ${item.title}`);
        console.log(`  Project: ${item.schedule.project.name} (${item.schedule.project.id})`);
        console.log(`  Planned: ${item.plannedStart?.toISOString()} to ${item.plannedEnd?.toISOString()}`);
        console.log(`  Status: ${item.status}`);
        console.log('---');
    }

    console.log('\n--- Checking for potential overlaps with a test range (e.g., today) ---');
    const testStart = new Date();
    testStart.setHours(0, 0, 0, 0);
    const testEnd = new Date();
    testEnd.setHours(23, 59, 59, 999);

    console.log(`Test Range: ${testStart.toISOString()} to ${testEnd.toISOString()}`);

    const conflicts = await prisma.scheduleItem.findMany({
        where: {
            assignees: {
                some: { id: amanda.id }
            },
            AND: [
                { plannedEnd: { gte: testStart } },
                { plannedStart: { lte: testEnd } }
            ]
        }
    });

    console.log(`Found ${conflicts.length} overlaps in DB query.`);
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
