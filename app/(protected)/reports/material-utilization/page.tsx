import { getMaterialUtilization } from '@/lib/material-utilization';
import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { 
  ArrowLeftIcon, 
  ScaleIcon,
  ArchiveBoxIcon,
  ShoppingCartIcon
} from '@heroicons/react/24/outline';
import Link from 'next/link';
import PrintHeader from '@/components/PrintHeader';
import PrintButton from '@/components/PrintButton';
import MaterialUtilizationTabs from './MaterialUtilizationTabs';

export default async function MaterialUtilizationPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const allowedRoles = ['ADMIN', 'MANAGING_DIRECTOR', 'PROJECT_OPERATIONS_OFFICER', 'STORE_KEEPER', 'ACCOUNTING_CLERK'];
  if (!allowedRoles.includes(user.role)) return redirect('/reports');

  // Filter Projects logic
  const projectWhere = user.role === 'PROJECT_OPERATIONS_OFFICER' 
      ? { assignedToId: user.id } 
      : {};

  const { items, summary } = await getMaterialUtilization(projectWhere);

  // Split Items
  const stockItems = items.filter(i => i.type === 'STOCK');
  const purchaseItems = items.filter(i => i.type === 'PURCHASE');

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-8 space-y-8 max-w-[1600px] mx-auto">
        <PrintHeader />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200 pb-6">
            <div>
                 <div className="flex items-center gap-2 mb-2">
                    <span className="inline-flex items-center rounded-md bg-orange-100 px-2 py-1 text-xs font-medium text-orange-700 ring-1 ring-inset ring-orange-700/10">
                        Operational Report
                    </span>
                 </div>
                <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
                    <ScaleIcon className="h-8 w-8 text-gray-400" />
                    Material Utilization
                </h1>
                <p className="text-gray-500 mt-1">
                    Track dispatched materials, returns, and on-site usage.
                </p>
            </div>
            <div className="flex items-center gap-3">
                <Link 
                    href={`/reports`}
                    className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm border border-gray-300 hover:bg-gray-50 hover:text-gray-900 transition-all"
                >
                    <ArrowLeftIcon className="h-4 w-4" />
                    Reports Center
                </Link>
                <PrintButton />
            </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="rounded-xl bg-white p-6 shadow-sm border border-gray-100">
                <div className="text-sm text-gray-500 font-medium">Total Items Dispatched</div>
                <div className="text-3xl font-bold text-gray-900 mt-2">{summary.totalDispatchedItems.toLocaleString()}</div>
            </div>
            <div className="rounded-xl bg-white p-6 shadow-sm border border-gray-100">
                <div className="text-sm text-gray-500 font-medium">Total Returned</div>
                <div className="text-3xl font-bold text-orange-600 mt-2">{summary.totalReturnedItems.toLocaleString()}</div>
            </div>
             <div className="rounded-xl bg-white p-6 shadow-sm border border-gray-100">
                <div className="text-sm text-gray-500 font-medium">Total Consumed (Used)</div>
                <div className="text-3xl font-bold text-blue-600 mt-2">{summary.totalUsedItems.toLocaleString()}</div>
            </div>
        </div>

        {/* Tabbed Content */}
        <MaterialUtilizationTabs stockItems={stockItems} purchaseItems={purchaseItems} />
    </div>
  );
}
