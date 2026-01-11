'use client';

import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { usePathname, useSearchParams, useRouter } from 'next/navigation';

interface Props {
  total: number;
  currentPage: number;
  pageSize: number;
}

export default function RequisitionPagination({ total, currentPage, pageSize }: Props) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const totalPages = Math.ceil(total / pageSize);
  
  if (total === 0) return null;

  const createPageURL = (pageNumber: number | string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', pageNumber.toString());
    return `${pathname}?${params.toString()}`;
  };

  return (
    <div className="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 sm:px-6 dark:border-gray-700 dark:bg-gray-800 rounded-b-lg">
      <div className="flex flex-1 justify-between sm:hidden">
        <a
          href={currentPage > 1 ? createPageURL(currentPage - 1) : '#'}
          className={`relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 ${currentPage <= 1 ? 'pointer-events-none opacity-50' : ''}`}
        >
          Previous
        </a>
        <a
          href={currentPage < totalPages ? createPageURL(currentPage + 1) : '#'}
          className={`relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 ${currentPage >= totalPages ? 'pointer-events-none opacity-50' : ''}`}
        >
          Next
        </a>
      </div>
      <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-gray-700 dark:text-gray-300">
            Showing <span className="font-medium">{Math.min((currentPage - 1) * pageSize + 1, total)}</span> to{' '}
            <span className="font-medium">{Math.min(currentPage * pageSize, total)}</span> of{' '}
            <span className="font-medium">{total}</span> results
          </p>
        </div>
        <div>
          <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
            <a
              href={currentPage > 1 ? createPageURL(currentPage - 1) : '#'}
              className={`relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 ${currentPage <= 1 ? 'pointer-events-none opacity-50' : ''}`}
            >
              <span className="sr-only">Previous</span>
              <ChevronLeftIcon className="h-5 w-5" aria-hidden="true" />
            </a>
            {/* Simple pagination: show current page and neighbors? For now just prev/next and stats */}
            {/* If we want page numbers, we can add them here. The Quotes one probably has them. 
                I'll keep it simple with Prev/Next buttons for now to match the screenshot "QuotePagination" typically has numbers.
                Let's assume the user wants the numbers too. I'll add a simple range.
            */}
             {[...Array(totalPages)].map((_, i) => {
                const p = i + 1;
                // Show first, last, current, and neighbors
                if (p === 1 || p === totalPages || (p >= currentPage - 1 && p <= currentPage + 1)) {
                     return (
                        <a
                            key={p}
                            href={createPageURL(p)}
                            aria-current={p === currentPage ? 'page' : undefined}
                            className={`relative inline-flex items-center px-4 py-2 text-sm font-semibold ${
                                p === currentPage
                                    ? 'z-10 bg-barmlo-blue text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-barmlo-blue'
                                    : 'text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 dark:text-gray-200 dark:ring-gray-600 dark:hover:bg-gray-700'
                            }`}
                        >
                            {p}
                        </a>
                     );
                } else if (p === currentPage - 2 || p === currentPage + 2) {
                    return <span key={p} className="relative inline-flex items-center px-4 py-2 text-sm font-semibold text-gray-700 ring-1 ring-inset ring-gray-300 focus:outline-offset-0">...</span>;
                }
                return null;
             })}

            <a
              href={currentPage < totalPages ? createPageURL(currentPage + 1) : '#'}
              className={`relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 ${currentPage >= totalPages ? 'pointer-events-none opacity-50' : ''}`}
            >
              <span className="sr-only">Next</span>
              <ChevronRightIcon className="h-5 w-5" aria-hidden="true" />
            </a>
          </nav>
        </div>
      </div>
    </div>
  );
}
