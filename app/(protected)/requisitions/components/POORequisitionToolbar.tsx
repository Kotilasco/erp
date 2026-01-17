
'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useState, useTransition, useEffect } from 'react';
import { MagnifyingGlassIcon, ArrowPathIcon, FunnelIcon } from '@heroicons/react/24/outline';

const STATUS_OPTIONS = [
    { value: 'DRAFT', label: 'Draft' },
    { value: 'SUBMITTED', label: 'Submitted' },
    { value: 'APPROVED', label: 'Approved' },
    { value: 'REJECTED', label: 'Rejected' },
    { value: 'PURCHASED', label: 'Purchased' },
    { value: 'PARTIAL', label: 'Partially Purchased' },
    { value: 'ORDERED', label: 'Ordered' },
    { value: 'COMPLETED', label: 'Completed' },
];

export default function POORequisitionToolbar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [pageSize, setPageSize] = useState(searchParams.get('pageSize') ?? '20');
  const [search, setSearch] = useState(searchParams.get('q') ?? '');
  const [status, setStatus] = useState(searchParams.get('status') ?? '');

  // Sync state with URL params
  useEffect(() => {
    setPageSize(searchParams.get('pageSize') ?? '20');
    setSearch(searchParams.get('q') ?? '');
    setStatus(searchParams.get('status') ?? '');
  }, [searchParams]);

  const handleSearch = () => {
    const params = new URLSearchParams(searchParams.toString());
    
    if (search) params.set('q', search);
    else params.delete('q');

    if (status) params.set('status', status);
    else params.delete('status');

    if (pageSize) params.set('pageSize', pageSize);
    else params.delete('pageSize');

    params.set('page', '1'); 

    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  };

  const handleStatusChange = (newStatus: string) => {
      setStatus(newStatus);
      const params = new URLSearchParams(searchParams.toString());
      if (newStatus) params.set('status', newStatus);
      else params.delete('status');
      params.set('page', '1');
      startTransition(() => {
          router.push(`${pathname}?${params.toString()}`);
      });
  };

  const handleReset = () => {
    setSearch('');
    setStatus('');
    setPageSize('20');
    startTransition(() => {
        router.push(pathname);
    });
  };

  return (
    <div className="space-y-4 mb-6">
        <div className="flex flex-wrap items-center gap-3 rounded-lg bg-blue-50 p-2 dark:bg-gray-800 border border-blue-100 dark:border-gray-700">
            {/* Page Size */}
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

            {/* Status Filter */}
            <div className="flex items-center gap-2">
                <FunnelIcon className="h-5 w-5 text-gray-500" />
                <select
                    value={status}
                    onChange={(e) => handleStatusChange(e.target.value)}
                    className="rounded border-gray-300 py-1 text-sm focus:border-barmlo-blue focus:ring-barmlo-blue dark:bg-gray-700 dark:border-gray-600 shadow-sm min-w-[140px]"
                >
                    <option value="">All Statuses</option>
                    {STATUS_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                </select>
            </div>

            {/* Search Input */}
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
                        placeholder="Search by Ref, Project, or Name..."
                        className="block w-full rounded-md border-0 py-1.5 pl-10 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-barmlo-blue sm:text-sm sm:leading-6 dark:bg-gray-700 dark:text-white dark:ring-gray-600"
                    />
                </div>
                <button
                    onClick={handleSearch}
                    className="rounded bg-barmlo-blue px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                >
                    Search
                </button>
                <button
                    onClick={handleReset}
                    className="rounded bg-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 shadow-sm hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
                    title="Reset Filters"
                >
                    <ArrowPathIcon className="h-4 w-4" />
                </button>
            </div>
        </div>
    </div>
  );
}
