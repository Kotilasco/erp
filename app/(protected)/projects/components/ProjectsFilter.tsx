'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useTransition } from 'react';

export function ProjectsFilter() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const currentStatus = searchParams.get('status') || '';
  const currentDate = searchParams.get('start_date') || '';

  const handleFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    // Reset page on filter change
    params.delete('page');
    
    startTransition(() => {
      router.push(`?${params.toString()}`);
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-gray-500 uppercase">Status</label>
        <select
          value={currentStatus}
          onChange={(e) => handleFilter('status', e.target.value)}
          disabled={isPending}
          className="h-9 rounded-md border-gray-300 shadow-sm focus:border-orange-500 focus:ring-orange-500 sm:text-sm"
        >
          <option value="">All Statuses</option>
          <option value="PLANNED">Planned</option>
          <option value="ONGOING">Ongoing</option>
          <option value="COMPLETED">Completed</option>
          <option value="CLOSED">Closed</option>
          <option value="CREATED">Created</option>
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-gray-500 uppercase">Started After</label>
        <input
          type="date"
          value={currentDate}
          onChange={(e) => handleFilter('start_date', e.target.value)}
          disabled={isPending}
          className="h-9 rounded-md border-gray-300 shadow-sm focus:border-orange-500 focus:ring-orange-500 sm:text-sm"
        />
      </div>
      
      {isPending && <span className="text-xs text-gray-400 mt-5">Updating...</span>}
    </div>
  );
}
