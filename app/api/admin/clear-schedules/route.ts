import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
    try {
        console.log('[CLEAR_SCHEDULES] Starting global cleanup...');

        // 1. Delete all schedule task reports
        const reportDelete = await prisma.scheduleTaskReport.deleteMany({});
        console.log(`[CLEAR_SCHEDULES] Deleted ${reportDelete.count} task reports.`);

        // 2. Delete all schedule items (this will remove implicit Many-to-Many assignments too)
        const itemDelete = await prisma.scheduleItem.deleteMany({});
        console.log(`[CLEAR_SCHEDULES] Deleted ${itemDelete.count} schedule items.`);

        // 3. Delete all schedules (Draft or Active)
        const scheduleDelete = await prisma.schedule.deleteMany({});
        console.log(`[CLEAR_SCHEDULES] Deleted ${scheduleDelete.count} schedules.`);

        return NextResponse.json({
            success: true,
            message: 'All project schedules have been deleted.',
            counts: {
                reports: reportDelete.count,
                items: itemDelete.count,
                schedules: scheduleDelete.count,
            }
        });
    } catch (error) {
        console.error('[CLEAR_SCHEDULES] Error:', error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}
