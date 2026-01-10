'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { markDispatchSent } from '@/app/(protected)/dispatches/[dispatchId]/receipt/actions';

export default function SignGatePassButton({ dispatchId }: { dispatchId: string }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleSign = () => {
    startTransition(async () => {
      try {
        await markDispatchSent(dispatchId);
        toast.success("Gate Pass Signed Successfully");
        router.push('/dispatches');
        router.refresh(); 
      } catch (error) {
        console.error(error);
        toast.error("Failed to sign gate pass");
      }
    });
  };

  return (
    <button
      onClick={handleSign}
      disabled={isPending}
      className="flex items-center gap-3 rounded-xl bg-orange-600 px-8 py-4 text-lg font-bold text-white shadow-lg transition-all hover:bg-orange-700 hover:shadow-xl hover:-translate-y-1 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {isPending ? (
        <>
            <div className="h-6 w-6 animate-spin rounded-full border-b-2 border-current border-t-2" />
            Signing...
        </>
      ) : (
        <>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Sign Gate Pass (Mark Sent)
        </>
      )}
    </button>
  );
}
