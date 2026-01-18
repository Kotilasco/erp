'use server';

import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { assertRoles } from '@/lib/workflow';

export async function approveTopup(fd: FormData) {
    const user = await getCurrentUser();
    if (!user) throw new Error('Unauthenticated');
    assertRoles(user.role, ['SENIOR_PROCUREMENT', 'ADMIN', 'MANAGING_DIRECTOR', 'GENERAL_MANAGER']);

    const topupId = String(fd.get('topupId'));

    const topup = await prisma.requisitionItemTopup.findUnique({
        where: { id: topupId }
    });

    if (!topup) throw new Error('Not found');

    // Safety Check: Self-Approval
    if (topup.requestedById === user.id) {
        throw new Error('Conflict of Interest: You cannot approve your own request.');
    }

    await prisma.$transaction(async (tx) => {
        // 1. Update Topup Status
        await tx.requisitionItemTopup.update({
            where: { id: topupId },
            data: {
                approved: true, // Approved
                decidedById: user.id,
                decidedAt: new Date()
            }
        });

        // 2. Update Requisition Item Quantity (Accepted Topup)
        // We increment the requested quantity on the item
        await tx.procurementRequisitionItem.update({
            where: { id: topup.requisitionItemId },
            data: {
                qtyRequested: { increment: topup.qtyRequested }
            }
        });
    });

    revalidatePath('/procurement/approvals');
    revalidatePath('/dashboard');
}

export async function rejectTopup(fd: FormData) {
    const user = await getCurrentUser();
    if (!user) throw new Error('Unauthenticated');
    assertRoles(user.role, ['SENIOR_PROCUREMENT', 'ADMIN', 'MANAGING_DIRECTOR', 'GENERAL_MANAGER']);

    const topupId = String(fd.get('topupId'));

    await prisma.requisitionItemTopup.update({
        where: { id: topupId },
        data: {
            approved: false, // Rejected
            decidedById: user.id,
            decidedAt: new Date()
        }
    });

    revalidatePath('/procurement/approvals');
    revalidatePath('/dashboard');
}
