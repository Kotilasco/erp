'use client';

import { useState, Fragment } from 'react';
import { ReportData } from '../actions';
import TablePagination from '@/components/ui/table-pagination';

function formatCurrency(amount: number) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
    }).format(amount);
}

export default function ProfitabilityReport({ data, disablePagination = false }: { data: ReportData; disablePagination?: boolean }) {
  const { quoteLines, deliveries } = data;

  // Calculate Profitability
  // Profit = Revenue - Cost
  // Revenue = Matched Quote Line Amount (or prorated?)
  // Cost = Consumed * Weighted Average Cost
  
  // This is tricky because Revenue is usually fixed by the quote.
  // But Cost is incurred as we consume materials.
  // The report in Excel seems to compare "Amount" (Revenue) vs "Consumed Rate * Quantity" (Cost)?
  
  const reportRows = quoteLines.map((line) => {
    // 1. Find Matched Deliveries (Same logic as reconciliation)
    let matchedDeliveries = deliveries.filter(d => d.quoteLineIds.includes(line.id));
    if (matchedDeliveries.length === 0) {
        matchedDeliveries = deliveries.filter(d => 
            d.description.toLowerCase().trim() === line.description.toLowerCase().trim() &&
            d.unit?.toLowerCase() === line.unit?.toLowerCase()
        );
    }

    // 2. Calculate Actual Cost of CONSUMED items
    // We strictly look at `qtyUsed` for cost calculation.
    // If nothing used, cost is 0? Or do we count cost of delivery?
    // Usually Profitability = Revenue Earned - Cost Incurred.
    // Cost Incurred is Consumption.
    
    // Revenue is the Quote Amount. But is it fully earned? 
    // If simple check, assume Revenue = Quote Amount.
    // Cost = Sum (Used Qty * Avg Cost Rate)
    
    const qtyConsumed = matchedDeliveries.reduce((sum, d) => sum + d.qtyUsed, 0);
    const costIncurred = matchedDeliveries.reduce((sum, d) => sum + (d.qtyUsed * d.avgRate), 0);
    
    // Calculate Profit
    const revenue = line.amount; 
    const profit = revenue - costIncurred;
    const margin = revenue > 0 ? (profit / revenue) * 100 : 0;

    // Status / Health
    // If we have consumed MORE than quoted quantity, we are likely losing money on this item (unless rate is lower).
    // If Cost > Revenue, definitely losing money.

    return {
        ...line,
        qtyConsumed,
        costIncurred,
        profit,
        margin
    };
  });

  const totalRevenue = reportRows.reduce((sum, r) => sum + r.amount, 0);
  const totalCost = reportRows.reduce((sum, r) => sum + r.costIncurred, 0);
  const totalProfit = totalRevenue - totalCost;
  const totalMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;
  const currentRows = disablePagination ? reportRows : reportRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="space-y-6">
      {!disablePagination && (
      <div className="flex justify-between items-end">
        <div>
            <h2 className="text-lg font-bold text-gray-900">Profitability Report</h2>
            <p className="text-sm text-gray-500">Revenue (Quote) vs Actual Cost of Consumed Materials.</p>
        </div>
        <div className="flex gap-8 text-right">
             <div>
                <p className="text-xs text-gray-500 uppercase font-bold">Total Revenue</p>
                <p className="text-xl font-bold text-gray-900">{formatCurrency(totalRevenue)}</p>
            </div>
            <div>
                <p className="text-xs text-gray-500 uppercase font-bold">Total Cost (Consumed)</p>
                <p className="text-xl font-bold text-red-600">{formatCurrency(totalCost)}</p>
            </div>
             <div>
                <p className="text-xs text-gray-500 uppercase font-bold">Net Profit</p>
                <p className={`text-xl font-bold ${totalProfit > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(totalProfit)}
                </p>
            </div>
        </div>
      </div>
      )}

      <div className="border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm">
        <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
                <tr>
                <th className="px-6 print:px-2 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">Description</th>
                <th className="px-6 print:px-2 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider w-24 whitespace-nowrap">Quoted Amt</th>
                
                <th className="px-6 print:px-2 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider w-24 bg-orange-50/30 whitespace-nowrap">Consumed Qty</th>
                <th className="px-6 print:px-2 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider w-32 bg-orange-50/30 whitespace-nowrap">Actual Cost</th>
                
                <th className="px-6 print:px-2 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider w-32 whitespace-nowrap">Profit</th>
                <th className="px-6 print:px-2 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider w-20 whitespace-nowrap">Margin</th>
                </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
                {reportRows.length === 0 ? (
                    <tr>
                        <td colSpan={6} className="px-6 py-12 text-center text-gray-500 italic">
                            No data available.
                        </td>
                    </tr>
                ) : currentRows.map((row, idx) => {
                    const sectionName = row.section || 'General';
                    const showHeader = idx === 0 || row.section !== currentRows[idx - 1].section;
                    
                    // Logic to check if we should show the footer for this section
                    // We show it if: 
                    // 1. It is the last row of the current page AND it is the last row of the section in the FULL list? 
                    //    -> No, simple Logic: If the NEXT row in 'currentRows' has a different section, OR if this is the last row of 'currentRows'.
                    //    BUT, if we are paginate, we only want to show the TOTAL if we are actually at the end of the section.
                    //    Better check: look at the original 'reportRows'.
                    
                    const originalIdx = reportRows.findIndex(r => r.id === row.id);
                    
                    // Logic: Is this the last item of the section?
                    const isLastOfSection = 
                        originalIdx === reportRows.length - 1 || 
                        (originalIdx < reportRows.length - 1 && reportRows[originalIdx + 1].section !== row.section);

                    // BUT we only show it if we are currently rendering it.
                    // Since we map over `currentRows`, if `row` is in `currentRows` and it IS the last of section, we show it.
                    // The issue might be if `originalIdx` logic is flawed (e.g. duplicate IDs? unlikely)
                    // Or if `currentRows` cutting off doesn't matter (which is good).
                    // If the section ends on the Next Page, `isLastOfSection` will be true for that item, but that item won't be in `currentRows` until next page.
                    // So it should work? 
                    // Wait, if I am on Page 1, and Section A ends on Page 2.
                    // Page 1 items: isLastOfSection will be false.
                    // Page 2 items: The last item of Section A will have isLastOfSection = true.
                    // So it should show on Page 2.
                    
                    // User says "you removed the summary".
                    // Maybe the previous logic was wrong or `originalIdx` finding failed.
                    // Let's rely on checking if the NEXT item in the FULL list has a different section.

                    // Calculate Section Totals (Inefficient to do in render loop but safe for small data)
                    // Optimization: We could pre-calc this.
                    const sectionRows = reportRows.filter(r => r.section === row.section);
                    const sectionRevenue = sectionRows.reduce((s, r) => s + r.amount, 0);
                    const sectionCost = sectionRows.reduce((s, r) => s + r.costIncurred, 0);
                    const sectionProfit = sectionRevenue - sectionCost;

                    return (
                        <Fragment key={idx}>
                            {showHeader && (() => {
                                const globalIdx = reportRows.findIndex(r => r.id === row.id);
                                const isGlobalFirstOfSection =
                                  reportRows.findIndex(r => r.section === row.section) === globalIdx;
                                const isFirstOverallSection = reportRows.length > 0 && reportRows[0].section === row.section;
                                const shouldBreakBefore = isGlobalFirstOfSection && !isFirstOverallSection;
                                return (
                                <tr
                                  key={`hdr-${idx}`}
                                  className="bg-gray-100"
                                  style={shouldBreakBefore ? { breakBefore: 'page', pageBreakBefore: 'always' } as any : undefined}
                                >
                                    <td colSpan={6} className="px-6 py-2 text-xs font-bold text-gray-700 uppercase tracking-wider">
                                        {sectionName}
                                    </td>
                                </tr>
                                );
                            })()}
                            <tr className="hover:bg-gray-50 transition-colors">
                                <td className="px-6 print:px-2 py-4 text-xs font-normal text-gray-900">
                                    <div className="truncate max-w-[200px] print:max-w-[150px]" title={row.description}>
                                        {row.description}
                                    </div>
                                </td>
                                <td className="px-6 print:px-2 py-4 text-xs text-gray-900 text-right whitespace-nowrap">{formatCurrency(row.amount)}</td>
                                
                                <td className="px-6 print:px-2 py-4 text-xs text-orange-900 text-right bg-orange-50/30 whitespace-nowrap">{row.qtyConsumed.toFixed(2)}</td>
                                <td className="px-6 print:px-2 py-4 text-xs text-orange-900 text-right font-medium bg-orange-50/30 whitespace-nowrap">{formatCurrency(row.costIncurred)}</td>
                                
                                <td className={`px-6 print:px-2 py-4 text-xs text-right font-bold whitespace-nowrap ${row.profit > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {formatCurrency(row.profit)}
                                </td>
                                <td className={`px-6 print:px-2 py-4 text-xs text-right whitespace-nowrap ${row.margin < 0 ? 'text-red-600' : 'text-gray-500'}`}>
                                    {row.margin.toFixed(1)}%
                                </td>
                            </tr>
                            
                            {isLastOfSection && (
                                <tr className="bg-orange-50/50 font-bold border-t-2 border-gray-300 border-b-4 border-double">
                                    <td colSpan={1} className="px-6 py-3 text-left text-sm text-gray-900 font-bold uppercase tracking-wide">
                                        TOTAL {sectionName} CARRIED TO SUMMARY
                                    </td>
                                    <td className="px-6 py-3 text-right text-sm text-gray-900 border-x border-gray-200">{formatCurrency(sectionRevenue)}</td>
                                    <td className="px-6 py-3 text-right text-sm text-gray-900 border-x border-gray-200">-</td>
                                    <td className="px-6 py-3 text-right text-sm text-red-600 border-x border-gray-200">{formatCurrency(sectionCost)}</td>
                                    <td className={`px-6 py-3 text-right text-sm font-bold border-x border-gray-200 ${sectionProfit > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                        {formatCurrency(sectionProfit)}
                                    </td>
                                    <td className="px-6 py-3 text-right text-sm text-gray-900 border-x border-gray-200">-</td>
                                </tr>
                            )}
                        </Fragment>
                    );
                })}
            </tbody>

            {(!disablePagination && currentPage === Math.ceil(reportRows.length / pageSize)) || disablePagination ? (
                <tfoot className="bg-gray-100 font-bold border-t-2 border-gray-300">
                    <tr>
                        <td colSpan={1} className="px-6 py-3 text-left text-sm text-gray-900 font-bold uppercase tracking-wide">
                            GRAND TOTAL
                        </td>
                        <td className="px-6 py-3 text-right text-sm text-gray-900 border-x border-gray-200">{formatCurrency(totalRevenue)}</td>
                        <td className="px-6 py-3 text-right text-sm text-gray-900 border-x border-gray-200">-</td>
                        <td className="px-6 py-3 text-right text-sm text-red-600 border-x border-gray-200">{formatCurrency(totalCost)}</td>
                        <td className={`px-6 py-3 text-right text-sm font-bold border-x border-gray-200 ${totalProfit > 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {formatCurrency(totalProfit)}
                        </td>
                        <td className="px-6 py-3 text-right text-sm text-gray-900 border-x border-gray-200">-</td>
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
