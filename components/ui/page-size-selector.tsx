'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';

export default function PageSizeSelector({
  defaultSize = 10,
  options = [10, 25, 50, 100]
}: {
  defaultSize?: number;
  options?: number[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  
  const currentSize = Number(searchParams.get('pageSize')) || defaultSize;

  const handleSizeChange = (newSize: string) => {
    const params = new URLSearchParams(searchParams);
    params.set('pageSize', newSize);
    params.set('page', '1'); // Reset to first page when changing size
    router.replace(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="pageSize" className="text-sm font-medium text-gray-700">
        Show
      </label>
      <select
        id="pageSize"
        value={currentSize}
        onChange={(e) => handleSizeChange(e.target.value)}
        className="h-9 rounded-md border-gray-300 text-sm focus:border-indigo-500 focus:ring-indigo-500 py-1 pl-2 pr-8 shadow-sm cursor-pointer"
      >
        {options.map((size) => (
          <option key={size} value={size}>
            {size}
          </option>
        ))}
      </select>
      <span className="text-sm text-gray-500">entries</span>
    </div>
  );
}
