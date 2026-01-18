'use client';

import { useState, useTransition } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts';

type VendorPrice = {
    vendor: string;
    phone: string | null;
    price: number;
    lastDate: Date;
};

type ItemAnalysis = {
    description: string;
    unit: string;
    vendors: VendorPrice[];
};

interface Props {
    inventoryList: string[];
    selectedItem: ItemAnalysis | null;
    initialItem: string;
}

export default function VendorPricingClient({ inventoryList, selectedItem, initialItem }: Props) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const [isPending, startTransition] = useTransition();
    const [searchValue, setSearchValue] = useState(initialItem);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        const params = new URLSearchParams(searchParams?.toString());
        if (searchValue) {
            params.set('item', searchValue);
        } else {
            params.delete('item');
        }
        
        startTransition(() => {
            router.replace(`${pathname}?${params.toString()}`);
        });
    };

    return (
        <div className="space-y-8">
            {/* Search Section */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <form onSubmit={handleSearch} className="flex gap-4 items-end">
                    <div className="flex-1">
                        <label htmlFor="item-search" className="block text-sm font-medium leading-6 text-gray-900 mb-2">
                             Select Inventory Item
                        </label>
                        <div className="relative">
                            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                                <MagnifyingGlassIcon className={`h-5 w-5 ${isPending ? 'text-indigo-400 animate-pulse' : 'text-gray-400'}`} aria-hidden="true" />
                            </div>
                            <input
                                id="item-search"
                                list="inventory-items"
                                type="text"
                                className="block w-full rounded-md border-0 py-1.5 pl-10 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                                placeholder="Start typing to search..."
                                value={searchValue}
                                onChange={(e) => setSearchValue(e.target.value)}
                            />
                            <datalist id="inventory-items">
                                {inventoryList.map((item) => (
                                    <option key={item} value={item} />
                                ))}
                            </datalist>
                        </div>
                    </div>
                    <button
                        type="submit"
                        disabled={isPending}
                        className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50"
                    >
                        Analyze Item
                    </button>
                </form>
            </div>

            {/* Results Section */}
            <div className={`transition-opacity duration-300 ${isPending ? 'opacity-50' : 'opacity-100'}`}>
                {selectedItem ? (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 flex flex-col gap-8">
                        <div className="flex justify-between items-start border-b border-gray-100 pb-6">
                            <div>
                                <h2 className="text-2xl font-bold text-gray-900 capitalize">{selectedItem.description}</h2>
                                <p className="text-sm text-gray-500 mt-1">Measured Unit: {selectedItem.unit}</p>
                            </div>
                            <div className="text-sm font-medium bg-emerald-50 text-emerald-700 px-4 py-2 rounded-full border border-emerald-100">
                                Best Price: {selectedItem.vendors[0]?.price.toFixed(2)}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                            {/* Top 3 Vendors Table */}
                            <div>
                                <h3 className="text-sm font-semibold text-gray-900 mb-4 uppercase tracking-wider">Top 3 Cheapest Vendors</h3>
                                <div className="overflow-hidden rounded-lg border border-gray-200">
                                    <table className="min-w-full divide-y divide-gray-200">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rank</th>
                                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vendor</th>
                                                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                                                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Last Purchase</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-200">
                                            {selectedItem.vendors.map((v, idx) => (
                                                <tr key={v.vendor} className={idx === 0 ? 'bg-emerald-50/50' : ''}>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                        #{idx + 1}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                                        {v.vendor}
                                                        {v.phone && <span className="block text-xs text-gray-400 font-normal">{v.phone}</span>}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-bold">
                                                        {v.price.toFixed(2)}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-500 text-right">
                                                        {v.lastDate ? new Date(v.lastDate).toLocaleDateString() : '-'}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Chart */}
                            <div className="h-80 w-full">
                                <h3 className="text-sm font-semibold text-gray-900 mb-4 uppercase tracking-wider text-center">Price Comparison</h3>
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={selectedItem.vendors} layout="vertical" margin={{ top: 5, right: 40, left: 40, bottom: 5 }}>
                                        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                        <XAxis type="number" hide />
                                        <YAxis type="category" dataKey="vendor" width={120} tick={{fontSize: 12, fill: '#374151'}} />
                                        <Tooltip 
                                            formatter={(value: number) => [value.toFixed(2), 'Price']}
                                            labelStyle={{ color: '#374151', fontWeight: 600 }}
                                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                        />
                                        <Bar dataKey="price" fill="#4f46e5" radius={[0, 4, 4, 0]} barSize={30}>
                                            {selectedItem.vendors.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={index === 0 ? '#10b981' : '#6366f1'} />
                                            ))}
                                            <LabelList dataKey="price" position="right" formatter={(val: any) => val?.toFixed(2)} fontSize={12} fill="#6b7280" />
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="text-center py-24 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                        <MagnifyingGlassIcon className="mx-auto h-12 w-12 text-gray-300" />
                        <h3 className="mt-2 text-sm font-semibold text-gray-900">No item selected</h3>
                        <p className="mt-1 text-sm text-gray-500">Select an item from the dropdown to view vendor analysis.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
