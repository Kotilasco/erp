'use client';

import { useState, Fragment } from 'react';
import { ReportData, DeliveryItem } from '../actions';
import TablePagination from '@/components/ui/table-pagination';

function formatCurrency(amount: number) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
    }).format(amount);
}

export default function MaterialReconciliationReport({ data, disablePagination = false }: { data: ReportData; disablePagination?: boolean }) {
  const { quoteLines, deliveries } = data;

  // Enhance Quote Lines with Delivery Data
  const reportRows = quoteLines.map((line) => {
    // Find matching delivery items by ID first
    let matchedDeliveries = deliveries.filter(d => d.quoteLineIds.includes(line.id));

    // Fallback: Fuzzy match by description if no ID match (and not already matched strongly)
    // Note: This is risky if descriptions are generic, but helpful for legacy data.
    // For now, let's rely strictly on ID if available, or maybe description if totally unmatched?
    // Let's stick to strict ID matching + exact Description matching for now.
    if (matchedDeliveries.length === 0) {
        matchedDeliveries = deliveries.filter(d => 
            d.description.toLowerCase().trim() === line.description.toLowerCase().trim() &&
            d.unit?.toLowerCase() === line.unit?.toLowerCase()
        );
    }

    const qtyDelivered = matchedDeliveries.reduce((sum, d) => sum + d.qtyDelivered, 0);
    const amountDelivered = matchedDeliveries.reduce((sum, d) => sum + d.totalAmount, 0); // This might double count if a delivery maps to multiple lines?
    // Actually, our deliveryMap in actions.ts creates UNIQUE delivery items per description/unit.
    // So distinct delivery items won't overlap. We are safe aggregating them here.

    const varianceQty = qtyDelivered - line.quantity;
    const varianceAmount = amountDelivered - line.amount;
    
    // Status Logic
    let statusColor = 'text-gray-500';
    if (varianceQty > 0) statusColor = 'text-red-600 font-bold'; // Over delivered
    if (varianceQty < 0) statusColor = 'text-green-600'; // Under delivered (savings?)

    return {
        ...line,
        qtyDelivered,
        amountDelivered,
        varianceQty,
        varianceAmount,
        statusColor
    };
  });

  // Calculate Totals
  const totalQuoted = reportRows.reduce((sum, r) => sum + r.amount, 0);
  const totalDelivered = reportRows.reduce((sum, r) => sum + r.amountDelivered, 0);
  const totalVariance = totalDelivered - totalQuoted;

  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;
  const currentRows = disablePagination ? reportRows : reportRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
            <h2 className="text-lg font-bold text-gray-900">Material Reconciliation</h2>
            <p className="text-sm text-gray-500">Comparing Quoted Limits vs Actual Deliveries to Site.</p>
        </div>
        <div className="flex gap-8 text-right">
            <div>
                <p className="text-xs text-gray-500 uppercase font-bold">Total Quoted</p>
                <p className="text-xl font-bold text-gray-900">{formatCurrency(totalQuoted)}</p>
            </div>
            <div>
                <p className="text-xs text-gray-500 uppercase font-bold">Total Delivered</p>
                <p className="text-xl font-bold text-gray-900">{formatCurrency(totalDelivered)}</p>
            </div>
             <div>
                <p className="text-xs text-gray-500 uppercase font-bold">Variance</p>
                <p className={`text-xl font-bold ${totalVariance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {totalVariance > 0 ? '+' : ''}{formatCurrency(totalVariance)}
                </p>
            </div>
        </div>
      </div>

      <div className="border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm">
        <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
                <tr>
                <th className="px-6 print:px-2 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">Description</th>
                <th className="px-6 print:px-2 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-20 whitespace-nowrap">Unit</th>
                
                <th className="px-6 print:px-2 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider w-24 whitespace-nowrap">Quoted Qty</th>
                <th className="px-6 print:px-2 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider w-32 whitespace-nowrap">Quoted Amt</th>
                
                <th className="px-6 print:px-2 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider w-24 bg-blue-50/30 whitespace-nowrap">Dlvd Qty</th>
                <th className="px-6 print:px-2 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider w-32 bg-blue-50/30 whitespace-nowrap">Dlvd Amt</th>
                
                <th className="px-6 print:px-2 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider w-24 whitespace-nowrap">Var Qty</th>
                <th className="px-6 print:px-2 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider w-32 whitespace-nowrap">Var Amt</th>
                </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
                {reportRows.length === 0 ? (
                    <tr>
                        <td colSpan={8} className="px-6 py-12 text-center text-gray-500 italic">
                            No quote lines found.
                        </td>
                    </tr>
                ) : currentRows.map((row, idx) => {
                    const globalIdx = reportRows.indexOf(row);
                    const nextRow = reportRows[globalIdx + 1];
                    const isLastOfSection = !nextRow || nextRow.section !== row.section;
                    const showHeader = idx === 0 || row.section !== currentRows[idx - 1].section; // Keep header logic local to page for readability

                    // Calculate Section Totals
                    const sectionRows = reportRows.filter(r => r.section === row.section);
                    const sectionQuoted = sectionRows.reduce((s, r) => s + r.amount, 0);
                    const sectionDelivered = sectionRows.reduce((s, r) => s + r.amountDelivered, 0);
                    const sectionVariance = sectionDelivered - sectionQuoted;

                    return (
                        <Fragment key={idx}>
                            {showHeader && (
                                <tr key={`hdr-${idx}`} className="bg-gray-100">
                                    <td colSpan={8} className="px-6 py-2 text-xs font-bold text-gray-700 uppercase tracking-wider">
                                        {row.section || 'General'}
                                    </td>
                                </tr>
                            )}
                            <tr className="hover:bg-gray-50 transition-colors">
                                <td className="px-6 print:px-2 py-4 text-xs font-normal text-gray-900">
                                    <div className="truncate max-w-[200px] print:max-w-[150px]" title={row.description}>
                                        {row.description}
                                    </div>
                                </td>
                                <td className="px-6 print:px-2 py-4 text-xs text-gray-500 whitespace-nowrap">{row.unit || '-'}</td>
                                
                                <td className="px-6 print:px-2 py-4 text-xs text-gray-900 text-right whitespace-nowrap">{row.quantity.toFixed(2)}</td>
                                <td className="px-6 print:px-2 py-4 text-xs text-gray-900 text-right whitespace-nowrap">{formatCurrency(row.amount)}</td>
                                
                                <td className="px-6 print:px-2 py-4 text-xs text-blue-900 text-right font-medium bg-blue-50/30 whitespace-nowrap">{row.qtyDelivered.toFixed(2)}</td>
                                <td className="px-6 print:px-2 py-4 text-xs text-blue-900 text-right bg-blue-50/30 whitespace-nowrap">{formatCurrency(row.amountDelivered)}</td>
                                
                                <td className={`px-6 print:px-2 py-4 text-xs text-right font-bold whitespace-nowrap ${row.statusColor}`}>
                                    {row.varianceQty > 0 ? '+' : ''}{row.varianceQty.toFixed(2)}
                                </td>
                                <td className={`px-6 print:px-2 py-4 text-xs text-right whitespace-nowrap ${row.varianceAmount > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                    {row.varianceAmount > 0 ? '+' : ''}{formatCurrency(row.varianceAmount)}
                                </td>
                            </tr>
                            
                            {isLastOfSection && (
                                <tr className="bg-blue-50/50 font-bold border-t-2 border-gray-300 border-b-4 border-double">
                                    <td colSpan={3} className="px-6 py-3 text-left text-xs text-gray-900 font-bold uppercase tracking-wide">
                                        TOTAL {row.section} SUMMARY
                                    </td>
                                    <td className="px-6 py-3 text-right text-xs text-gray-900 border-x border-gray-200">{formatCurrency(sectionQuoted)}</td>
                                    <td className="px-6 py-3 text-right text-xs text-gray-900 border-x border-gray-200">-</td>
                                    <td className="px-6 py-3 text-right text-xs text-blue-900 border-x border-gray-200">{formatCurrency(sectionDelivered)}</td>
                                    <td className="px-6 py-3 text-right text-xs text-gray-900 border-x border-gray-200">-</td>
                                    <td className={`px-6 py-3 text-right text-xs font-bold border-x border-gray-200 ${sectionVariance > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                        {formatCurrency(sectionVariance)}
                                    </td>
                                </tr>
                            )}
                        </Fragment>
                    );
                })}
            </tbody>
            {(!disablePagination && currentPage === Math.ceil(reportRows.length / pageSize)) || disablePagination ? (
            <tfoot className="bg-gray-100 font-bold border-t border-gray-200">
                <tr>
                    <td colSpan={3} className="px-6 py-3 text-right text-xs uppercase text-gray-900 font-bold whitespace-nowrap">GRAND TOTAL</td>
                    
                    <td className="px-6 py-3 text-right text-sm text-gray-900 font-bold">{formatCurrency(totalQuoted)}</td>
                    
                    <td className="px-6 py-3 text-right text-sm text-gray-900">-</td>
                    <td className="px-6 py-3 text-right text-sm text-gray-900 font-bold">{formatCurrency(totalDelivered)}</td>
                    
                    <td className="px-6 py-3 text-right text-sm text-gray-900">-</td>
                    <td className={`px-6 py-3 text-right text-sm font-bold ${totalVariance > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(totalVariance)}
                    </td>
                </tr>
            </tfoot>
            ) : null}
            </table>
        </div>
        {!disablePagination && (
        <TablePagination
            totalItems={reportRows.length}
            currentPage={currentPage}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
        />
        )}
      </div>
    </div>
  );
}
