'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { fromMinor } from '@/helpers/money';
import { approvePOWithUpdates, rejectPO } from '../actions';
import SubmitButton from '@/components/SubmitButton';
import { CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline';

interface Props {
  poId: string;
  items: Array<{
    id: string;
    description: string;
    qty: number;
    unit: string | null;
    unitPriceMinor: bigint;
    totalMinor: bigint;
  }>;
  userId: string;
}

export default function PurchaseOrderApproval({ poId, items, userId }: Props) {
  const router = useRouter();
  const [prices, setPrices] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    items.forEach(item => {
      initial[item.id] = fromMinor(item.unitPriceMinor);
    });
    return initial;
  });
  const [rejectReason, setRejectReason] = useState('');
  const [action, setAction] = useState<'APPROVE' | 'REJECT' | null>(null);

  const handlePriceChange = (itemId: string, val: string) => {
    setPrices(prev => ({ ...prev, [itemId]: parseFloat(val) || 0 }));
  };

  const handleApprove = async () => {
    setAction('APPROVE');
    try {
      const updates = Object.entries(prices).map(([id, price]) => ({
        id,
        unitPriceMinor: Math.round(price * 100)
      }));
      await approvePOWithUpdates(poId, userId, updates);
      router.refresh();
    } catch (e) {
      alert('Failed to approve: ' + e);
      setAction(null);
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      alert('Please provide a rejection reason');
      return;
    }
    setAction('REJECT');
    try {
      await rejectPO(poId, rejectReason, userId);
      router.refresh();
    } catch (e) {
      alert('Failed to reject: ' + e);
      setAction(null);
    }
  };

  const totalCalculated = items.reduce((sum, item) => {
    const price = prices[item.id] || 0;
    return sum + (price * item.qty);
  }, 0);

  return (
    <Card className="rounded-xl border border-blue-200 bg-white shadow-sm ring-1 ring-blue-50">
      <CardHeader className="border-b border-blue-100 bg-blue-50/50 px-6 py-4">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-blue-900">
          <span>Review & Approve</span>
        </CardTitle>
        <CardDescription className="text-sm text-blue-600">
          Review prices and approve this purchase order. Ensure amounts are correct before processing.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-6 py-6 space-y-6">
        <div className="overflow-hidden rounded-lg border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Item</th>
                <th scope="col" className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Qty</th>
                <th scope="col" className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Unit Price ($)</th>
                <th scope="col" className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Total ($)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {items.map((item) => {
                const price = prices[item.id] || 0;
                const lineTotal = price * item.qty;
                return (
                  <tr key={item.id}>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {item.description}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-500">
                      {item.qty} {item.unit}
                    </td>
                    <td className="px-4 py-3 text-sm text-right">
                      <input 
                        type="number" 
                        step="0.01" 
                        value={prices[item.id]} 
                        onChange={(e) => handlePriceChange(item.id, e.target.value)}
                        className="w-28 rounded-md border-gray-300 py-1 text-right text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-medium text-gray-900">
                      ${lineTotal.toFixed(2)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-gray-50">
              <tr>
                <th colSpan={3} className="px-4 py-3 text-right text-sm font-semibold text-gray-900">Total Approved Amount:</th>
                <td className="px-4 py-3 text-right text-sm font-bold text-gray-900">${totalCalculated.toFixed(2)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="grid grid-cols-1 gap-6 pt-4 lg:grid-cols-2">
           <div className="space-y-4 rounded-lg bg-gray-50 p-4">
             <label htmlFor="rejectReason" className="block text-sm font-medium text-gray-700">Rejection Reason</label>
             <div className="flex gap-2">
               <input 
                 type="text" 
                 id="rejectReason"
                 value={rejectReason}
                 onChange={e => setRejectReason(e.target.value)}
                 className="block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm"
                 placeholder="Reason for rejection..."
               />
               <button
                 onClick={handleReject}
                 disabled={action !== null}
                 className="inline-flex items-center justify-center rounded-md border border-transparent bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50"
               >
                 {action === 'REJECT' ? 'Rejecting...' : 'Reject'}
               </button>
             </div>
           </div>

           <div className="flex items-end justify-end p-4">
             <button
               onClick={handleApprove}
               disabled={action !== null}
               className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:bg-emerald-700 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:opacity-50 sm:w-auto"
             >
               <CheckCircleIcon className="h-5 w-5" />
               {action === 'APPROVE' ? 'Approving...' : 'Approve Order'}
             </button>
           </div>
        </div>
      </CardContent>
    </Card>
  );
}
