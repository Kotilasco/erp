'use server';

import { createDispatchFromPurchases } from '@/app/(protected)/projects/actions';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';

export async function createAndRedirectDispatch(projectId: string) {
    let targetDispatchId: string | null = null;
    let fallbackRedirect: string | null = null;

    try {
        const result = await createDispatchFromPurchases(projectId);
        targetDispatchId = result.dispatchId;
    } catch (e: any) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.includes('No purchased')) {
            // Check for an existing DRAFT dispatch to redirect to instead
            const existingDraft = await prisma.dispatch.findFirst({
                where: { projectId, status: 'DRAFT' },
                orderBy: { createdAt: 'desc' }
            });

            if (existingDraft) {
                targetDispatchId = existingDraft.id;
            } else {
                fallbackRedirect = `/projects/${projectId}?tab=requisitions`;
            }
        } else {
            throw e;
        }
    }

    if (targetDispatchId) {
        redirect(`/projects/${projectId}/dispatches/${targetDispatchId}`);
    }
    if (fallbackRedirect) {
        redirect(fallbackRedirect);
    }
}
