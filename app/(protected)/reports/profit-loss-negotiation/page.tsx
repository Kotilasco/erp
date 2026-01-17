import { getBulkPnL } from '@/lib/profit-loss';
import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import Money from '@/components/Money';
import { 
  ArrowLeftIcon, 
  ArrowTrendingDownIcon,
  GlobeAltIcon
} from '@heroicons/react/24/outline';
import Link from 'next/link';
import GlobalPnLTable from '@/components/GlobalPnLTable';
import PrintHeader from '@/components/PrintHeader';
import PrintButton from '@/components/PrintButton';

export default async function GlobalNegotiationPnLPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const allowedRoles = ['ADMIN', 'MANAGING_DIRECTOR', 'ACCOUNTING_CLERK', 'ACCOUNTING_OFFICER', 'ACCOUNTS', 'PROJECT_OPERATIONS_OFFICER'];
  if (!allowedRoles.includes(user.role)) return redirect('/reports');

  // Filter Projects logic
  const projectWhere = user.role === 'PROJECT_OPERATIONS_OFFICER' 
      ? { assignedToId: user.id } 
      : {};

  const projectCount = await prisma.project.count({ where: projectWhere });

  // Use Bulk PnL
  const { summary: globalSummary, items: globalItems } = await getBulkPnL(projectWhere);
  
  // Filter for Negotiation Only
  const negItems = globalItems.filter(i => i.category === 'NEGOTIATION');
  const totalVarianceMinor = globalSummary.negotiationVarianceMinor;

  const formatVariance = (val: bigint) => {
     const isPos = val >= 0;
     return (
         <span className={`font-mono font-bold ${isPos ? 'text-emerald-600' : 'text-rose-600'}`}>
             {isPos ? '+' : ''}<Money minor={val} />
         </span>
     );
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-8 space-y-8 max-w-[1600px] mx-auto">
        <PrintHeader />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200 pb-6">
            <div>
                 <div className="flex items-center gap-2 mb-2">
                    <span className="inline-flex items-center rounded-md bg-purple-100 px-2 py-1 text-xs font-medium text-purple-700 ring-1 ring-inset ring-purple-700/10">
                        Global Report
                    </span>
                 </div>
                <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
                    <GlobeAltIcon className="h-8 w-8 text-gray-400" />
                    Negotiation Gains
                </h1>
                <p className="text-gray-500 mt-1">
                    Revenue impact from post-quote negotiations across {projectCount} projects.
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

        {/* Summary Card */}
        <div className="rounded-2xl bg-white p-8 shadow-sm border border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-4">
                 <div className="p-3 bg-purple-50 rounded-lg">
                    <ArrowTrendingDownIcon className="h-8 w-8 text-purple-600" />
                </div>
                <div>
                    <h2 className="text-lg font-semibold text-gray-900">Net Negotiation Impact</h2>
                    <p className="text-sm text-gray-500 mt-1">Total revenue lost (negative) or gained (positive) via negotiations.</p>
                </div>
            </div>
            <div className="text-4xl font-bold">
                 {formatVariance(totalVarianceMinor)}
            </div>
        </div>

        {/* Detailed Table */}
        <div className="space-y-6">
            <GlobalPnLTable title="Negotiation Events" items={negItems} pageSize={15} />

            {negItems.length === 0 && (
                <div className="text-center py-12 bg-white rounded-xl border border-gray-200 border-dashed">
                    <p className="text-gray-500">No negotiation data found.</p>
                </div>
            )}
        </div>
    </div>
  );
}
