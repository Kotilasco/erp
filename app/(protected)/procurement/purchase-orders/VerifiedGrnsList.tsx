'use client';

import { useState } from 'react';
import Money from '@/components/Money';
import { Card, CardContent } from '@/components/ui/card';
import { 
  TruckIcon, 
  DocumentTextIcon, 
  ChevronLeftIcon, 
  ChevronRightIcon,
  CheckCircleIcon,
  XCircleIcon,
  CubeIcon,
  CurrencyDollarIcon,
  ArchiveBoxIcon,
  CalendarDaysIcon
} from '@heroicons/react/24/outline';
import { formatDateTime } from '@/lib/format';

interface VerifiedGrnsListProps {
  items: Array<{
    grnId: string;
    grnItemId: string;
    description: string;
    qtyDelivered: number;
    qtyAccepted: number;
    qtyRejected: number;
    priceMinor: number;
    varianceMinor: number;
    receiptNumber: string;
    vendorName: string;
    receivedAt: string;
    receivedBy: string;
  }>;
}

export default function VerifiedGrnsList({
  items,
}: VerifiedGrnsListProps) {
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  // Pagination Logic
  const totalPages = Math.ceil(items.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const visibleItems = items.slice(startIndex, startIndex + itemsPerPage);

  if (items.length === 0) return null;

  return (
    <Card className="border border-gray-200 bg-white shadow-sm overflow-hidden mb-8">
      <CardContent className="p-0">
        <div className="overflow-x-auto">
            <table className="w-full text-sm divide-y divide-gray-200">
            <thead className="bg-gray-50/80">
                <tr>
                <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-500">
                    <div className="flex items-center gap-1">
                        <CubeIcon className="h-4 w-4" />
                        Item
                    </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-500">
                    <div className="flex items-center gap-1">
                        <TruckIcon className="h-4 w-4" />
                        Supplier / Receipt
                    </div>
                </th>
                <th className="px-6 py-3 text-right text-xs font-bold uppercase tracking-wider text-gray-500">
                    <div className="flex items-center justify-end gap-1">
                        <ArchiveBoxIcon className="h-4 w-4" />
                        Delivered
                    </div>
                </th>
                <th className="px-6 py-3 text-right text-xs font-bold uppercase tracking-wider text-gray-500">
                    <div className="flex items-center justify-end gap-1">
                        <CurrencyDollarIcon className="h-4 w-4" />
                        Price
                    </div>
                </th>
                <th className="px-6 py-3 text-right text-xs font-bold uppercase tracking-wider text-gray-500 w-32">
                    <div className="flex items-center justify-end gap-1">
                        <CheckCircleIcon className="h-4 w-4" />
                        Accepted
                    </div>
                </th>
                <th className="px-6 py-3 text-right text-xs font-bold uppercase tracking-wider text-gray-500 w-32">
                    <div className="flex items-center justify-end gap-1">
                        <XCircleIcon className="h-4 w-4" />
                        Rejected
                    </div>
                </th>
                </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
                {visibleItems.map((item) => {
                return (
                    <tr key={item.grnItemId} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4 font-medium text-gray-900">
                        {item.description}
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                        <div className="flex flex-col gap-1">
                            <span className="font-medium text-gray-900">{item.vendorName}</span>
                            <span className="text-xs text-gray-500 flex items-center gap-1">
                                <DocumentTextIcon className="h-3 w-3" />
                                {item.receiptNumber}
                            </span>
                            <span className="text-xs text-gray-400 flex items-center gap-1">
                                <CalendarDaysIcon className="h-3 w-3" />
                                {formatDateTime(item.receivedAt)}
                            </span>
                        </div>
                    </td>
                    <td className="px-6 py-4 text-right text-gray-600 font-medium">{item.qtyDelivered}</td>
                    <td className="px-6 py-4 text-right text-gray-600">
                        <Money minor={BigInt(item.priceMinor)} />
                    </td>
                    <td className="px-6 py-4 text-right text-emerald-600 font-bold bg-emerald-50/10">
                        {item.qtyAccepted}
                    </td>
                    <td className="px-6 py-4 text-right text-red-600 font-bold bg-red-50/10">
                        {item.qtyRejected}
                    </td>
                    </tr>
                );
                })}
            </tbody>
            </table>
        </div>

        {totalPages > 1 && (
            <div className="bg-gray-50/50 border-t border-gray-200 p-4 flex items-center justify-center">
                <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                    <button
                        type="button"
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <span className="sr-only">Previous</span>
                        <ChevronLeftIcon className="h-5 w-5" aria-hidden="true" />
                    </button>
                    <span className="relative inline-flex items-center px-4 py-2 text-sm font-semibold text-gray-900 ring-1 ring-inset ring-gray-300 focus:outline-offset-0 bg-white">
                        Page {currentPage} of {totalPages}
                    </span>
                    <button
                        type="button"
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <span className="sr-only">Next</span>
                        <ChevronRightIcon className="h-5 w-5" aria-hidden="true" />
                    </button>
                </nav>
            </div>
        )}
      </CardContent>
    </Card>
  );
}
