'use client';

import { useState } from 'react';
import { approveFunding, rejectFunding } from '@/app/(protected)/accounts/actions';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

type Props = {
  fundingId: string;
};

export default function FundingDecisionActions({ fundingId }: Props) {
  const router = useRouter();
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);

  const handleApprove = async () => {
    setApproving(true);
    try {
      // Default to full amount (undefined)
      const result = await approveFunding(fundingId, undefined);
      if (result.success) {
        toast.success('Approved successfully');
        router.push('/dashboard');
      }
    } catch (e) {
      console.error(e);
      toast.error('Failed to approve: ' + (e instanceof Error ? e.message : String(e)));
      setApproving(false);
    }
  };

  const handleReject = async () => {
    setRejecting(true);
    try {
      // Default to no reason
      const result = await rejectFunding(fundingId, '');
      if (result.success) {
        toast.success('Rejected successfully');
        router.push('/dashboard');
      }
    } catch (e) {
      console.error(e);
      toast.error('Failed to reject: ' + (e instanceof Error ? e.message : String(e)));
      setRejecting(false);
    }
  };

  return (
    <div className="flex flex-wrap gap-4">
      <button
        onClick={handleApprove}
        disabled={approving || rejecting}
        className="rounded bg-emerald-600 px-6 py-2 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
      >
        {approving && (
          <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        )}
        Approve
      </button>

      <button
        onClick={handleReject}
        disabled={approving || rejecting}
        className="rounded bg-rose-600 px-6 py-2 text-white text-sm font-medium hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
      >
        {rejecting && (
          <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        )}
        Reject
      </button>
    </div>
  );
}
