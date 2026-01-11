'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useState, useTransition, useEffect } from 'react';
import { MagnifyingGlassIcon, ArrowPathIcon } from '@heroicons/react/24/outline';

export default function ProjectTableToolbar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [pageSize, setPageSize] = useState(searchParams.get('pageSize') ?? '20');
  const [status, setStatus] = useState(searchParams.get('status') ?? '');
  const [startDate, setStartDate] = useState(searchParams.get('start_date') ?? '');
  const [search, setSearch] = useState(searchParams.get('q') ?? '');

  // Sync state with URL params
  useEffect(() => {
    setPageSize(searchParams.get('pageSize') ?? '20');
    setStatus(searchParams.get('status') ?? '');
    setStartDate(searchParams.get('start_date') ?? '');
    setSearch(searchParams.get('q') ?? '');
  }, [searchParams]);

  const handleSearch = () => {
    const params = new URLSearchParams(searchParams.toString());
    if (search) params.set('q', search);
    else params.delete('q');
    
    if (status) params.set('status', status);
    else params.delete('status');

    if (startDate) params.set('start_date', startDate);
    else params.delete('start_date');

    if (pageSize) params.set('pageSize', pageSize);
    else params.delete('pageSize');

    params.set('page', '1');

    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  };

  const handleReset = () => {
    setSearch('');
    setStatus('');
    setStartDate('');
    setPageSize('20');
    startTransition(() => {
        const params = new URLSearchParams(searchParams.toString());
        // Preserve tab if exists
        const tab = params.get('tab');
        if (tab) {
            router.push(`${pathname}?tab=${tab}`);
        } else {
            router.push(pathname);
        }
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

      <div className="flex items-center gap-2">
         <span className="bg-barmlo-blue text-white px-2 py-1 rounded text-xs font-bold shadow-sm">Status</span>
         <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded border-gray-300 py-1 text-sm focus:border-barmlo-blue focus:ring-barmlo-blue dark:bg-gray-700 dark:border-gray-600 min-w-[150px] shadow-sm"
         >
            <option value="">All Statuses</option>
            <option value="PLANNED">Planned</option>
            <option value="ONGOING">Ongoing</option>
            <option value="COMPLETED">Completed</option>
            <option value="CLOSED">Closed</option>
            <option value="CREATED">Created</option>
         </select>
      </div>

      <div className="flex items-center gap-2">
         <span className="bg-barmlo-blue text-white px-2 py-1 rounded text-xs font-bold shadow-sm">From</span>
         <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="rounded border-gray-300 py-1 text-sm focus:border-barmlo-blue focus:ring-barmlo-blue dark:bg-gray-700 dark:border-gray-600 shadow-sm"
         />
      </div>

      <div className="flex flex-1 items-center gap-2 min-w-[200px]">
        <div className="relative flex-1">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />
            </div>
            <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="block w-full rounded-md border-0 py-1.5 pl-10 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-barmlo-blue sm:text-sm sm:leading-6 dark:bg-gray-700 dark:text-white dark:ring-gray-600"
                placeholder="Search projects..."
            />
        </div>
        <button
            onClick={handleSearch}
            disabled={isPending}
            className="inline-flex items-center gap-x-1.5 rounded-md bg-barmlo-blue/10 px-3 py-2 text-sm font-semibold text-barmlo-blue shadow-sm hover:bg-barmlo-blue/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-barmlo-blue"
        >
            Search
        </button>
        <button
            onClick={handleReset}
            disabled={isPending}
            className="inline-flex items-center gap-x-1.5 rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-barmlo-orange hover:bg-gray-50 hover:text-barmlo-orange focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-barmlo-orange dark:bg-gray-700 dark:text-white dark:ring-gray-600"
        >
            <ArrowPathIcon className="-ml-0.5 h-5 w-5" aria-hidden="true" />
            Reset
        </button>
      </div>
    </div>
  );
}
