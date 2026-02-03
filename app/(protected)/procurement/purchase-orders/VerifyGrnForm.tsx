'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Money from '@/components/Money';
import SubmitButton from '@/components/SubmitButton';
import { verifyGRN } from './actions';
import { formatDateTime } from '@/lib/format';
import { ClipboardDocumentCheckIcon, TruckIcon, DocumentTextIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';

type GRNItem = {
  id: string;
  description: string;
  qtyDelivered: number;
  priceMinor: number; // passed as number to avoid serialization issues
  varianceMinor: number; // passed as number
};

type Props = {
  grnId: string;
  receivedBy: string;
  receivedAt: string;
  vendorName: string;
  vendorPhone: string;
  receiptNumber: string;
  items: GRNItem[];
  verifierId: string;
};

const ITEMS_PER_PAGE = 5;

export default function VerifyGrnForm({
  grnId,
  receivedBy,
  receivedAt,
  vendorName,
  vendorPhone,
  receiptNumber,
  items,
  verifierId,
}: Props) {
  const [page, setPage] = useState(0);

  const totalPages = Math.ceil(items.length / ITEMS_PER_PAGE);
  const startIdx = page * ITEMS_PER_PAGE;
  const endIdx = startIdx + ITEMS_PER_PAGE;

  return (
    <Card className="border border-gray-200 bg-white shadow-sm overflow-hidden">
      <CardHeader className="bg-gray-50/50 border-b border-gray-100 pb-6">
        <div className="flex items-start md:items-center gap-4">
            <div className="p-3 bg-emerald-100 rounded-xl shadow-sm ring-1 ring-emerald-500/10">
                <ClipboardDocumentCheckIcon className="h-6 w-6 text-emerald-600" />
            </div>
            <div className="flex-1">
                <CardTitle className="text-xl font-bold text-gray-900">Verify GRN <span className="font-mono text-gray-500 font-normal">#{grnId.slice(0, 8)}</span></CardTitle>
                <CardDescription className="mt-1 flex flex-wrap items-center gap-2 text-sm text-gray-500">
                    <span>Received by <span className="font-medium text-gray-900">{receivedBy}</span></span>
                    <span className="hidden sm:inline">•</span>
                    <span>{formatDateTime(receivedAt)}</span>
                </CardDescription>
            </div>
        </div>
        
        <div className="mt-6 flex flex-wrap gap-4 text-sm text-gray-600 bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
            <div className="flex items-center gap-2">
                <TruckIcon className="h-4 w-4 text-gray-400" />
                <span className="font-medium text-gray-900">{vendorName}</span>
            </div>
            <div className="hidden sm:block w-px h-4 bg-gray-200"></div>
            <div className="flex items-center gap-2">
                <span className="text-gray-500">Phone:</span>
                <span className="font-medium">{vendorPhone}</span>
            </div>
            <div className="hidden sm:block w-px h-4 bg-gray-200"></div>
            <div className="flex items-center gap-2">
                <DocumentTextIcon className="h-4 w-4 text-gray-400" />
                <span className="text-gray-500">Receipt:</span>
                <span className="font-mono font-medium text-gray-900 bg-gray-100 px-2 py-0.5 rounded text-xs ring-1 ring-gray-200">{receiptNumber}</span>
            </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <form
          action={async (fd) => {
            // We need to capture values for ALL items, potentially across pages.
            // Since we use `display: none` (hidden class) for off-page items, they ARE in the DOM
            // and their values WILL be submitted.
            const payload = items.map((item) => ({
              grnItemId: item.id,
              qtyAccepted: Number(fd.get(`accepted-${item.id}`) || 0),
              qtyRejected: Number(fd.get(`rejected-${item.id}`) || 0),
            }));

            await verifyGRN(grnId, payload, verifierId);
          }}
          className="space-y-0"
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm divide-y divide-gray-200">
              <thead className="bg-gray-50/80">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-500">Item</th>
                  <th className="px-6 py-3 text-right text-xs font-bold uppercase tracking-wider text-gray-500">Delivered</th>
                  <th className="px-6 py-3 text-right text-xs font-bold uppercase tracking-wider text-gray-500">Price</th>
                  <th className="px-6 py-3 text-right text-xs font-bold uppercase tracking-wider text-gray-500">P&L</th>
                  <th className="px-6 py-3 text-right text-xs font-bold uppercase tracking-wider text-gray-500 w-32">Accepted</th>
                  <th className="px-6 py-3 text-right text-xs font-bold uppercase tracking-wider text-gray-500 w-32">Rejected</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {items.map((item, index) => {
                  const isVisible = index >= startIdx && index < endIdx;
                  return (
                    <tr key={item.id} className={`${isVisible ? '' : 'hidden'} hover:bg-gray-50/50 transition-colors`}>
                      <td className="px-6 py-4 font-medium text-gray-900">{item.description}</td>
                      <td className="px-6 py-4 text-right text-gray-600">{item.qtyDelivered}</td>
                      <td className="px-6 py-4 text-right text-gray-600">
                        {item.priceMinor ? <Money minor={item.priceMinor} /> : '-'}
                      </td>
                      <td
                        className={`px-6 py-4 text-right font-medium ${
                          item.varianceMinor < 0 ? 'text-red-600' : 'text-green-600'
                        }`}
                      >
                        {item.varianceMinor ? <Money minor={item.varianceMinor} /> : '-'}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <input
                          name={`accepted-${item.id}`}
                          type="number"
                          step="0.01"
                          min={0}
                          max={item.qtyDelivered}
                          defaultValue={item.qtyDelivered}
                          className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-right text-sm font-medium shadow-sm transition-all focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none hover:border-emerald-400"
                        />
                      </td>
                      <td className="px-6 py-4 text-right">
                        <input
                          name={`rejected-${item.id}`}
                          type="number"
                          step="0.01"
                          min={0}
                          max={item.qtyDelivered}
                          defaultValue={0}
                          className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-right text-sm font-medium shadow-sm transition-all focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none hover:border-red-400 text-red-600 bg-red-50/10"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="bg-gray-50/50 border-t border-gray-200 p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
             {/* Pagination Controls */}
             <div className="flex-1 flex items-center justify-start">
                {totalPages > 1 && (
                    <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                        <button
                            type="button"
                            onClick={() => setPage((p) => Math.max(0, p - 1))}
                            disabled={page === 0}
                            className="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <span className="sr-only">Previous</span>
                            <ChevronLeftIcon className="h-5 w-5" aria-hidden="true" />
                        </button>
                        <span className="relative inline-flex items-center px-4 py-2 text-sm font-semibold text-gray-900 ring-1 ring-inset ring-gray-300 focus:outline-offset-0 bg-white">
                            Page {page + 1} of {totalPages}
                        </span>
                        <button
                            type="button"
                            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                            disabled={page === totalPages - 1}
                            className="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <span className="sr-only">Next</span>
                            <ChevronRightIcon className="h-5 w-5" aria-hidden="true" />
                        </button>
                    </nav>
                )}
             </div>

             <div className="flex justify-end w-full sm:w-auto">
                <SubmitButton className="inline-flex items-center justify-center gap-2 rounded-lg text-sm font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-emerald-600 text-white shadow-md hover:bg-emerald-700 hover:shadow-lg hover:-translate-y-0.5 h-10 px-6 py-2">
                  <ClipboardDocumentCheckIcon className="h-5 w-5" />
                  Verify & Approve
                </SubmitButton>
             </div>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
