
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function deleteProjectData(projectId: string) {
    console.log(`Deleting dependencies for project ${projectId}...`);

    // 1. Client Payments & Payments
    await prisma.clientPayment.deleteMany({ where: { projectId } });
    await prisma.payment.deleteMany({ where: { projectId } });

    // 2. Payment Schedules & Reminders
    const paymentSchedules = await prisma.paymentSchedule.findMany({
        where: { projectId },
        select: { id: true },
    });
    if (paymentSchedules.length > 0) {
        const psIds = paymentSchedules.map((ps) => ps.id);
        await prisma.paymentReminder.deleteMany({
            where: { scheduleId: { in: psIds } },
        });
        await prisma.paymentSchedule.deleteMany({ where: { projectId } });
    }

    // 3. InventoryAllocations
    await prisma.inventoryAllocation.deleteMany({ where: { projectId } });

    // 4. Dispatches & Returns
    const dispatches = await prisma.dispatch.findMany({
        where: { projectId },
        select: { id: true },
    });
    const dispatchIds = dispatches.map((d) => d.id);

    // Handle Inventory Returns (linked to Project or Dispatch)
    const returns = await prisma.inventoryReturn.findMany({
        where: {
            OR: [
                { projectId },
                ...(dispatchIds.length > 0 ? [{ dispatchId: { in: dispatchIds } }] : [])
            ]
        },
        select: { id: true }
    });
    const returnIds = returns.map(r => r.id);

    if (returnIds.length > 0) {
        await prisma.inventoryReturnItem.deleteMany({
            where: { returnId: { in: returnIds } }
        });
        await prisma.inventoryReturn.deleteMany({
            where: { id: { in: returnIds } }
        });
    }

    if (dispatchIds.length > 0) {
        // Dispatch Items
        await prisma.dispatchItem.deleteMany({
            where: { dispatchId: { in: dispatchIds } },
        });
        await prisma.dispatch.deleteMany({ where: { projectId } });
    }

    // 5. Procurement Requisitions & POs
    const requisitions = await prisma.procurementRequisition.findMany({
        where: { projectId },
        select: { id: true },
    });
    const reqIds = requisitions.map((r) => r.id);

    const pos = await prisma.purchaseOrder.findMany({
        where: { OR: [{ projectId }, ...(reqIds.length > 0 ? [{ requisitionId: { in: reqIds } }] : [])] },
        select: { id: true },
    });
    const poIds = pos.map((p) => p.id);

    if (poIds.length > 0) {
        const grns = await prisma.goodsReceivedNote.findMany({
            where: { purchaseOrderId: { in: poIds } },
            select: { id: true }
        });
        const grnIds = grns.map(g => g.id);
        if (grnIds.length > 0) {
            await prisma.goodsReceivedNoteItem.deleteMany({
                where: { goodsReceivedNoteId: { in: grnIds } }
            });
            await prisma.goodsReceivedNote.deleteMany({
                where: { id: { in: grnIds } }
            });
        }

        await prisma.purchaseOrderItem.deleteMany({
            where: { purchaseOrderId: { in: poIds } },
        });
    }

    if (reqIds.length > 0) {
        await prisma.purchase.deleteMany({
            where: { requisitionId: { in: reqIds } },
        });
    }

    if (poIds.length > 0) {
        await prisma.purchaseOrder.deleteMany({
            where: { id: { in: poIds } },
        });
    }

    if (reqIds.length > 0) {
        const fundingRequests = await prisma.fundingRequest.findMany({
            where: { requisitionId: { in: reqIds } },
            select: { id: true }
        });
        const fundIds = fundingRequests.map(f => f.id);
        if (fundIds.length > 0) {
            await prisma.fundDisbursement.deleteMany({
                where: { fundingRequestId: { in: fundIds } }
            });
            await prisma.fundingRequest.deleteMany({
                where: { requisitionId: { in: reqIds } }
            });
        }

        const reqItems = await prisma.procurementRequisitionItem.findMany({
            where: { requisitionId: { in: reqIds } },
            select: { id: true }
        });
        const reqItemIds = reqItems.map(ri => ri.id);
        if (reqItemIds.length > 0) {
            await prisma.requisitionItemTopup.deleteMany({
                where: { requisitionItemId: { in: reqItemIds } }
            });
            // Dispatch Items might reference RequisitionItemId?
            // I already deleted DispatchItems above.
            // PO Items reference RequisitionItemId?
            // I already deleted PurchaseOrderItem above.
            // Purchases reference RequisitionItemId?
            // I already deleted Purchases above.
            await prisma.procurementRequisitionItem.deleteMany({
                where: { requisitionId: { in: reqIds } }
            });
        }

        await prisma.procurementRequisition.deleteMany({
            where: { projectId },
        });
    }

    // 6. Project Tasks & Tasks
    const projTasks = await prisma.projectTask.findMany({
        where: { projectId },
        select: { id: true },
    });
    const projTaskIds = projTasks.map(t => t.id);
    if (projTaskIds.length > 0) {
        await prisma.taskProgress.deleteMany({
            where: { projectTaskId: { in: projTaskIds } }
        });
        await prisma.taskAssignment.deleteMany({
            where: { projectTaskId: { in: projTaskIds } }
        });
        await prisma.projectTask.deleteMany({
            where: { projectId }
        });
    }

    const tasks = await prisma.task.findMany({
        where: { projectId },
        select: { id: true }
    });
    const taskIds = tasks.map(t => t.id);
    if (taskIds.length > 0) {
        await prisma.taskProgress.deleteMany({
            where: { taskId: { in: taskIds } }
        });
        await prisma.taskAssignment.deleteMany({
            where: { taskId: { in: taskIds } }
        });
        await prisma.task.deleteMany({
            where: { projectId }
        });
    }

    // 7. Schedule
    const schedules = await prisma.schedule.findMany({
        where: { projectId },
        select: { id: true }
    });
    const scheduleIds = schedules.map(s => s.id);
    if (scheduleIds.length > 0) {
        const sItems = await prisma.scheduleItem.findMany({
            where: { scheduleId: { in: scheduleIds } },
            select: { id: true }
        });
        const sItemIds = sItems.map(si => si.id);
        if (sItemIds.length > 0) {
            await prisma.scheduleTaskReport.deleteMany({
                where: { scheduleItemId: { in: sItemIds } }
            });
            await prisma.scheduleItem.deleteMany({
                where: { id: { in: sItemIds } }
            });
        }
        await prisma.schedule.deleteMany({
            where: { projectId }
        });
    }

    // 8. Other Misc
    await prisma.projectMember.deleteMany({ where: { projectId } });
    await prisma.quoteLineExtraRequest.deleteMany({ where: { projectId } });
    await prisma.projectProductivitySetting.deleteMany({ where: { projectId } });
    await prisma.stockMove.deleteMany({ where: { projectId } });

    // 9. Delete Project
    await prisma.project.delete({
        where: { id: projectId },
    });

    return true;
}

async function main() {
    try {
        const projectsToDelete = await prisma.project.findMany({
            orderBy: { createdAt: 'asc' },
            take: 5,
            select: { id: true, name: true, createdAt: true, quoteId: true },
        });

        if (projectsToDelete.length === 0) {
            console.log('No projects found to delete.');
            return;
        }

        console.log(`Found ${projectsToDelete.length} projects to delete:`);
        projectsToDelete.forEach((p) => {
            console.log(`- ID: ${p.id}, Name: ${p.name || '(No Name)'}, CreatedAt: ${p.createdAt}`);
        });

        for (const project of projectsToDelete) {
            try {
                await deleteProjectData(project.id);
                console.log(`Deleted project ${project.id}.`);
            } catch (err) {
                console.error(`Failed to delete project ${project.id}:`, err);
            }
        }
        console.log('Done.');
    } catch (error) {
        console.error('Error in main:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
