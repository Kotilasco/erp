'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Money from '@/components/Money';
import { verifyMultipleGRNs } from './actions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

import { 
  ClipboardDocumentCheckIcon, 
  TruckIcon, 
  DocumentTextIcon, 
  ChevronLeftIcon, 
  ChevronRightIcon,
  CheckCircleIcon,
  XCircleIcon,
  CubeIcon,
  CurrencyDollarIcon,
  ArchiveBoxIcon
} from '@heroicons/react/24/outline';

interface VerifyPoGrnsFormProps {
  poId: string;
  verifierId: string;
  items: Array<{
    grnId: string;
    grnItemId: string;
    description: string;
    qtyDelivered: number;
    priceMinor: number;
    varianceMinor: number;
    receiptNumber: string;
    vendorName: string;
    receivedAt: string;
  }>;
}

export default function VerifyPoGrnsForm({
  items,
  verifierId,
}: VerifyPoGrnsFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  // Local state for accepted quantities (default to delivered qty)
  const [inputs, setInputs] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    items.forEach((item) => {
      initial[item.grnItemId] = String(item.qtyDelivered);
    });
    return initial;
  });

  const handleAcceptChange = (itemId: string, val: string) => {
    // Allow empty string or valid number
    if (val === '' || !isNaN(parseFloat(val))) {
      setInputs((prev) => ({ ...prev, [itemId]: val }));
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);

    // Prepare payload
    const payload = items.map((item) => {
      const valStr = inputs[item.grnItemId] ?? String(item.qtyDelivered);
      const accepted = valStr === '' ? 0 : parseFloat(valStr);
      
      const finalAccepted = Math.max(0, Math.min(item.qtyDelivered, accepted));
      const rejected = Math.max(0, item.qtyDelivered - finalAccepted);

      return {
        grnId: item.grnId,
        grnItemId: item.grnItemId,
        qtyAccepted: finalAccepted,
        qtyRejected: rejected,
      };
    });

    try {
      await verifyMultipleGRNs(payload, verifierId);
      router.push('/accounts?tab=receipts');
      router.refresh();
    } catch (e: any) {
      console.error(e);
      setError(e.message || 'Failed to verify items');
      setLoading(false);
    }
  };

  // Pagination Logic
  const totalPages = Math.ceil(items.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  // Use slice for display, but keep all items in state
  const visibleItems = items.slice(startIndex, startIndex + itemsPerPage);

  return (
    <Card className="border border-gray-200 bg-white shadow-sm overflow-hidden">
      <CardContent className="p-0">
        {error && (
            <div className="m-4 rounded-md bg-red-50 p-4 text-sm text-red-700 border border-red-100">
            {error}
            </div>
        )}

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
                const valStr = inputs[item.grnItemId] ?? String(item.qtyDelivered);
                const acceptedNum = valStr === '' ? 0 : parseFloat(valStr);
                const rejected = Math.max(0, item.qtyDelivered - acceptedNum);

                return (
                    <tr key={item.grnItemId} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4 font-medium text-gray-900">
                        {item.description}
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                        <div className="flex flex-col">
                            <span className="font-medium text-gray-900">{item.vendorName}</span>
                            <span className="text-xs text-gray-500 flex items-center gap-1">
                                <DocumentTextIcon className="h-3 w-3" />
                                {item.receiptNumber}
                            </span>
                        </div>
                    </td>
                    <td className="px-6 py-4 text-right text-gray-600 font-medium">{item.qtyDelivered}</td>
                    <td className="px-6 py-4 text-right text-gray-600">
                        <Money minor={BigInt(item.priceMinor)} />
                    </td>
                    <td className="px-6 py-4 text-right">
                        <input
                        type="number"
                        className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-right text-sm font-medium shadow-sm transition-all focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none hover:border-emerald-400"
                        value={valStr}
                        onChange={(e) => handleAcceptChange(item.grnItemId, e.target.value)}
                        min={0}
                        max={item.qtyDelivered}
                        />
                    </td>
                    <td className="px-6 py-4 text-right">
                         <input
                            readOnly
                            value={rejected}
                            className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-right text-sm font-medium shadow-sm bg-red-50/10 text-red-600 focus:outline-none"
                        />
                    </td>
                    </tr>
                );
                })}
            </tbody>
            </table>
        </div>

        <div className="bg-gray-50/50 border-t border-gray-200 p-4 flex flex-col gap-4">
             {/* Pagination Controls */}
             <div className="w-full flex items-center justify-center">
                {totalPages > 1 && (
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
                )}
             </div>

             <div className="w-full">
                <button 
                    type="button"
                    onClick={handleSubmit}
                    disabled={loading}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-lg text-sm font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-emerald-600 text-white shadow-md hover:bg-emerald-700 hover:shadow-lg hover:-translate-y-0.5 h-10 px-6 py-2"
                >
                  {loading && (
                    <svg
                      className="h-4 w-4 animate-spin text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                  )}
                  {loading ? 'Capturing...' : 'Capture'}
                </button>
             </div>
        </div>
      </CardContent>
    </Card>
  );
}
