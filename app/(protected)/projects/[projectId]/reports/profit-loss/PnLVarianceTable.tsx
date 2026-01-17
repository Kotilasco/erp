"use client";

import { useMemo, useState } from "react";
import Money from "@/components/Money";
import { VarianceItem } from '@/lib/profit-loss';
import { 
  ArrowTrendingUpIcon, 
  ArrowTrendingDownIcon, 
  FunnelIcon,
  ChevronLeftIcon,
  ChevronRightIcon
} from '@heroicons/react/24/outline';

type FilterType = 'ALL' | 'PROFIT' | 'LOSS';

export default function PnLVarianceTable({ 
  title, 
  description, 
  items 
}: { 
  title: string; 
  description: string; 
  items: VarianceItem[] 
}) {
  const [filter, setFilter] = useState<FilterType>('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8; // User asked for pagination, 8 fits well.

  // 1. Filter
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      if (filter === 'ALL') return true;
      if (filter === 'PROFIT') return item.varianceMinor >= 0;
      if (filter === 'LOSS') return item.varianceMinor < 0;
      return true;
    });
  }, [items, filter]);

  // 2. Paginate
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / itemsPerPage));
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredItems.slice(start, start + itemsPerPage);
  }, [filteredItems, currentPage, itemsPerPage]);

  // Reset page on filter change
  if (currentPage > totalPages) setCurrentPage(1);

  if (items.length === 0) return null;

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm mb-6">
      {/* Header with Controls */}
      <div className="border-b border-gray-100 bg-gray-50/50 px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
           <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold text-gray-900">{title}</h3>
              <span className="inline-flex items-center rounded-md bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600 ring-1 ring-inset ring-gray-500/10">
                {items.length} Total
              </span>
           </div>
           <p className="text-sm text-gray-500 mt-1">{description}</p>
        </div>

        {/* Filter Controls */}
        <div className="flex items-center gap-2">
            <div className="relative inline-flex shadow-sm rounded-md">
                <button
                    onClick={() => setFilter('ALL')}
                    className={`relative inline-flex items-center rounded-l-md px-3 py-1.5 text-xs font-medium ring-1 ring-inset focus:z-10 ${filter === 'ALL' ? 'bg-indigo-600 text-white ring-indigo-600' : 'bg-white text-gray-900 ring-gray-300 hover:bg-gray-50'}`}
                >
                    All
                </button>
                <button
                    onClick={() => setFilter('LOSS')}
                    className={`relative -ml-px inline-flex items-center px-3 py-1.5 text-xs font-medium ring-1 ring-inset focus:z-10 ${filter === 'LOSS' ? 'bg-rose-600 text-white ring-rose-600' : 'bg-white text-gray-900 ring-gray-300 hover:bg-gray-50'}`}
                >
                    Loss
                </button>
                <button
                    onClick={() => setFilter('PROFIT')}
                    className={`relative -ml-px inline-flex items-center rounded-r-md px-3 py-1.5 text-xs font-medium ring-1 ring-inset focus:z-10 ${filter === 'PROFIT' ? 'bg-emerald-600 text-white ring-emerald-600' : 'bg-white text-gray-900 ring-gray-300 hover:bg-gray-50'}`}
                >
                    Profit
                </button>
            </div>
        </div>
      </div>

      {/* List */}
      <div className="divide-y divide-gray-100 min-h-[100px]">
        {paginatedItems.length === 0 ? (
             <div className="px-6 py-8 text-center text-sm text-gray-500 italic">
                 No items match the selected filter.
             </div>
        ) : (
            paginatedItems.map(item => (
                <div key={item.id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50/50 transition-colors group">
                    <div className="flex-1 pr-4">
                        <div className="font-medium text-gray-900 flex items-center gap-2">
                             {item.category === 'USAGE' && item.varianceMinor < 0 && (
                                <ArrowTrendingDownIcon className="h-4 w-4 text-rose-500" />
                             )}
                             {item.category === 'RETURNS' && (
                                <ArrowTrendingUpIcon className="h-4 w-4 text-emerald-500" />
                             )}
                             {item.description}
                        </div>
                        <div className="text-sm text-gray-500 mt-1 font-mono text-xs">{item.details}</div>
                    </div>
                    <div className="text-right">
                        <div className={`font-mono font-bold text-sm ${item.varianceMinor >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                {item.varianceMinor >= 0 ? '+' : ''}
                                <Money minor={item.varianceMinor} />
                        </div>
                        <div className={`text-[10px] font-semibold uppercase tracking-wider mt-0.5 ${item.varianceMinor >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                            {item.varianceMinor >= 0 ? 'Profit' : 'Loss'}
                        </div>
                    </div>
                </div>
            ))
        )}
      </div>

      {/* Pagination Footer */}
      {filteredItems.length > itemsPerPage && (
          <div className="bg-gray-50 px-6 py-3 border-t border-gray-100 flex items-center justify-between">
              <div className="text-xs text-gray-500">
                  Showing <span className="font-medium">{(currentPage - 1) * itemsPerPage + 1}</span> to <span className="font-medium">{Math.min(currentPage * itemsPerPage, filteredItems.length)}</span> of <span className="font-medium">{filteredItems.length}</span>
              </div>
              <div className="flex space-x-2">
                  <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="relative inline-flex items-center rounded-md bg-white px-2 py-1 text-xs font-semibold text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-10 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                      <ChevronLeftIcon className="h-3 w-3" />
                      Prev
                  </button>
                  <button
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="relative inline-flex items-center rounded-md bg-white px-2 py-1 text-xs font-semibold text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-10 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                      Next
                      <ChevronRightIcon className="h-3 w-3" />
                  </button>
              </div>
          </div>
      )}
    </div>
  );
}
