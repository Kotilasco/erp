'use server';

import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

export async function updateDispatchUsage(itemId: string, returnedQty: number, usedOutQty: number) {
    const user = await getCurrentUser();
    if (!user) throw new Error('Unauthorized');

    // Basic permission check - POO or Admin
    const allowedRoles = ['ADMIN', 'MANAGING_DIRECTOR', 'PROJECT_OPERATIONS_OFFICER', 'STORE_KEEPER'];
    if (!allowedRoles.includes(user.role)) {
        throw new Error('Insufficient permissions');
    }

    const item = await prisma.dispatchItem.findUnique({
        where: { id: itemId },
        include: { dispatch: true }
    });

    if (!item) throw new Error('Item not found');

    // Optional: Check if POO is assigned to this project?
    // For now, assume role check is enough as per request "POO can update".

    // Validate logic
    if (returnedQty < 0 || usedOutQty < 0) throw new Error('Quantities cannot be negative');
    if (returnedQty + usedOutQty > item.qty) {
        throw new Error('Total returned + used cannot exceed dispatched quantity');
    }

    await prisma.dispatchItem.update({
        where: { id: itemId },
        data: {
            returnedQty,
            usedOutQty,
            usedOutAt: usedOutQty > 0 ? new Date() : item.usedOutAt,
            usedOutById: usedOutQty > 0 ? user.id : item.usedOutById
        }
    });

    revalidatePath('/reports/material-utilization');
    return { success: true };
}
