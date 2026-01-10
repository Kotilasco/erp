'use client';

import { useRouter, useSearchParams } from 'next/navigation';

export function DispatchFilter({ role }: { role?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentStatus = searchParams.get('status') || (role === 'SECURITY' || role === 'DRIVER' ? 'APPROVED' : 'AWAITING');

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm font-medium text-gray-700">Filter:</span>
      <input
        type="text"
        placeholder="Search Project (BM...)"
        defaultValue={searchParams.get('search') ?? ''}
        onChange={(e) => {
          const val = e.target.value;
          const params = new URLSearchParams(searchParams);
          if (val) {
            params.set('search', val);
          } else {
            params.delete('search');
          }
          router.push(`?${params.toString()}`);
        }}
        className="block w-48 rounded-md border-gray-300 py-1.5 text-base focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
      />
      <select
        value={currentStatus}
        onChange={(e) => {
          const params = new URLSearchParams(searchParams);
          if (e.target.value) {
            params.set('status', e.target.value);
          } else {
            params.delete('status');
          }
          router.push(`?${params.toString()}`);
        }}
        className="block w-48 rounded-md border-gray-300 py-1.5 text-base focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
      >
        {role !== 'SECURITY' && (
          <>
            <option value="AWAITING">Ready to Dispatch</option>
            <option value="ALL">All Dispatches</option>
            <option value="DRAFT">Draft</option>
            <option value="SUBMITTED">Submitted</option>
          </>
        )}
        <option value="APPROVED">Approved</option>
        <option value="DISPATCHED">Dispatched / En Route</option>
        <option value="DELIVERED">Delivered</option>
      </select>
    </div>
  );
}
