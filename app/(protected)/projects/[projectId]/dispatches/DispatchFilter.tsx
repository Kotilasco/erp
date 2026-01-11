'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { MagnifyingGlassIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import { useState, useTransition } from 'react';

export default function DispatchFilter() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const { replace } = useRouter();
  const [isPending, startTransition] = useTransition();

  const [searchTerm, setSearchTerm] = useState(searchParams.get('q')?.toString() || '');

  function handleSearch(term: string) {
    const params = new URLSearchParams(searchParams);
    if (term) {
      params.set('q', term);
    } else {
      params.delete('q');
    }
    // Reset page to 1 when searching (if pagination exists)
    // params.set('page', '1');
    
    startTransition(() => {
      replace(`${pathname}?${params.toString()}`);
    });
  }

  function handleFilterChange(key: string, value: string) {
    const params = new URLSearchParams(searchParams);
    if (value && value !== 'All' && value !== '') {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.delete('page'); // Reset pagination
    startTransition(() => {
      replace(`${pathname}?${params.toString()}`);
    });
  }

  function handleReset() {
    setSearchTerm('');
    startTransition(() => {
        replace(`${pathname}`);
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg bg-blue-50 p-2 dark:bg-gray-800 border border-blue-100 dark:border-gray-700 mb-4">
      
      <div className="flex items-center gap-2">
         <span className="bg-blue-600 text-white px-2 py-1 rounded text-xs font-bold shadow-sm">Show</span>
         <select
            defaultValue={searchParams.get('pageSize') || '20'}
            onChange={(e) => handleFilterChange('pageSize', e.target.value)}
            className="rounded border-gray-300 py-1 text-sm focus:border-blue-600 focus:ring-blue-600 dark:bg-gray-700 dark:border-gray-600 shadow-sm"
         >
            <option value="20">20</option>
            <option value="50">50</option>
            <option value="100">100</option>
         </select>
      </div>

      <div className="flex items-center gap-2">
         <span className="bg-blue-600 text-white px-2 py-1 rounded text-xs font-bold shadow-sm">Status</span>
         <select
            defaultValue={searchParams.get('status') || ''}
            onChange={(e) => handleFilterChange('status', e.target.value)}
            className="rounded border-gray-300 py-1 text-sm focus:border-blue-600 focus:ring-blue-600 dark:bg-gray-700 dark:border-gray-600 min-w-[150px] shadow-sm"
         >
            <option value="">All Statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="APPROVED">Approved</option>
            <option value="SUBMITTED">Submitted</option>
         </select>
      </div>

      <div className="flex flex-1 items-center gap-2 min-w-[200px]">
        <div className="relative flex-1">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <MagnifyingGlassIcon className="h-4 w-4 text-gray-400" />
            </div>
            <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch(searchTerm)}
                placeholder="Search project, customer..."
                className="block w-full rounded border-gray-300 pl-10 py-1 text-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 shadow-sm"
            />
        </div>
        <button
            onClick={() => handleSearch(searchTerm)}
            disabled={isPending}
            className="flex items-center gap-1 rounded bg-barmlo-blue/10 px-3 py-1 text-sm font-bold text-barmlo-blue hover:bg-barmlo-blue/20 dark:bg-blue-900/50 dark:text-blue-300 shadow-sm border border-barmlo-blue/20 dark:border-blue-800"
        >
            <MagnifyingGlassIcon className="h-4 w-4" />
            Search
        </button>
        <button
            onClick={handleReset}
            disabled={isPending}
            className="flex items-center gap-1 rounded bg-white px-3 py-1 text-sm font-medium text-barmlo-orange hover:bg-barmlo-orange/10 dark:bg-gray-700 dark:text-gray-300 shadow-sm border border-barmlo-orange dark:border-gray-600 transition-colors"
        >
            <ArrowPathIcon className="h-4 w-4 text-barmlo-orange" />
            Reset
        </button>
      </div>
    </div>
  );
}
