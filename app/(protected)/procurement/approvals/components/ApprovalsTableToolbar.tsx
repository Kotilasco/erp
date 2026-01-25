'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useState, useTransition, useEffect } from 'react';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';

export default function ApprovalsTableToolbar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [pageSize, setPageSize] = useState(searchParams.get('pageSize') ?? '20');
  const [search, setSearch] = useState(searchParams.get('q') ?? '');

  useEffect(() => {
    setPageSize(searchParams.get('pageSize') ?? '20');
    setSearch(searchParams.get('q') ?? '');
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

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-t-xl bg-white p-4 border-b border-gray-200">
        <div className="flex items-center gap-2">
            <span className="bg-barmlo-blue text-white px-2 py-1 rounded text-xs font-bold shadow-sm">Show</span>
            <select
                value={pageSize}
                onChange={(e) => {
                    setPageSize(e.target.value);
                    const params = new URLSearchParams(searchParams.toString());
                    params.set('pageSize', e.target.value);
                    params.set('page', '1');
                    router.push(`${pathname}?${params.toString()}`);
                }}
                className="block w-full rounded-md border-0 py-1.5 pl-3 pr-10 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-barmlo-blue sm:text-sm sm:leading-6"
            >
                <option value="10">10</option>
                <option value="20">20</option>
                <option value="50">50</option>
                <option value="100">100</option>
            </select>
        </div>

        <div className="relative flex-grow max-w-md">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />
            </div>
            <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                onBlur={handleSearch}
                className="block w-full rounded-md border-0 py-1.5 pl-10 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-barmlo-blue sm:text-sm sm:leading-6"
                placeholder="Search projects, items, requesters..."
            />
        </div>
    </div>
  );
}
