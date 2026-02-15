'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createDispatchFromSelectedInventory } from '@/app/(protected)/projects/actions';
import { 
  PlusIcon, 
  MinusIcon, 
  TrashIcon, 
  ArrowPathIcon 
} from '@heroicons/react/24/outline';
import { toast } from 'sonner';

interface StockItem {
  id: string;
  name: string | null;
  description: string;
  unit: string | null;
  qty: number;
}

export default function StockDispatchSelector({ 
  projectId, 
  availableItems 
}: { 
  projectId: string; 
  availableItems: StockItem[] 
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState('');
  const [selectedItems, setSelectedItems] = useState<Array<{ id: string; qty: number }>>([]);

  const toggleItem = (item: StockItem) => {
    setSelectedItems(prev => {
      const exists = prev.find(i => i.id === item.id);
      if (exists) {
        return prev.filter(i => i.id !== item.id);
      } else {
        return [...prev, { id: item.id, qty: item.qty }];
      }
    });
  };

  const updateQty = (id: string, qty: number) => {
    const item = availableItems.find(i => i.id === id);
    if (!item) return;

    const safeQty = isNaN(qty) ? 0 : Math.max(0, Math.min(qty, item.qty));
    setSelectedItems(prev => prev.map(i => i.id === id ? { ...i, qty: safeQty } : i));
  };

  const handleSubmit = async () => {
    if (selectedItems.length === 0) {
      toast.error('Select at least one item');
      return;
    }

    setLoading(true);
    try {
      const itemsToDispatch = selectedItems.map(si => ({
        inventoryItemId: si.id,
        qty: si.qty
      }));

      const res = await createDispatchFromSelectedInventory(projectId, itemsToDispatch, note);
      if (res.ok) {
        toast.success('Draft stock dispatch created');
        router.push(`/projects/${projectId}/dispatches/${res.dispatchId}`);
        router.refresh();
      } else {
        toast.error(res.error || 'Failed to create dispatch');
      }
    } catch (e: any) {
      toast.error(e.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* Available Items */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50/50">
          <h2 className="text-lg font-bold text-gray-900">Available Stock (Multipurpose)</h2>
        </div>
        <div className="p-6 space-y-4">
          {availableItems.length === 0 && (
            <p className="text-gray-500 text-sm italic text-center py-8">No multipurpose stock items currently available with quantity {'>'} 0.</p>
          )}
          {availableItems.map(item => {
            const isSelected = selectedItems.find(si => si.id === item.id);
            return (
              <div 
                key={item.id} 
                className={`flex items-center justify-between p-4 rounded-xl border transition-all duration-200 ${isSelected ? 'bg-orange-50 border-orange-200 shadow-sm' : 'bg-white border-gray-100 hover:border-gray-200'}`}
              >
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-gray-900 truncate">{item.name || item.description}</p>
                  <p className="text-sm text-gray-500 mt-1">
                    <span className="font-medium text-orange-600">In Stock:</span> {item.qty} {item.unit}
                  </p>
                </div>
                <button 
                  onClick={() => toggleItem(item)}
                  className={`ml-4 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                    isSelected 
                      ? "bg-green-600 text-white hover:bg-green-700 shadow-sm" 
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  {isSelected ? 'Deselect' : 'Select'}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected Items & Submission */}
      <div className="space-y-6">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50/50">
            <h2 className="text-lg font-bold text-gray-900">Items to Dispatch</h2>
          </div>
          <div className="p-6 space-y-4">
            {selectedItems.length === 0 && (
              <div className="text-center py-8">
                <p className="text-gray-500 text-sm italic">No items selected yet.</p>
                <p className="text-gray-400 text-xs mt-1">Select items from the list to get started.</p>
              </div>
            )}
            {selectedItems.map(si => {
              const item = availableItems.find(i => i.id === si.id)!;
              return (
                <div key={si.id} className="flex flex-col sm:flex-row sm:items-center gap-4 bg-gray-50 p-4 rounded-xl border border-gray-100">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-900 truncate">{item.name || item.description}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{item.unit}</p>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                      <button 
                        className="p-2 hover:bg-gray-50 text-gray-600 transition-colors"
                        onClick={() => updateQty(si.id, si.qty - 1)}
                      >
                        <MinusIcon className="h-4 w-4" />
                      </button>
                      <input 
                        type="number" 
                        value={isNaN(si.qty) ? '' : si.qty} 
                        onChange={(e) => {
                          const val = e.target.value === '' ? 0 : parseFloat(e.target.value);
                          updateQty(si.id, val);
                        }}
                        className="w-16 text-center border-x border-gray-200 py-1 text-sm font-bold text-gray-900 focus:outline-none"
                      />
                      <button 
                        className="p-2 hover:bg-gray-50 text-gray-600 transition-colors"
                        onClick={() => updateQty(si.id, si.qty + 1)}
                      >
                        <PlusIcon className="h-4 w-4" />
                      </button>
                    </div>
                    <button 
                      className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                      onClick={() => toggleItem(item)}
                    >
                      <TrashIcon className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-6 space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700">Stock Dispatch Note (optional)</label>
              <textarea 
                placeholder="e.g. Tools for site team..." 
                rows={3}
                className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all placeholder:text-gray-400 text-sm"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
            <button 
              className={`w-full flex items-center justify-center gap-2 rounded-xl px-6 py-4 text-sm font-bold text-white shadow-lg transition-all ${
                loading || selectedItems.length === 0
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-green-600 hover:bg-green-700 hover:shadow-green-200"
              }`}
              disabled={loading || selectedItems.length === 0}
              onClick={handleSubmit}
            >
              {loading ? (
                <>
                  <ArrowPathIcon className="h-5 w-5 animate-spin" />
                  Creating Draft...
                </>
              ) : (
                'Create Stock Dispatch'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
