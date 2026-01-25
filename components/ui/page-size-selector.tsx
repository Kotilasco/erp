'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';

interface PageSizeSelectorProps {
  defaultValue?: string;
  options?: number[];
}

export function PageSizeSelector({ defaultValue = '10', options = [10, 20, 50, 100] }: PageSizeSelectorProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const currentSize = searchParams.get('pageSize') || defaultValue;

  const handleChange = (newSize: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('pageSize', newSize);
    params.set('page', '1'); // Reset to page 1 when changing page size

    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`);
    });
  };

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-gray-500 whitespace-nowrap">Show</span>
      <select
        value={currentSize}
        onChange={(e) => handleChange(e.target.value)}
        disabled={isPending}
        className="h-9 rounded-md border-gray-200 text-sm focus:border-indigo-500 focus:ring-indigo-500 bg-gray-50 hover:bg-white transition-colors cursor-pointer shadow-sm"
      >
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </div>
  );
}
