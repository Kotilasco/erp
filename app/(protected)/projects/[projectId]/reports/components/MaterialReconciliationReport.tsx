
import { ReportData, DeliveryItem } from '../actions';

function formatCurrency(amount: number) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
    }).format(amount);
}

export default function MaterialReconciliationReport({ data }: { data: ReportData }) {
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

      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Description</th>
              <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-20">Unit</th>
              
              <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider w-24">Quoted Qty</th>
              <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider w-32">Quoted Amt</th>
              
              <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider w-24 bg-blue-50/30">Dlvd Qty</th>
              <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider w-32 bg-blue-50/30">Dlvd Amt</th>
              
              <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider w-24">Var Qty</th>
              <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider w-32">Var Amt</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {reportRows.length === 0 ? (
                <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-gray-500 italic">
                        No quote lines found.
                    </td>
                </tr>
            ) : reportRows.map((row, idx) => (
              <tr key={idx} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4 text-sm font-medium text-gray-900">{row.description}</td>
                <td className="px-6 py-4 text-sm text-gray-500">{row.unit || '-'}</td>
                
                <td className="px-6 py-4 text-sm text-gray-900 text-right">{row.quantity.toFixed(2)}</td>
                <td className="px-6 py-4 text-sm text-gray-900 text-right">{formatCurrency(row.amount)}</td>
                
                <td className="px-6 py-4 text-sm text-gray-900 text-right font-medium bg-blue-50/10">{row.qtyDelivered.toFixed(2)}</td>
                <td className="px-6 py-4 text-sm text-gray-900 text-right bg-blue-50/10">{formatCurrency(row.amountDelivered)}</td>
                
                <td className={`px-6 py-4 text-sm text-right font-medium ${row.statusColor}`}>
                    {row.varianceQty > 0 ? '+' : ''}{row.varianceQty.toFixed(2)}
                </td>
                <td className={`px-6 py-4 text-sm text-right font-bold ${row.varianceAmount > 0 ? 'text-red-600' : 'text-green-600'}`}>
                     {row.varianceAmount > 0 ? '+' : ''}{formatCurrency(row.varianceAmount)}
                </td>
              </tr>
            ))}
          </tbody>
           <tfoot className="bg-gray-50 font-bold border-t border-gray-200">
            <tr>
                <td colSpan={2} className="px-6 py-3 text-right text-xs uppercase text-gray-500">Totals</td>
                
                <td className="px-6 py-3 text-right text-sm text-gray-900">-</td>
                <td className="px-6 py-3 text-right text-sm text-gray-900">{formatCurrency(totalQuoted)}</td>
                
                <td className="px-6 py-3 text-right text-sm text-gray-900">-</td>
                <td className="px-6 py-3 text-right text-sm text-gray-900">{formatCurrency(totalDelivered)}</td>
                
                <td className="px-6 py-3 text-right text-sm text-gray-900">-</td>
                <td className={`px-6 py-3 text-right text-sm ${totalVariance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {totalVariance > 0 ? '+' : ''}{formatCurrency(totalVariance)}
                </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
