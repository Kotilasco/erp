'use client';

import { VarianceItem } from "@/lib/profit-loss";
import Money from "@/components/Money";
import { useState } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/outline";
import Link from 'next/link';

export default function GlobalPnLTable({ 
    items, 
    title,
    pageSize = 10 
}: { 
    items: VarianceItem[]; 
    title?: string;
    pageSize?: number;
}) {
    const [page, setPage] = useState(1);

    const totalPages = Math.ceil(items.length / pageSize);
    const startIdx = (page - 1) * pageSize;
    const paginatedItems = items.slice(startIdx, startIdx + pageSize);

    const formatMoney = (minor: bigint) => {
        const isPos = minor >= 0;
        return (
            <span className={`font-mono font-medium ${isPos ? 'text-emerald-700' : 'text-rose-700'}`}>
                {isPos ? '+' : ''}<Money minor={minor} />
            </span>
        );
    };

    if (items.length === 0) return null;

    return (
        <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
             {title && (
                <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
                    <h3 className="font-semibold text-gray-900">{title}</h3>
                </div>
            )}
            
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-200">
                        <tr>
                            <th className="px-6 py-3 w-64">Project</th>
                            <th className="px-6 py-3 w-96">Description</th>
                            <th className="px-6 py-3 text-right">Qty</th>
                            <th className="px-6 py-3 text-right">Est. Unit</th>
                            <th className="px-6 py-3 text-right">Act. Unit</th>
                            <th className="px-6 py-3 text-right">Variance</th>
                            <th className="px-6 py-3 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {paginatedItems.map((item, idx) => {
                            const details = item.structuredDetails;
                            const isProcurement = item.category === 'PROCUREMENT';
                            const isUsage = item.category === 'USAGE';
                            
                            // Determine what to show in "Est" and "Act" columns based on category
                            let estPrice = null;
                            let actPrice = null;
                            let qty = details?.quantity;

                            if (isProcurement) {
                                estPrice = details?.estUnitPriceMinor;
                                actPrice = details?.actualUnitPriceMinor;
                            } else if (isUsage) {
                                // For usage, "Est" could be "Quoted Qty" and "Act" be "Used Qty" ?
                                // User asked for useful info. 
                                // Let's keep Price columns for Price and maybe reuse them or add specific text?
                                // Actually, let's render explicitly.
                                estPrice = details?.unitPriceMinor; // The cost per unit being wasted
                            }

                            return (
                                <tr key={`${item.id}-${idx}`} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4 font-medium text-gray-900 truncate max-w-[200px]" title={item.projectName}>
                                        {item.projectName || '-'}
                                    </td>
                                    <td className="px-6 py-4 text-gray-600 truncate max-w-[300px]" title={item.description}>
                                        {item.description.replace(/^\[.*?\]\s*/, '')} {/* Remove [Project Name] prefix if present in msg */}
                                    </td>
                                    
                                    {/* QTY Column */}
                                    <td className="px-6 py-4 text-right text-gray-600">
                                        {isUsage ? (
                                             <div className="flex flex-col items-end text-xs">
                                                <span>Over: {details?.quantity?.toFixed(2)}</span>
                                                <span className="text-gray-400">
                                                    (Q: {details?.quotedQty} / U: {details?.usedQty})
                                                </span>
                                             </div>
                                        ) : (
                                            <span>{qty}</span>
                                        )}
                                    </td>

                                    {/* Est Price */}
                                    <td className="px-6 py-4 text-right text-gray-600">
                                        {estPrice !== undefined && estPrice !== null ? <Money minor={estPrice} /> : '-'}
                                    </td>

                                    {/* Act Price */}
                                    <td className="px-6 py-4 text-right text-gray-600">
                                         {actPrice !== undefined && actPrice !== null ? <Money minor={actPrice} /> : '-'}
                                    </td>

                                    {/* Variance */}
                                    <td className={`px-6 py-4 text-right font-bold`}>
                                        {formatMoney(item.varianceMinor)}
                                    </td>

                                    {/* Actions */}
                                    <td className="px-6 py-4 text-right text-sm">
                                        {item.projectId && (
                                            <Link 
                                                href={`/projects/${item.projectId}/reports/profit-loss`}
                                                className="text-indigo-600 hover:text-indigo-900 font-medium inline-flex items-center gap-1 group/link"
                                            >
                                                Detailed Report
                                                <span className="transition-transform group-hover/link:translate-x-1">&rarr;</span>
                                            </Link>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between border-t border-gray-200 px-6 py-3 bg-gray-50">
                    <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
                        <div>
                            <p className="text-sm text-gray-700">
                                Showing <span className="font-medium">{startIdx + 1}</span> to <span className="font-medium">{Math.min(startIdx + pageSize, items.length)}</span> of <span className="font-medium">{items.length}</span> results
                            </p>
                        </div>
                        <div>
                            <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                                <button
                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                    disabled={page === 1}
                                    className="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <span className="sr-only">Previous</span>
                                    <ChevronLeftIcon className="h-5 w-5" aria-hidden="true" />
                                </button>
                                
                                {[...Array(totalPages)].map((_, i) => {
                                    const p = i + 1;
                                    // Show first, last, current, and neighbors
                                    if (p === 1 || p === totalPages || (p >= page - 1 && p <= page + 1)) {
                                        return (
                                            <button
                                                key={p}
                                                onClick={() => setPage(p)}
                                                aria-current={p === page ? 'page' : undefined}
                                                className={`relative inline-flex items-center px-4 py-2 text-sm font-semibold ${
                                                    p === page
                                                        ? 'z-10 bg-indigo-600 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600'
                                                        : 'text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0'
                                                }`}
                                            >
                                                {p}
                                            </button>
                                        );
                                    } else if (p === page - 2 || p === page + 2) {
                                        return <span key={p} className="relative inline-flex items-center px-4 py-2 text-sm font-semibold text-gray-700 ring-1 ring-inset ring-gray-300 focus:outline-offset-0">...</span>;
                                    }
                                    return null;
                                })}

                                <button
                                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                    disabled={page === totalPages}
                                    className="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <span className="sr-only">Next</span>
                                    <ChevronRightIcon className="h-5 w-5" aria-hidden="true" />
                                </button>
                            </nav>
                        </div>
                    </div>
                    {/* Mobile View */}
                    <div className="flex flex-1 justify-between sm:hidden">
                        <button
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page === 1}
                            className="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                        >
                            Previous
                        </button>
                        <button
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                            disabled={page === totalPages}
                            className="relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                        >
                            Next
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
