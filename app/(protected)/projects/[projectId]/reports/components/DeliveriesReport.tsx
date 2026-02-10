
import { ReportData } from '../actions';
import { formatMoney } from '@/lib/money'; // Assuming this exists or using Intl

function formatCurrency(amount: number) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD', // Default to USD for now, strictly
    }).format(amount);
}

export default function DeliveriesReport({ data }: { data: ReportData }) {
  const items = data.deliveries;

  const totalDelivered = items.reduce((sum, item) => sum + item.totalAmount, 0);

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
              <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Item / Description</th>
              <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-20">Unit</th>
              <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider w-24">Delivered</th>
              <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider w-24">Avg Rate</th>
              <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider w-32">Amount</th>
              <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider w-24 bg-red-50/50">Consumed</th>
              <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider w-24 bg-green-50/50">Balance</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {items.length === 0 ? (
                <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-gray-500 italic">
                        No deliveries recorded yet.
                    </td>
                </tr>
            ) : items.map((item, idx) => (
              <tr key={idx} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4 text-sm font-medium text-gray-900">{item.description}</td>
                <td className="px-6 py-4 text-sm text-gray-500">{item.unit || '-'}</td>
                <td className="px-6 py-4 text-sm text-gray-900 text-right font-medium">{item.qtyDelivered.toFixed(2)}</td>
                <td className="px-6 py-4 text-sm text-gray-500 text-right">{formatCurrency(item.avgRate)}</td>
                <td className="px-6 py-4 text-sm text-gray-900 text-right">{formatCurrency(item.totalAmount)}</td>
                <td className="px-6 py-4 text-sm text-red-600 text-right font-bold bg-red-50/30">{item.qtyUsed.toFixed(2)}</td>
                <td className="px-6 py-4 text-sm text-green-600 text-right font-bold bg-green-50/30">{item.qtyBalance.toFixed(2)}</td>
              </tr>
            ))}
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
