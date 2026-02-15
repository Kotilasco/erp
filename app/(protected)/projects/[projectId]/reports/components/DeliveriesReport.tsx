'use client';

import { useState, Fragment } from 'react';
import { ReportData } from '../actions';
import { formatMoney } from '@/lib/money'; // Assuming this exists or using Intl
import TablePagination from '@/components/ui/table-pagination';

function formatCurrency(amount: number) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD', // Default to USD for now, strictly
    }).format(amount);
}

export default function DeliveriesReport({ data, disablePagination = false }: { data: ReportData; disablePagination?: boolean }) {
    const { deliveries } = data;
    const [currentPage, setCurrentPage] = useState(1);
    const pageSize = 20;

    // Filter logic
    const items = deliveries; 
    const totalDelivered = items.reduce((sum, item) => sum + item.totalAmount, 0);

    const currentItems = disablePagination ? items : items.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
            <h2 className="text-lg font-bold text-gray-900">Deliveries Report</h2>
            <p className="text-sm text-gray-500">Summary of all materials dispatched to site vs consumed.</p>
        </div>
        <div className="text-right">
            <p className="text-xs text-gray-500 uppercase font-bold">Total Delivered Value</p>
            <p className="text-2xl font-bold text-gray-900">{formatCurrency(totalDelivered)}</p>
        </div>
      </div>

      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 print:px-2 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Item / Description</th>
              <th className="px-6 print:px-2 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-20">Unit</th>
              <th className="px-6 print:px-2 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider w-24">Delivered</th>
              <th className="px-6 print:px-2 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider w-24">Avg Rate</th>
              <th className="px-6 print:px-2 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider w-32">Amount</th>
              <th className="px-6 print:px-2 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider w-24 bg-red-50/50">Consumed</th>
              <th className="px-6 print:px-2 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider w-24 bg-green-50/50">Balance</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {items.length === 0 ? (
                <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-gray-500 italic">
                        No deliveries recorded yet.
                    </td>
                </tr>
            ) : currentItems.map((item, idx) => {
                const showHeader = idx === 0 || item.section !== currentItems[idx - 1].section;
                return (
              <Fragment key={idx}>
                {showHeader && (
                    <tr key={`hdr-${idx}`} className="bg-gray-100">
                        <td colSpan={7} className="px-6 py-2 text-xs font-bold text-gray-700 uppercase tracking-wider">
                            {item.section || 'General'}
                        </td>
                    </tr>
                )}
              <tr className="hover:bg-gray-50 transition-colors">
                <td className="px-6 print:px-2 py-4 text-xs font-medium text-gray-900">
                    <div className="truncate max-w-[200px] print:max-w-[150px]" title={item.description}>
                        {item.description}
                    </div>
                </td>
                <td className="px-6 print:px-2 py-4 text-xs text-gray-500 whitespace-nowrap">{item.unit || '-'}</td>
                <td className="px-6 print:px-2 py-4 text-xs text-gray-900 text-right font-medium whitespace-nowrap">{item.qtyDelivered.toFixed(2)}</td>
                <td className="px-6 print:px-2 py-4 text-xs text-gray-500 text-right whitespace-nowrap">{formatCurrency(item.avgRate)}</td>
                <td className="px-6 print:px-2 py-4 text-xs text-gray-900 text-right whitespace-nowrap">{formatCurrency(item.totalAmount)}</td>
                <td className="px-6 print:px-2 py-4 text-xs text-red-600 text-right font-bold bg-red-50/30 whitespace-nowrap">{item.qtyUsed.toFixed(2)}</td>
                <td className="px-6 print:px-2 py-4 text-xs text-green-600 text-right font-bold bg-green-50/30 whitespace-nowrap">{item.qtyBalance.toFixed(2)}</td>
              </tr>
              </Fragment>
            );
            })}
          </tbody>
          <tfoot className="bg-gray-50 font-bold border-t border-gray-200">
            <tr>
                <td colSpan={2} className="px-6 py-3 text-right text-xs uppercase text-gray-500">Totals</td>
                <td className="px-6 py-3 text-right text-sm text-gray-900">-</td>
                <td className="px-6 py-3 text-right text-sm text-gray-900">-</td>
                <td className="px-6 py-3 text-right text-sm text-gray-900">{formatCurrency(totalDelivered)}</td>
                <td className="px-6 py-3 text-right text-sm text-gray-900">-</td>
                <td className="px-6 py-3 text-right text-sm text-gray-900">-</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
