'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useState, useTransition, useEffect } from 'react';
import { MagnifyingGlassIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import clsx from 'clsx';

interface RequisitionTableToolbarProps {
  currentTab?: string;
}

export default function RequisitionTableToolbar({ currentTab = 'funding_needed' }: RequisitionTableToolbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [pageSize, setPageSize] = useState(searchParams.get('pageSize') ?? '20');
  const [search, setSearch] = useState(searchParams.get('q') ?? '');

  // Sync state with URL params
  useEffect(() => {
    setPageSize(searchParams.get('pageSize') ?? '20');
    setSearch(searchParams.get('q') ?? '');
  }, [searchParams]);

  const handleSearch = () => {
    const params = new URLSearchParams(searchParams.toString());
    if (search) params.set('q', search);
    else params.delete('q');
    
    // Maintain tab
    if (currentTab) params.set('tab', currentTab);

    if (pageSize) params.set('pageSize', pageSize);
    else params.delete('pageSize');

    params.set('page', '1'); 

    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  };

  const handleTabChange = (tab: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set('tab', tab);
      params.set('page', '1');
      startTransition(() => {
          router.push(`${pathname}?${params.toString()}`);
      });
  }

  const handleReset = () => {
    setSearch('');
    setPageSize('20');
    startTransition(() => {
        const params = new URLSearchParams();
        if (currentTab) params.set('tab', currentTab);
        router.push(`${pathname}?${params.toString()}`);
    });
  };

  const tabs = [
      { id: 'funding_needed', label: 'Funding Needed' },
      { id: 'action_purchases', label: 'Action Purchases' },
      { id: 'pending_approval', label: 'Pending Approval' },
      { id: 'my_requests', label: 'My Requests' },
      { id: 'completed', label: 'Completed' },
  ];

  return (
    <div className="space-y-4 mb-6">
        {/* Tabs */}
        <div className="border-b border-gray-200 dark:border-gray-700">
            <nav className="-mb-px flex space-x-8 overflow-x-auto" aria-label="Tabs">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => handleTabChange(tab.id)}
                        className={clsx(
                            tab.id === currentTab
                                ? 'border-barmlo-blue text-barmlo-blue'
                                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300',
                            'whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium'
                        )}
                    >
                        {tab.label}
                    </button>
                ))}
            </nav>
        </div>

        {/* Toolbar Controls */}
        <div className="flex flex-wrap items-center gap-3 rounded-lg bg-blue-50 p-2 dark:bg-gray-800 border border-blue-100 dark:border-gray-700">
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
                        <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />
                    </div>
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                        placeholder="Search requisitions..."
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
