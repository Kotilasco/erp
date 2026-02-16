'use client';

import { useState } from 'react';
import { updateMaterialUsage } from '@/app/(protected)/projects/actions';
import SubmitButton from '@/components/SubmitButton';
import { ArchiveBoxIcon, CheckCircleIcon, PencilSquareIcon } from '@heroicons/react/24/outline';
import { usePathname } from 'next/navigation';

type DispatchItem = {
  id: string;
  description: string;
  unit: string | null;
  qty: number; // Dispatched/Handed out quantity
  usedOutQty: number; // Previously used
  // inventoryItem?: { name: string };
};

export default function MaterialUsageList({ 
  items 
}: { 
  items: DispatchItem[] 
}) {
  const pathname = usePathname();
  // We'll track local state for inputs to allow multiple updates at once
  // Key: dispatchItemId, Value: usedQty for this session
  const [updates, setUpdates] = useState<Record<string, number>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleInputChange = (id: string, value: string) => {
    if (value === '') {
      setUpdates((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      return;
    }

    const num = parseFloat(value);
    if (isNaN(num) || num < 0) return;
    setUpdates((prev) => ({
      ...prev,
      [id]: num,
    }));
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setSuccessMessage(null);
    
    // Filter out zero updates
    const payloads = Object.entries(updates)
      .filter(([_, qty]) => qty > 0)
      .map(([id, qty]) => ({ dispatchItemId: id, usedQty: qty }));

    if (payloads.length === 0) {
      setIsSubmitting(false);
      return;
    }

    try {
      await updateMaterialUsage(payloads, pathname);
      setUpdates({}); // Clear inputs on success
      setSuccessMessage('Usage recorded successfully');
      
      // Clear success message after 3s
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error) {
      console.error(error);
      alert('Failed to update material usage');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 mb-4">
          <ArchiveBoxIcon className="h-6 w-6 text-gray-400" />
        </div>
        <h3 className="text-lg font-medium text-gray-900">No Materials Available</h3>
        <p className="mt-1 text-sm text-gray-500">
          This project has no confirmed dispatches yet. Materials must be dispatched and received on site before they can be tracked here.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="p-6 border-b border-gray-100 flex justify-between items-center">
        <div>
          <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <ArchiveBoxIcon className="h-5 w-5 text-indigo-600" />
            Material Usage
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            Record materials consumed on site today.
          </p>
        </div>
        {successMessage && (
          <div className="flex items-center gap-2 text-green-600 bg-green-50 px-3 py-1 rounded-full text-sm font-medium animate-fade-in">
            <CheckCircleIcon className="h-4 w-4" />
            {successMessage}
          </div>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Material Description
              </th>
              {/*
              <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Received
              </th>
              <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Previously Used
              </th>
              */}
              <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Remaining
              </th>
              <th scope="col" className="px-6 py-3 text-right text-xs font-semibold text-indigo-700 uppercase tracking-wider w-48">
                <span className="inline-flex items-center gap-1 justify-end">
                  <PencilSquareIcon className="h-4 w-4 text-indigo-500" />
                  <span>Used Today</span>
                </span>
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {items.map((item) => {
              const prevUsed = item.usedOutQty || 0;
              const remaining = item.qty - prevUsed;
              const currentInput = updates[item.id] ?? '';
              
              const isOverLimit = (typeof currentInput === 'number') && (currentInput > remaining);

              return (
                <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {item.description}
                  </td>
                  {/*
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">
                    {item.qty} {item.unit}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">
                    {prevUsed.toFixed(2)} {item.unit}
                  </td>
                  */}
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 text-right">
                    {remaining.toFixed(2)} {item.unit}
                  </td>
                  <td className="px-6 py-3 whitespace-nowrap text-right">
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        max={remaining}
                        value={currentInput}
                        onChange={(e) => handleInputChange(item.id, e.target.value)}
                        className={`block w-full rounded-md border border-indigo-100 bg-indigo-50/60 px-3 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm text-right placeholder:text-indigo-300 ${
                          isOverLimit ? 'border-red-300 text-red-900 focus:border-red-500 focus:ring-red-500' : ''
                        }`}
                      />
                    </div>
                    {isOverLimit && (
                      <p className="text-xs text-red-600 mt-1 absolute right-6">Exceeds remaining</p>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="p-4 bg-gray-50 border-t border-gray-200 flex justify-end">
        <button
          onClick={handleSubmit}
          disabled={isSubmitting || Object.keys(updates).length === 0}
          className="inline-flex items-center justify-center rounded-md border border-transparent bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {isSubmitting ? 'Saving...' : 'Save Usage'}
        </button>
      </div>
    </div>
  );
}
