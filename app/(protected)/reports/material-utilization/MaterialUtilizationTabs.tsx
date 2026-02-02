'use client';

import { useState } from 'react';
import { UtilizationItem } from '@/lib/material-utilization';
import MaterialUtilizationTable from './client';
import { ArchiveBoxIcon, ShoppingCartIcon } from '@heroicons/react/24/outline';

export default function MaterialUtilizationTabs({
    stockItems,
    purchaseItems
}: {
    stockItems: UtilizationItem[];
    purchaseItems: UtilizationItem[];
}) {
    const [activeTab, setActiveTab] = useState<'STOCK' | 'PURCHASE'>('STOCK');

    return (
        <div className="space-y-6">
            {/* Tabs Header */}
            <div className="border-b border-gray-200">
                <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                    <button
                        onClick={() => setActiveTab('STOCK')}
                        className={`
                            group inline-flex items-center gap-2 border-b-2 py-4 px-1 text-sm font-medium transition-colors
                            ${activeTab === 'STOCK'
                                ? 'border-orange-500 text-orange-600'
                                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'}
                        `}
                    >
                        <ArchiveBoxIcon className={`h-5 w-5 ${activeTab === 'STOCK' ? 'text-orange-500' : 'text-gray-400 group-hover:text-gray-500'}`} />
                        <span>Stock Dispatches</span>
                        <span className={`ml-2 rounded-full py-0.5 px-2.5 text-xs font-medium ${activeTab === 'STOCK' ? 'bg-orange-100 text-orange-600' : 'bg-gray-100 text-gray-900'}`}>
                            {stockItems.length}
                        </span>
                    </button>
                    <button
                        onClick={() => setActiveTab('PURCHASE')}
                        className={`
                            group inline-flex items-center gap-2 border-b-2 py-4 px-1 text-sm font-medium transition-colors
                            ${activeTab === 'PURCHASE'
                                ? 'border-indigo-500 text-indigo-600'
                                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'}
                        `}
                    >
                        <ShoppingCartIcon className={`h-5 w-5 ${activeTab === 'PURCHASE' ? 'text-indigo-500' : 'text-gray-400 group-hover:text-gray-500'}`} />
                        <span>Direct Purchases</span>
                        <span className={`ml-2 rounded-full py-0.5 px-2.5 text-xs font-medium ${activeTab === 'PURCHASE' ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-100 text-gray-900'}`}>
                            {purchaseItems.length}
                        </span>
                    </button>
                </nav>
            </div>

            {/* Tab Content */}
            <div className="min-h-[400px]">
                {activeTab === 'STOCK' && (
                    <div className="animate-in fade-in slide-in-from-left-4 duration-300">
                         {stockItems.length > 0 ? (
                            <MaterialUtilizationTable items={stockItems} title="Items from Warehouse Stock" />
                        ) : (
                            <div className="p-12 bg-white rounded-xl border border-dashed text-center text-gray-500 flex flex-col items-center">
                                <ArchiveBoxIcon className="h-12 w-12 text-gray-300 mb-3" />
                                <p>No stock items dispatched.</p>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'PURCHASE' && (
                     <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                        {purchaseItems.length > 0 ? (
                            <MaterialUtilizationTable items={purchaseItems} title="Directly Purchased Items" />
                        ) : (
                            <div className="p-12 bg-white rounded-xl border border-dashed text-center text-gray-500 flex flex-col items-center">
                                <ShoppingCartIcon className="h-12 w-12 text-gray-300 mb-3" />
                                <p>No direct purchase items dispatched.</p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
