'use client';

import { UtilizationItem } from "@/lib/material-utilization";
import { useState } from "react";
import { updateDispatchUsage } from "./actions"; // We'll create this next
import Modal from "@/components/Modal"; // Assuming we have a generic Modal or Dialog component, otherwise I'll build a simple one
import { useRouter } from "next/navigation";

// Since I don't know if a generic Modal exists, I'll implement a simple inline editing or a local modal state.
// Let's use a simple distinct "Edit" state per row or a shared modal.

export default function MaterialUtilizationTable({ 
    items, 
    title
}: { 
    items: UtilizationItem[]; 
    title: string;
}) {
    const [editingItem, setEditingItem] = useState<UtilizationItem | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    
    // Form State
    const [returned, setReturned] = useState(0);
    const [used, setUsed] = useState(0);

    const router = useRouter();

    const handleEdit = (item: UtilizationItem) => {
        setEditingItem(item);
        setReturned(item.returnedQty);
        setUsed(item.usedQty);
    };

    const handleSave = async () => {
        if (!editingItem) return;
        setIsSaving(true);
        try {
            await updateDispatchUsage(editingItem.id, returned, used);
            setEditingItem(null);
            router.refresh();
        } catch (e) {
            alert('Failed to update: ' + e);
        } finally {
            setIsSaving(false);
        }
    };

    if (items.length === 0) return null;

    return (
        <div className="bg-white border rounded-xl shadow-sm overflow-hidden mb-8">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                <h3 className="font-semibold text-gray-900">{title}</h3>
                <span className="text-xs font-medium text-gray-500 bg-white border px-2 py-1 rounded-full">{items.length} items</span>
            </div>
            
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-200">
                        <tr>
                            <th className="px-6 py-3">Project</th>
                            <th className="px-6 py-3">Item Description</th>
                            <th className="px-6 py-3 text-right">Dispatched</th>
                            <th className="px-6 py-3 text-right">Returned</th>
                            <th className="px-6 py-3 text-right">Used</th>
                            <th className="px-6 py-3 text-right bg-indigo-50/50">On Site</th>
                            <th className="px-6 py-3 text-right">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {items.map((item) => (
                            <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                                <td className="px-6 py-4 font-medium text-gray-900 truncate max-w-[150px]" title={item.projectName}>
                                    {item.projectName}
                                </td>
                                <td className="px-6 py-4 text-gray-600 truncate max-w-[300px]" title={item.description}>
                                    <div className="flex flex-col">
                                        <span>{item.description}</span>
                                        <span className="text-xs text-gray-400">{item.sourceRef}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-right font-medium">{item.dispatchedQty} <span className="text-xs font-normal text-gray-400">{item.unit}</span></td>
                                <td className="px-6 py-4 text-right text-orange-600">{item.returnedQty > 0 ? item.returnedQty : '-'}</td>
                                <td className="px-6 py-4 text-right text-blue-600">{item.usedQty > 0 ? item.usedQty : '-'}</td>
                                <td className="px-6 py-4 text-right font-bold text-indigo-700 bg-indigo-50/30">
                                    {item.pendingOnSite}
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <button 
                                        onClick={() => handleEdit(item)}
                                        className="text-indigo-600 hover:text-indigo-900 text-xs font-medium border border-indigo-200 rounded px-2 py-1 hover:bg-indigo-50"
                                    >
                                        Update
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Simple Edit Modal/Overlay */}
            {editingItem && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                            <h3 className="font-semibold text-gray-900">Update Usage</h3>
                            <button onClick={() => setEditingItem(null)} className="text-gray-400 hover:text-gray-600">✕</button>
                        </div>
                        
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Item</label>
                                <p className="text-sm text-gray-900 bg-gray-50 p-2 rounded border border-gray-200">{editingItem.description}</p>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Total Dispatched</label>
                                    <div className="text-lg font-bold text-gray-900">{editingItem.dispatchedQty}</div>
                                </div>
                                <div>
                                     <label className="block text-sm font-medium text-gray-700 mb-1">Remaining On Site</label>
                                     <div className="text-lg font-bold text-indigo-600">
                                        {(editingItem.dispatchedQty - returned - used).toFixed(2)}
                                     </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Total Returned</label>
                                    <input 
                                        type="number" 
                                        step="0.01"
                                        min="0"
                                        value={returned}
                                        onChange={(e) => setReturned(parseFloat(e.target.value) || 0)}
                                        className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Total Used</label>
                                    <input 
                                        type="number" 
                                        step="0.01"
                                        min="0"
                                        value={used}
                                        onChange={(e) => setUsed(parseFloat(e.target.value) || 0)}
                                        className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                                    />
                                </div>
                            </div>

                            { (returned + used) > editingItem.dispatchedQty && (
                                <p className="text-sm text-red-600">Error: Total (Returned + Used) exceeds Dispatched qty.</p>
                            )}
                        </div>

                        <div className="px-6 py-4 bg-gray-50 flex justify-end gap-3">
                            <button 
                                onClick={() => setEditingItem(null)}
                                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={handleSave}
                                disabled={isSaving || (returned + used) > editingItem.dispatchedQty}
                                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                            >
                                {isSaving ? 'Saving...' : 'Save Updates'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
