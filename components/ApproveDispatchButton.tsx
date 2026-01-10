'use client';

import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { approveDispatch } from '@/app/(protected)/projects/actions';
import { useState, useTransition } from 'react';
import clsx from 'clsx';

export default function ApproveDispatchButton({
  dispatchId,
  redirectUrl = '/dispatches',
}: {
  dispatchId: string;
  redirectUrl?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleApprove = () => {
    startTransition(async () => {
      try {
        await approveDispatch(dispatchId);
        toast.success('Dispatch approved successfully!');
        router.push(redirectUrl);
        router.refresh(); // Ensure the cache is updated
      } catch (error: any) {
        toast.error(error.message || 'Failed to approve dispatch');
      }
    });
  };

  return (
    <button
      onClick={handleApprove}
      disabled={isPending}
      className={clsx(
        "inline-flex items-center gap-2 rounded px-3 py-1.5 text-sm font-semibold shadow-sm transition focus:ring-2 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60",
        "bg-orange-600 text-white hover:bg-orange-700 focus:ring-orange-500"
      )}
    >
      {isPending && (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/70 border-t-transparent" />
      )}
      <span>{isPending ? 'Approving...' : 'Approve'}</span>
    </button>
  );
}
