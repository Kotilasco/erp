'use server';

import { prisma } from '@/lib/db';

export async function checkEmployeeAvailability(
    employeeIds: string[],
    startDate: string, // ISO Date string YYYY-MM-DD
    endDate: string,   // ISO Date string YYYY-MM-DD
    excludeProjectId?: string,
    excludeScheduleItemId?: string
) {
    if (!employeeIds.length) return { busy: [] };

    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        throw new Error('Invalid date range');
    }

    // Find any schedule items that overlap with the requested range
    // AND have any of the requested employees assigned
    // AND are not the item we are currently editing

    // Overlap logic: (StartA <= EndB) and (EndA >= StartB)
    // The user mentioned a 1-day buffer for cross-project tasks.
    // "task ends 1 day before... or starts 1 day after"
    // This implies we should treat the busy period as [Start - 1 day, End + 1 day] effectively?
    // Or just ensure strict non-overlap?
    // "tasks dont overlap but its already sorted since we are calculating..." -> This is for same project.
    // For cross-project: "another project can be able to assign... if that task ends 1 day before... or starts 1 day after"
    // This means if Task A is Jan 5 - Jan 10.
    // Task B can start Jan 12 (1 day gap: Jan 11).
    // Task B cannot start Jan 11.
    console.log(`[CHECK_AVAILABILITY] Requested: ${start.toISOString()} to ${end.toISOString()} (ExcludeProject: ${excludeProjectId})`);

    // Conflict logic with 1-day buffer for cross-project:
    // User: "another project can assign if task ends 1 day before or starts 1 day after"
    // Conflict if (ExistingEnd >= RequestedStart - 1 day) AND (ExistingStart <= RequestedEnd + 1 day)
    const bufferMs = 24 * 60 * 60 * 1000;
    const startWithBuffer = new Date(start.getTime() - bufferMs);
    const endWithBuffer = new Date(end.getTime() + bufferMs);

    const conflicts = await prisma.scheduleItem.findMany({
        where: {
            id: excludeScheduleItemId ? { not: excludeScheduleItemId } : undefined,
            schedule: excludeProjectId ? {
                projectId: { not: excludeProjectId }
            } : undefined,
            assignees: {
                some: { id: { in: employeeIds } },
            },
            AND: [
                {
                    plannedEnd: {
                        gte: startWithBuffer,
                    },
                },
                {
                    plannedStart: {
                        lte: endWithBuffer,
                    },
                },
            ],
            status: { not: 'DONE' },
        },
        select: {
            id: true,
            plannedStart: true,
            plannedEnd: true,
            assignees: {
                where: { id: { in: employeeIds } },
                select: { id: true, givenName: true, surname: true },
            },
            schedule: {
                select: {
                    projectId: true,
                    project: {
                        select: { name: true, projectNumber: true },
                    },
                },
            },
        },
    });

    if (conflicts.length > 0) {
        console.log(`[CHECK_AVAILABILITY] Found ${conflicts.length} cross-project conflicts.`);
    }

    const busyEmployeeIds = new Set<string>();
    const details: Record<string, any> = {};

    for (const c of conflicts) {
        for (const a of c.assignees) {
            busyEmployeeIds.add(a.id);
            details[a.id] = {
                conflictProject: c.schedule.project.name || c.schedule.project.projectNumber,
                conflictStart: c.plannedStart,
                conflictEnd: c.plannedEnd,
            };
        }
    }

    return { busy: Array.from(busyEmployeeIds), details };
}
export async function batchCheckConflicts(
    projectId: string,
    items: {
        id?: string | null;
        employeeIds: string[];
        plannedStart: string;
        plannedEnd: string;
    }[]
) {
    const conflictIds = new Set<string>();
    const details: Record<string, string> = {};

    // 1. Collect all employees and the global date range for this batch
    const allEmployeeIds = Array.from(new Set(items.flatMap(it => it.employeeIds)));
    if (!allEmployeeIds.length) return { conflictIds: [], details: {} };

    const validItems = items.filter(it => it.plannedStart && it.plannedEnd && it.employeeIds.length > 0);
    if (!validItems.length) return { conflictIds: [], details: {} };

    // Find min start and max end for the whole batch to narrow down DB search
    const minStartLong = Math.min(...validItems.map(it => new Date(it.plannedStart).getTime()));
    const maxEndLong = Math.max(...validItems.map(it => new Date(it.plannedEnd).getTime()));

    const bufferMs = 24 * 60 * 60 * 1000;
    const searchStart = new Date(minStartLong - bufferMs);
    const searchEnd = new Date(maxEndLong + bufferMs);

    // 2. Query ALL external conflicts for these employees within the window in ONE hit
    const externalItems = await prisma.scheduleItem.findMany({
        where: {
            schedule: {
                projectId: { not: projectId }
            },
            assignees: {
                some: { id: { in: allEmployeeIds } },
            },
            AND: [
                {
                    plannedEnd: {
                        gte: searchStart,
                    },
                },
                {
                    plannedStart: {
                        lte: searchEnd,
                    },
                },
            ],
            status: { not: 'DONE' },
        },
        select: {
            id: true,
            plannedStart: true,
            plannedEnd: true,
            assignees: {
                select: { id: true, givenName: true, surname: true },
            },
            schedule: {
                select: {
                    project: {
                        select: { name: true, projectNumber: true },
                    },
                },
            },
        },
    });

    // 3. Perform overlap checks in-memory (O(N*M) where N is items, M is found externalItems)
    for (const item of validItems) {
        const itemStart = new Date(item.plannedStart);
        itemStart.setHours(0, 0, 0, 0);
        const itemEnd = new Date(item.plannedEnd);
        itemEnd.setHours(23, 59, 59, 999);

        // Required overlap range with 1-day buffer
        const overlapStart = new Date(itemStart.getTime() - bufferMs);
        const overlapEnd = new Date(itemEnd.getTime() + bufferMs);

        const rowId = item.id || `temp-${items.indexOf(item)}`;

        for (const ext of externalItems) {
            // Check dates first
            const extStart = new Date(ext.plannedStart!);
            const extEnd = new Date(ext.plannedEnd!);

            if (extEnd >= overlapStart && extStart <= overlapEnd) {
                // Check if any employee matches
                const conflictEmp = ext.assignees.find(a => item.employeeIds.includes(a.id));
                if (conflictEmp) {
                    conflictIds.add(rowId);
                    const projName = ext.schedule.project.name || ext.schedule.project.projectNumber;
                    details[rowId] = `${projName} (${extStart.toLocaleDateString()} - ${extEnd.toLocaleDateString()})`;
                    break; // Move to next item
                }
            }
        }
    }

    const finalHasConflict = conflictIds.size > 0;

    // 4. Optionally persist the status to the Schedule model
    await prisma.schedule.update({
        where: { projectId },
        data: { hasConflict: finalHasConflict }
    }).catch(err => console.error('[BATCH_CONFLICT] Failed to update schedule status', err));

    return {
        conflictIds: Array.from(conflictIds),
        details,
    };
}
