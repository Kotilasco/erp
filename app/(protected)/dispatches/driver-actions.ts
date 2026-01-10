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
    if (!user || (user.role !== 'SECURITY' && user.role !== 'ADMIN')) {
        throw new Error('Unauthorized');
    }
    return prisma.user.findMany({
        where: { role: 'DRIVER' },
        select: { id: true, name: true, email: true }
    });
}

export async function assignDriverToDispatch(dispatchId: string, driverId: string) {
    const user = await getCurrentUser();
    if (!user || (user.role !== 'SECURITY' && user.role !== 'ADMIN')) {
        throw new Error('Unauthorized');
    }

    await prisma.dispatch.update({
        where: { id: dispatchId },
        data: {
            assignedToDriverId: driverId,
            status: 'DISPATCHED', // Updated to DISPATCHED so it shows in driver's list (was SENT, but dashboard looks for DISPATCHED)
            securitySignedAt: new Date(),
            securityById: user.id
        }
    });

    revalidatePath(`/dispatches/${dispatchId}`);
    revalidatePath('/dashboard');
}
