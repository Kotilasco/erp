const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkDueReports() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    console.log(`Checking reports for: ${today.toISOString()} to ${tomorrow.toISOString()}`);

    const allProjects = await prisma.project.findMany({
        include: {
            schedules: {
                include: {
                    items: {
                        include: {
                            reports: {
                                where: {
                                    reportedForDate: {
                                        gte: today,
                                        lt: tomorrow
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    });

    console.log(`Total Projects: ${allProjects.length}`);

    allProjects.forEach(p => {
        console.log(`\nProject: ${p.id} (Status: ${p.status})`);
        if (!p.schedules) {
            console.log(`  - No schedule found.`);
            return;
        }
        console.log(`  - Schedule Status: ${p.schedules.status}`);
        const activeItems = p.schedules.items.filter(i => i.status === 'ACTIVE');
        console.log(`  - Active Items: ${activeItems.length}`);

        activeItems.forEach(i => {
            const planned = new Date(i.plannedStart);
            const isDue = planned <= new Date();
            const hasReport = i.reports.length > 0;
            console.log(`    * Item: "${i.title}" (Planned: ${planned.toISOString()}, Due: ${isDue}, Has Report Today: ${hasReport})`);
        });
    });
}

checkDueReports()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
