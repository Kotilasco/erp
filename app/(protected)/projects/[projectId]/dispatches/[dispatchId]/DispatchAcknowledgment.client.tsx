'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Dispatch, DispatchItem } from '@prisma/client';
// Add import
import { acknowledgeDispatch, markDispatchArrived, confirmDispatchPickup } from '../../../actions';
import { CheckCircleIcon, TruckIcon, KeyIcon } from '@heroicons/react/24/outline'; // KeyIcon for pickup?

type Props = {
  dispatch: Dispatch & { items: DispatchItem[] };
  userId: string;
  userRole: string; // 'DRIVER' | 'PROJECT_OPERATIONS_OFFICER' | 'ADMIN' etc
};

export default function DispatchAcknowledgment({ dispatch, userId, userRole }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [showAckForm, setShowAckForm] = useState(false);

  // Initialize quantities with sent amounts
  useState(() => {
    const initial: Record<string, number> = {};
    dispatch.items.forEach(item => {
      initial[item.id] = item.qty;
    });
    setQuantities(initial);
  });

  const handleConfirmPickup = async () => {
    if (!confirm('Confirm you have picked up all items and are leaving?')) return;
    setLoading(true);
    try {
        await confirmDispatchPickup(dispatch.id);
        router.refresh();
    } catch (e: any) {
        alert(e.message);
    } finally {
        setLoading(false);
    }
  };

  const handleMarkArrived = async () => {
    if (!confirm('Confirm you have arrived at the site?')) return;
    setLoading(true);
    try {
      await markDispatchArrived(dispatch.id);
      router.refresh();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAcknowledge = async () => {
    if (!confirm('Confirm receipt of these items? Any missing items will be flagged.')) return;
    setLoading(true);
    try {
      const items = dispatch.items.map(it => ({
        itemId: it.id,
        acceptedQty: quantities[it.id] ?? it.qty,
        note: notes[it.id]
      }));
      
      await acknowledgeDispatch(dispatch.id, items);
      router.refresh();
      setShowAckForm(false);
    } catch (e: any) {
        alert(e.message);
    } finally {
      setLoading(false);
    }
  };

  // Logic:
  // 1. If Driver & Status = DISPATCHED -> Show "Confirm Pickup" (New Status: IN_TRANSIT)
  // 2. If Driver & Status = IN_TRANSIT -> Show "Mark Arrived" (New Status: ARRIVED)
  // 3. If Site Manager & Status = ARRIVED -> Show "Acknowledge" (New Status: DELIVERED)

  const isDriver = (userRole === 'DRIVER' || userRole === 'ADMIN');
  const isSiteManager = (['PROJECT_OPERATIONS_OFFICER', 'PROJECT_COORDINATOR', 'ADMIN', 'FOREMAN', 'CLERK'].includes(userRole));

  const canConfirmPickup = isDriver && (dispatch.status === 'DISPATCHED');
  const canMarkArrived = isDriver && (['IN_TRANSIT', 'DISPATCHED'].includes(dispatch.status)); // Allow fallback if pickup skipped? Maybe block it if strict.
  // User asked: "status must then allow driver to confirm receival if he does -> Arrive"
  // So strict: DISPATCHED -> Pickup -> IN_TRANSIT -> Arrived
  // But let's allow Mark Arrived to also work if strictly needed (or keep distinct).
  // I will make them distinct steps to enforce the flow.
  
  const canAcknowledge = isSiteManager && ['ARRIVED', 'IN_TRANSIT'].includes(dispatch.status);
  // Relaxed site manager check to allow ack even if driver forgot to mark arrived.

  if (!canConfirmPickup && !canMarkArrived && !canAcknowledge && dispatch.status !== 'DELIVERED') {
      return null; 
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 mt-6">
       <h3 className="text-lg font-bold mb-4">Actions</h3>
       
       {canConfirmPickup && (
         <button 
           onClick={handleConfirmPickup}
           disabled={loading}
           className="w-full flex justify-center items-center gap-2 bg-emerald-600 text-white px-4 py-4 rounded-lg hover:bg-emerald-700 disabled:opacity-50 text-lg font-bold shadow-sm transition-all"
         >
            {loading ? (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
                <CheckCircleIcon className="h-6 w-6" />
            )}
            {loading ? 'Confirming...' : 'Confirm Receipt'}
         </button>
       )}

       {canMarkArrived && !canConfirmPickup && (
         <button 
           onClick={handleMarkArrived}
           disabled={loading}
           className="w-full flex justify-center items-center gap-2 bg-blue-600 text-white px-4 py-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 text-lg font-bold shadow-sm transition-all"
         >
           <TruckIcon className="h-6 w-6" />
           {loading ? 'Updating...' : 'Mark as Arrived at Site'}
         </button>
       )}

       {canAcknowledge && !showAckForm && (
         <button 
           onClick={() => setShowAckForm(true)}
           className="w-full flex justify-center items-center gap-2 bg-emerald-600 text-white px-4 py-4 rounded-lg hover:bg-emerald-700 text-lg font-bold shadow-sm transition-all"
         >
           <CheckCircleIcon className="h-6 w-6" />
           Accept Delivery
         </button>
       )}

       {showAckForm && (
         <div className="mt-4 space-y-4 border-t pt-4">
            <h4 className="font-semibold text-gray-800">Verify Quantities Received</h4>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Sent</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Received (Editable)</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Difference</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {dispatch.items.map(item => {
                    const diff = (quantities[item.id] || 0) - item.qty;
                    return (
                        <tr key={item.id}>
                            <td className="px-3 py-2 text-sm text-gray-900">{item.description}</td>
                            <td className="px-3 py-2 text-sm text-gray-500">{item.qty} {item.unit}</td>
                            <td className="px-3 py-2">
                                <input 
                                  type="number" 
                                  min="0"
                                  max={item.qty}
                                  value={quantities[item.id] || 0}
                                  onChange={(e) => setQuantities({...quantities, [item.id]: Number(e.target.value)})}
                                  className="w-24 rounded border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm"
                                />
                            </td>
                            <td className="px-3 py-2 text-sm font-medium">
                                {diff < 0 ? <span className="text-red-600">{diff} (Return)</span> : <span className="text-green-600">match</span>}
                            </td>
                        </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            
            <div className="flex gap-2 justify-end mt-4">
                <button 
                   onClick={() => setShowAckForm(false)}
                   className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 from-gray-50"
                >
                   Cancel
                </button>
                <button 
                   onClick={handleAcknowledge}
                   disabled={loading}
                   className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-md hover:bg-emerald-700 disabled:opacity-50"
                >
                   {loading ? 'Processing...' : 'Confirm & Sign'}
                </button>
            </div>
         </div>
       )}
    </div>
  );
}
