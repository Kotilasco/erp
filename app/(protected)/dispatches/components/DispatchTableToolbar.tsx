'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useState, useTransition, useEffect } from 'react';
import { MagnifyingGlassIcon, ArrowPathIcon } from '@heroicons/react/24/outline';

export default function DispatchTableToolbar({ role, hideStatusFilter = false }: { role?: string; hideStatusFilter?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  // Determine default status based on logic in original DispatchFilter/page
  const defaultStatus = (role === 'SECURITY' || role === 'DRIVER') ? 'APPROVED' : 'READY';

  const [status, setStatus] = useState(searchParams.get('status') ?? defaultStatus);
  const [search, setSearch] = useState(searchParams.get('search') ?? '');
  const [pageSize, setPageSize] = useState(searchParams.get('pageSize') ?? '20');

  // Sync state with URL params
  useEffect(() => {
    setStatus(searchParams.get('status') ?? defaultStatus);
    setSearch(searchParams.get('search') ?? '');
    setPageSize(searchParams.get('pageSize') ?? '20');
  }, [searchParams, defaultStatus]);

  const handleSearch = () => {
    const params = new URLSearchParams(searchParams.toString());
    
    if (search) params.set('search', search);
    else params.delete('search');
    
    if (status) params.set('status', status);
    else params.delete('status');

    if (pageSize) params.set('pageSize', pageSize);
    else params.delete('pageSize');

    params.set('page', '1');

    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  };

  const handleReset = () => {
    setSearch('');
    setStatus(defaultStatus);
    setPageSize('20');
    startTransition(() => {
        const params = new URLSearchParams(searchParams.toString());
        // Reset to minimal params
        const newParams = new URLSearchParams();
        if (defaultStatus !== 'READY') {
            newParams.set('status', defaultStatus);
        }
        router.push(`${pathname}?${newParams.toString()}`);
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg bg-blue-50 p-2 dark:bg-gray-800 border border-blue-100 dark:border-gray-700 mb-4">
      
      <div className="flex items-center gap-2">
         <span className="bg-barmlo-blue text-white px-2 py-1 rounded text-xs font-bold shadow-sm">Show</span>
         <select
            value={pageSize}
            onChange={(e) => {
                setPageSize(e.target.value);
                const params = new URLSearchParams(searchParams.toString());
                params.set('pageSize', e.target.value);
                params.set('page', '1');
                startTransition(() => {
                    router.push(`${pathname}?${params.toString()}`);
                });
            }}
            className="rounded border-gray-300 py-1 text-sm focus:border-barmlo-blue focus:ring-barmlo-blue dark:bg-gray-700 dark:border-gray-600 shadow-sm"
         >
            <option value="10">10</option>
            <option value="20">20</option>
            <option value="50">50</option>
            <option value="100">100</option>
         </select>
      </div>

      {!hideStatusFilter && (
      <div className="flex items-center gap-2">
         <span className="bg-barmlo-blue text-white px-2 py-1 rounded text-xs font-bold shadow-sm">Status</span>
         <select
            value={status}
            onChange={(e) => {
                setStatus(e.target.value);
                // Auto-submit on select change for convenience
                const params = new URLSearchParams(searchParams.toString());
                if (e.target.value) params.set('status', e.target.value);
                else params.delete('status');
                startTransition(() => {
                    router.push(`${pathname}?${params.toString()}`);
                });
            }}
            className="rounded border-gray-300 py-1 text-sm focus:border-barmlo-blue focus:ring-barmlo-blue dark:bg-gray-700 dark:border-gray-600 min-w-[150px] shadow-sm"
         >
            {role !== 'SECURITY' && (
              <>
                <option value="READY">Ready to Dispatch</option>
                <option value="ALL">All Dispatches</option>
                <option value="DRAFT">Draft</option>
                <option value="SUBMITTED">Submitted</option>
              </>
            )}
            <option value="APPROVED">Approved</option>
            <option value="DISPATCHED">Dispatched / En Route</option>
            <option value="IN_TRANSIT">In Transit</option>
            <option value="DELIVERED">Delivered</option>
         </select>
      </div>
      )}

      <div className="flex items-center gap-2">
        <div className="relative">
            <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search Project / Customer..."
                className="h-8 w-[200px] lg:w-[300px] rounded border-gray-300 py-1 pl-8 text-sm focus:border-barmlo-blue focus:ring-barmlo-blue dark:bg-gray-700 dark:border-gray-600 shadow-sm"
                onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSearch();
                }}
            />
            <MagnifyingGlassIcon className="absolute left-2.5 top-1.5 h-4 w-4 text-gray-400" />
        </div>
        <button
            onClick={handleSearch}
            disabled={isPending}
            className="rounded bg-barmlo-blue px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-blue-600 disabled:opacity-50"
        >
            {isPending ? '...' : 'Search'}
        </button>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <button
            onClick={handleReset}
            className="flex items-center gap-1 rounded border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-600"
        >
            <ArrowPathIcon className="h-3.5 w-3.5" />
            Reset
        </button>
      </div>
    </div>
  );
}
