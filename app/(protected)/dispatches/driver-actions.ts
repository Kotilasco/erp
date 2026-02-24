'use server';

import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

export async function acknowledgeDispatchByDriver(dispatchId: string) {
    const user = await getCurrentUser();
    if (!user || (user.role !== 'DRIVER' && user.role !== 'ADMIN')) {
        throw new Error('Unauthorized');
    }

    await prisma.dispatch.update({
        where: { id: dispatchId },
        data: {
            status: 'DELIVERED', // Driver has confirmed delivery/receipt
            driverById: user.id,
            driverSignedAt: new Date(),
            // departAt is for when they leave warehouse, maybe we need another action? 
            // The user says "confirms receipt", implying the customer received it. 
            // Or maybe "confirms receipt" means driver received it from security?
            // "if driver confirms receipt what status does the dispatch get. it must be shown on the table"
            // "any dispatch i actioned" (past tense) -> implies completed.
            // If the previous step was "Security Signs" -> status became DISPATCHED. 
            // So Driver acts on DISPATCHED items. 
            // So this action `acknowledgeDispatchByDriver` is likely the "I delivered it" action.
            // But wait, the function name is `acknowledgeDispatchByDriver`. 
            // If security signs, it is `DISPATCHED`. 
            // Ideally: Created -> Submitted -> Approved -> Dispatched (Security gives to Driver) -> Delivered (Driver gives to Customer).
            // Let's assume this action is the final step.
            departAt: new Date() // Keeping this for now, but semantically 'DELIVERED' fits better for "done"
        }
    });

    revalidatePath(`/dispatches/${dispatchId}`);
    revalidatePath('/dashboard');
}

export async function getDrivers() {
    const user = await getCurrentUser();
    if (!user || (user.role !== 'SECURITY' && user.role !== 'ADMIN' && user.role !== 'PROJECT_OPERATIONS_OFFICER')) {
        throw new Error('Unauthorized');
    }
    return prisma.user.findMany({
        where: { role: 'DRIVER' },
        select: { id: true, name: true, email: true }
    });
}

export async function assignDriverToDispatch(dispatchId: string, driverId: string) {
    const user = await getCurrentUser();
    if (!user || (user.role !== 'SECURITY' && user.role !== 'ADMIN' && user.role !== 'PROJECT_OPERATIONS_OFFICER')) {
        throw new Error('Unauthorized');
    }

    const dispatch = await prisma.dispatch.findUnique({
        where: { id: dispatchId },
        include: { items: true }
    });
    if (!dispatch) throw new Error('Dispatch not found');

    const handedOutItems = dispatch.items.filter(it => it.handedOutAt);
    if (handedOutItems.length === 0) {
        throw new Error('Cannot assign driver to a dispatch with no items handed out. Please click "Dispatch" on at least one item first.');
    }

    const unhandedItems = dispatch.items.filter(it => !it.handedOutAt);

    const nextDispatchId = await prisma.$transaction(async (tx) => {
        // 1) Handle items that were not handed out: Move to a NEW dispatch record
        let newDispatchId: string | null = null;
        if (unhandedItems.length > 0) {
            const newD = await tx.dispatch.create({
                data: {
                    projectId: dispatch.projectId,
                    status: 'APPROVED', // Keep it ready for the next truck
                    note: `Remaining items split from Dispatch #${dispatchId.slice(0, 8)}`,
                    createdById: user.id,
                    items: {
                        create: unhandedItems.map(it => ({
                            requisitionItemId: it.requisitionItemId,
                            description: it.description,
                            qty: it.qty,
                            unit: it.unit,
                            estPriceMinor: it.estPriceMinor,
                            inventoryItemId: it.inventoryItemId,
                            purchaseId: it.purchaseId,
                        }))
                    }
                },
                select: { id: true }
            });
            newDispatchId = newD.id;

            // Delete them from the current manifest so Driver A doesn't see them
            await tx.dispatchItem.deleteMany({
                where: { id: { in: unhandedItems.map(it => it.id) } }
            });
        }

        // 2) Assign driver and finalize dispatch A (the one being handed over)
        await tx.dispatch.update({
            where: { id: dispatchId },
            data: {
                assignedToDriverId: driverId,
                status: 'DISPATCHED',
                securitySignedAt: new Date(),
                securityById: user.id
            }
        });

        return newDispatchId;
    });

    revalidatePath(`/dispatches/${dispatchId}`);
    revalidatePath('/dashboard');

    // If we split, redirect to the new dispatch so Security can keep loading
    if (nextDispatchId) {
        return { ok: true, redirected: true, nextDispatchId };
    }
    return { ok: true, redirected: false };
}
