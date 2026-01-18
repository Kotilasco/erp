'use client';

import { useState } from 'react';
import { approveFunding, postponeFunding } from '@/app/(protected)/accounts/actions';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

type Props = {
  fundingId: string;
};

export default function FundingDecisionActions({ fundingId }: Props) {
  const router = useRouter();
  const [approving, setApproving] = useState(false);
  const [postponing, setPostponing] = useState(false);
  
  // Modal states
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showPostponeModal, setShowPostponeModal] = useState(false);
  
  // Postpone state
  const [postponeDate, setPostponeDate] = useState('');

  const handleApprove = async () => {
    setApproving(true);
    try {
      const result = await approveFunding(fundingId, undefined);
      if (result.success) {
        toast.success('Approved successfully');
        setShowApproveModal(false);
        router.push('/dashboard');
      }
    } catch (e) {
      console.error(e);
      toast.error('Failed to approve: ' + (e instanceof Error ? e.message : String(e)));
      setApproving(false);
    }
  };

  const handlePostpone = async () => {
    if (!postponeDate) {
        toast.error('Please select a date');
        return;
    }
    const selected = new Date(postponeDate);
    const now = new Date();
    now.setHours(0,0,0,0);
    if (selected <= now) {
        toast.error('Postpone date must be in the future');
        return;
    }

    setPostponing(true);
    try {
      const result = await postponeFunding(fundingId, selected, 'Postponed by user');
      if (result.success) {
        toast.success('Request postponed');
        setShowPostponeModal(false);
        router.push('/dashboard');
      }
    } catch (e) {
      console.error(e);
      toast.error('Failed to postpone: ' + (e instanceof Error ? e.message : String(e)));
      setPostponing(false);
    }
  };

  return (
    <>
      <div className="flex flex-wrap gap-4">
        <button
          onClick={() => setShowApproveModal(true)}
          disabled={approving || postponing}
          className="rounded bg-emerald-600 px-6 py-2 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
        >
          Approve
        </button>

        <button
          onClick={() => setShowPostponeModal(true)}
          disabled={approving || postponing}
          className="rounded bg-amber-600 px-6 py-2 text-white text-sm font-medium hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
        >
          Postpone
        </button>
      </div>

      {/* Approve Modal */}
      {showApproveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-200">
           <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">Confirm Approval</h3>
              <p className="text-gray-600">Are you sure you want to approve this funding request? This will authorize the disbursement.</p>
              <div className="flex justify-end gap-3 pt-2">
                 <button 
                    onClick={() => setShowApproveModal(false)}
                    disabled={approving}
                    className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
                 >
                    Cancel
                 </button>
                 <button
                    onClick={handleApprove}
                    disabled={approving}
                    className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-md flex items-center gap-2 transition-colors"
                 >
                    {approving && (
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                    )}
                    Confirm Approve
                 </button>
              </div>
           </div>
        </div>
      )}

      {/* Postpone Modal */}
      {showPostponeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-200">
           <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">Postpone Request</h3>
              <p className="text-gray-600">Please select a future date until which this request will be postponed.</p>
              
              <div>
                 <label className="block text-sm font-medium text-gray-700 mb-1">Postpone Until</label>
                 <input 
                    type="date" 
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                    min={new Date(Date.now() + 86400000).toISOString().split('T')[0]}
                    value={postponeDate}
                    onChange={(e) => setPostponeDate(e.target.value)}
                 />
                 <p className="mt-1 text-xs text-gray-500">The request will reappear in the pending list after this date.</p>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                 <button 
                    onClick={() => setShowPostponeModal(false)}
                    disabled={postponing}
                    className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
                 >
                    Cancel
                 </button>
                 <button
                    onClick={handlePostpone}
                    disabled={postponing}
                    className="px-4 py-2 text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 rounded-md flex items-center gap-2 transition-colors"
                 >
                    {postponing && (
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                    )}
                    Confirm Postpone
                 </button>
              </div>
           </div>
        </div>
      )}
    </>
  );
}
