'use client';

import { useState } from 'react';
import Money from '@/components/Money';
import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline';

interface CollapsibleOrderItemsProps {
  items: Array<{
    id: string;
    description: string;
    qty: number;
    unit?: string | null;
    unitPriceMinor: bigint | number; // Accept both for flexibility
    totalMinor: bigint | number;
    quoteLine?: {
      product?: {
        sku?: string | null;
      } | null;
    } | null;
  }>;
  totalMinor: bigint | number;
}

export default function CollapsibleOrderItems({ items, totalMinor }: CollapsibleOrderItemsProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="mt-8 border rounded-lg overflow-hidden bg-white shadow-sm">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-6 py-4 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
      >
        <h2 className="text-lg font-bold text-gray-900 uppercase">Order Items</h2>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span>{items.length} Items</span>
          {isOpen ? (
            <ChevronUpIcon className="h-5 w-5" />
          ) : (
            <ChevronDownIcon className="h-5 w-5" />
          )}
        </div>
      </button>

      {isOpen && (
        <div className="px-6 pb-6 pt-2 border-t border-gray-100">
            <table className="min-w-full divide-y divide-gray-300">
            <thead>
                <tr>
                <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-0">
                    Description
                </th>
                <th scope="col" className="px-3 py-3.5 text-right text-sm font-semibold text-gray-900">
                    Qty
                </th>
                <th scope="col" className="px-3 py-3.5 text-right text-sm font-semibold text-gray-900">
                    Unit Price
                </th>
                <th scope="col" className="px-3 py-3.5 text-right text-sm font-semibold text-gray-900">
                    Amount
                </th>
                </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
                {items.map((item) => (
                <tr key={item.id}>
                    <td className="py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-0">
                    {item.description}
                    {item.quoteLine?.product?.sku && (
                        <span className="block font-normal text-gray-500 text-xs">SKU: {item.quoteLine.product.sku}</span>
                    )}
                    </td>
                    <td className="px-3 py-4 text-right text-sm text-gray-500">
                    {item.qty} {item.unit}
                    </td>
                    <td className="px-3 py-4 text-right text-sm text-gray-500">
                    <Money minor={BigInt(item.unitPriceMinor)} />
                    </td>
                    <td className="px-3 py-4 text-right text-sm text-gray-500">
                    <Money minor={BigInt(item.totalMinor)} />
                    </td>
                </tr>
                ))}
            </tbody>
            <tfoot>
                <tr>
                <th scope="row" colSpan={3} className="hidden pl-4 pr-3 pt-6 text-right text-sm font-semibold text-gray-900 sm:table-cell sm:pl-0">
                    Total
                </th>
                <td className="pl-3 pr-4 pt-6 text-right text-sm font-semibold text-gray-900 sm:pr-0">
                    <Money minor={BigInt(totalMinor)} />
                </td>
                </tr>
            </tfoot>
            </table>
        </div>
      )}
    </div>
  );
}
