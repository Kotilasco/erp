// app/(protected)/dispatches/[dispatchId]/receipt/server-actions.ts
'use server';

import { prisma } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';

export async function markDispatchSent(dispatchId: string) {
  const me = await getCurrentUser();
  if (!me) return;

  await prisma.dispatch.update({
    where: { id: dispatchId },
    data: {
      status: 'DISPATCHED',
      securitySignedAt: new Date(),
      securityById: me.id
    },
  });
  revalidatePath(`/dispatches/${dispatchId}`);
  // redirect handled client-side
}

export async function markDispatchReceived(dispatchId: string) {
  await prisma.dispatch.update({
    where: { id: dispatchId },
    data: { status: 'RECEIVED', receiveAt: new Date() },
  });
  revalidatePath(`/dispatches/${dispatchId}/receipt`);
  redirect(`/dispatches/${dispatchId}/receipt`);
}
