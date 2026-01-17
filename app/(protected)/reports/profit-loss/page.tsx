import { getBulkPnL } from '@/lib/profit-loss';
import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import Money from '@/components/Money';
import { 
  ArrowLeftIcon, 
  CurrencyDollarIcon, 
  ArrowTrendingDownIcon, 
  ShoppingCartIcon,
  ArchiveBoxIcon,
  ExclamationTriangleIcon,
  GlobeAltIcon
} from '@heroicons/react/24/outline';
import Link from 'next/link';
import GlobalPnLTable from '@/components/GlobalPnLTable'; // Updated import
import PrintHeader from '@/components/PrintHeader';
import PrintButton from '@/components/PrintButton';

export default async function GlobalPnLPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const allowedRoles = ['ADMIN', 'MANAGING_DIRECTOR', 'ACCOUNTING_CLERK', 'ACCOUNTING_OFFICER', 'ACCOUNTS', 'PROJECT_OPERATIONS_OFFICER'];
  if (!allowedRoles.includes(user.role)) return redirect('/reports');

  // Filter Projects Logic
  const projectWhere = user.role === 'PROJECT_OPERATIONS_OFFICER' 
      ? { assignedToId: user.id } 
      : {};

  // Fetch count just for display
  const projectCount = await prisma.project.count({ where: projectWhere });

  // Use Bulk PnL Fetch
  const { summary: globalSummary, items: globalItems } = await getBulkPnL(projectWhere);

  const formatVariance = (val: bigint) => {
     const isPos = val >= 0;
     return (
         <span className={`font-mono font-bold ${isPos ? 'text-emerald-600' : 'text-rose-600'}`}>
             {isPos ? '+' : ''}<Money minor={val} />
         </span>
     );
  };

  const categories = {
      NEGOTIATION: globalItems.filter(i => i.category === 'NEGOTIATION'),
      PROCUREMENT: globalItems.filter(i => i.category === 'PROCUREMENT'),
      USAGE: globalItems.filter(i => i.category === 'USAGE'),
      RETURNS: globalItems.filter(i => i.category === 'RETURNS'),
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-8 space-y-8 max-w-[1600px] mx-auto">
        <PrintHeader />
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200 pb-6">
            <div>
                 <div className="flex items-center gap-2 mb-2">
                    <span className="inline-flex items-center rounded-md bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-700/10">
                        Global Report
                    </span>
                 </div>
                <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
                    <GlobeAltIcon className="h-8 w-8 text-gray-400" />
                    Consolidated Profit & Loss
                </h1>
                <p className="text-gray-500 mt-1">
                    Financial overview across {projectCount} aligned projects.
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
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6">
            <Card title="Total Contract Value" icon={CurrencyDollarIcon} value={globalSummary.contractValueMinor} variant="neutral" />
            <Card title="Negotiation Delta" icon={ArrowTrendingDownIcon} value={globalSummary.negotiationVarianceMinor} variant="variance" />
            <Card title="Procurement Delta" icon={ShoppingCartIcon} value={globalSummary.procurementVarianceMinor} variant="variance" />
            <Card title="Usage Variance" icon={ExclamationTriangleIcon} value={globalSummary.usageVarianceMinor} variant="variance" />
            <Card title="Returns Value" icon={ArchiveBoxIcon} value={globalSummary.returnsValueMinor} variant="variance" />
        </div>

        {/* Net Result */}
        <div className="rounded-2xl bg-white p-8 shadow-sm border border-gray-100 flex items-center justify-between">
            <div>
                <h2 className="text-lg font-semibold text-gray-900">Net Global Variance</h2>
                <p className="text-sm text-gray-500 mt-1">Total profit/loss against planned quotes across all projects.</p>
            </div>
            <div className="text-4xl font-bold">
                 {formatVariance(globalSummary.netProfitLossMinor)}
            </div>
        </div>

        {/* Detailed Tables */}
        <div className="space-y-6">
            {categories.PROCUREMENT.length > 0 && (
                 <GlobalPnLTable title="Procurement Efficiency" items={categories.PROCUREMENT} />
            )}
            {categories.USAGE.length > 0 && (
                <GlobalPnLTable title="Material Usage" items={categories.USAGE} />
            )}
            {categories.RETURNS.length > 0 && (
                <GlobalPnLTable title="Site Returns" items={categories.RETURNS} />
            )}
            {categories.NEGOTIATION.length > 0 && (
                <GlobalPnLTable title="Negotiation Impact" items={categories.NEGOTIATION} />
            )}
            
            {globalItems.length === 0 && (
                <div className="text-center py-12 bg-white rounded-xl border border-gray-200 border-dashed">
                    <p className="text-gray-500">No financial data found for the selected projects.</p>
                </div>
            )}
        </div>
    </div>
  );
}

function Card({ title, icon: Icon, value, variant }: { title: string; icon: any; value: bigint; variant: 'neutral' | 'variance' }) {
    const isPos = value >= 0;
    const isNeutral = variant === 'neutral';
    
    return (
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <div className="flex items-center gap-3 text-gray-500 mb-2">
                <Icon className="h-5 w-5" />
                <span className="text-xs font-semibold uppercase tracking-wider">{title}</span>
            </div>
            <div className={`text-2xl font-bold ${isNeutral ? 'text-gray-900' : isPos ? 'text-emerald-600' : 'text-rose-600'}`}>
                {!isNeutral && isPos ? '+' : ''}
                <Money minor={value} />
            </div>
        </div>
    );
}
