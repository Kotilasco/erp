'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useState, useTransition, useEffect } from 'react';
import { MagnifyingGlassIcon, ArrowPathIcon } from '@heroicons/react/24/outline';

export default function InventoryTableToolbar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [search, setSearch] = useState(searchParams.get('q') ?? '');
  const [pageSize, setPageSize] = useState(searchParams.get('pageSize') ?? '20');

  // Sync state with URL params
  useEffect(() => {
    setSearch(searchParams.get('q') ?? '');
    setPageSize(searchParams.get('pageSize') ?? '20');
  }, [searchParams]);

  const handleSearch = () => {
    const params = new URLSearchParams(searchParams.toString());
    
    if (search) params.set('q', search);
    else params.delete('q');

    if (pageSize) params.set('pageSize', pageSize);
    else params.delete('pageSize');

    params.set('page', '1');

    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  };

  const handleReset = () => {
    setSearch('');
    setPageSize('20');
    startTransition(() => {
        router.push(pathname);
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

      <div className="flex flex-1 items-center gap-2 min-w-[200px]">
        <div className="relative flex-1">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <MagnifyingGlassIcon className="h-4 w-4 text-gray-400" />
            </div>
            <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Search Inventory..."
                className="block w-full rounded border-gray-300 pl-10 py-1 text-sm focus:border-barmlo-blue focus:ring-barmlo-blue dark:bg-gray-700 dark:border-gray-600 shadow-sm"
            />
        </div>
        <button
            onClick={handleSearch}
            disabled={isPending}
            className="flex items-center gap-1 rounded bg-barmlo-blue/10 px-3 py-1 text-sm font-bold text-barmlo-blue hover:bg-barmlo-blue/20 dark:bg-blue-900/50 dark:text-blue-300 shadow-sm border border-barmlo-blue/20 dark:border-blue-800"
        >
            <MagnifyingGlassIcon className="h-4 w-4" />
            Search
        </button>
        <button
            onClick={handleReset}
            disabled={isPending}
            className="flex items-center gap-1 rounded bg-white px-3 py-1 text-sm font-medium text-gray-700 hover:bg-barmlo-orange/10 dark:bg-gray-700 dark:text-gray-300 shadow-sm border border-barmlo-orange dark:border-gray-600 hover:text-barmlo-orange transition-colors"
        >
            <ArrowPathIcon className="h-4 w-4 text-barmlo-orange" />
            Reset
        </button>
      </div>
    </div>
  );
}
