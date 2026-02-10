
import { ReportData } from '../actions';

function formatCurrency(amount: number) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
    }).format(amount);
}

export default function ProfitabilityReport({ data }: { data: ReportData }) {
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

  return (
    <div className="space-y-6">
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

      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Description</th>
              <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider w-24">Quoted Amt</th>
              
              <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider w-24 bg-orange-50/30">Consumed Qty</th>
              <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider w-32 bg-orange-50/30">Actual Cost</th>
              
              <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider w-32">Profit</th>
              <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider w-20">Margin</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {reportRows.length === 0 ? (
                <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500 italic">
                        No data available.
                    </td>
                </tr>
            ) : reportRows.map((row, idx) => (
              <tr key={idx} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4 text-sm font-medium text-gray-900">{row.description}</td>
                <td className="px-6 py-4 text-sm text-gray-900 text-right">{formatCurrency(row.amount)}</td>
                
                <td className="px-6 py-4 text-sm text-gray-900 text-right font-medium bg-orange-50/10">{row.qtyConsumed.toFixed(2)}</td>
                <td className="px-6 py-4 text-sm text-red-600 text-right bg-orange-50/10">{formatCurrency(row.costIncurred)}</td>
                
                <td className={`px-6 py-4 text-sm text-right font-bold ${row.profit > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(row.profit)}
                </td>
                 <td className={`px-6 py-4 text-sm text-right font-bold ${row.margin > 20 ? 'text-green-600' : row.margin > 0 ? 'text-yellow-600' : 'text-red-600'}`}>
                    {row.margin.toFixed(1)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
