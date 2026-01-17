import { getProjectPnL, VarianceItem } from '@/lib/profit-loss';
import { getCurrentUser } from '@/lib/auth';
import { redirect, notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import Money from '@/components/Money';
import { 
  ArrowLeftIcon, 
  CurrencyDollarIcon, 
  ArrowTrendingDownIcon, 
  ShoppingCartIcon,
  ArchiveBoxIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import Link from 'next/link';
import PnLVarianceTable from './PnLVarianceTable';

export default async function ProjectPnLPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  // Verify Role
  if (!['ADMIN', 'MANAGING_DIRECTOR', 'ACCOUNTING_CLERK', 'ACCOUNTING_OFFICER', 'ACCOUNTS', 'PROJECT_OPERATIONS_OFFICER'].includes(user.role as string)) {
      return <div className="p-8">Unauthorized</div>;
  }

  const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { quote: { select: { customer: { select: { displayName: true } } } }, name: true }
  });
  if (!project) return notFound();

  const { summary, items } = await getProjectPnL(projectId);

  const formatVariance = (val: bigint) => {
     const isPos = val >= 0;
     return (
         <span className={`font-mono font-bold ${isPos ? 'text-emerald-600' : 'text-rose-600'}`}>
             {isPos ? '+' : ''}<Money minor={val} />
         </span>
     );
  };

  const categories = {
      NEGOTIATION: items.filter(i => i.category === 'NEGOTIATION'),
      PROCUREMENT: items.filter(i => i.category === 'PROCUREMENT'),
      USAGE: items.filter(i => i.category === 'USAGE'),
      RETURNS: items.filter(i => i.category === 'RETURNS'),
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-8 space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
                <h1 className="text-3xl font-bold text-gray-900">Profit & Loss Report</h1>
                <p className="text-gray-500 mt-1">Project: {project.quote?.customer?.displayName ?? project.name ?? projectId}</p>
            </div>
            <Link 
                href={`/projects/${projectId}/reports`}
                className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm border border-gray-300 hover:bg-gray-50 hover:text-gray-900 transition-all"
            >
                <ArrowLeftIcon className="h-4 w-4" />
                Back to Reports
            </Link>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6">
            <Card title="Contract Value" icon={CurrencyDollarIcon} value={summary.contractValueMinor} variant="neutral" />
            <Card title="Negotiation Delta" icon={ArrowTrendingDownIcon} value={summary.negotiationVarianceMinor} variant="variance" />
            <Card title="Procurement Delta" icon={ShoppingCartIcon} value={summary.procurementVarianceMinor} variant="variance" />
            <Card title="Usage Variance" icon={ExclamationTriangleIcon} value={summary.usageVarianceMinor} variant="variance" />
            <Card title="Returns Value" icon={ArchiveBoxIcon} value={summary.returnsValueMinor} variant="variance" />
        </div>

        {/* Net Result */}
        <div className="rounded-2xl bg-white p-8 shadow-sm border border-gray-100 flex items-center justify-between">
            <div>
                <h2 className="text-lg font-semibold text-gray-900">Net Variance (Profit/Loss against Plan)</h2>
                <p className="text-sm text-gray-500 mt-1">Sum of all tracked variances against the quoted baseline.</p>
            </div>
            <div className="text-4xl font-bold">
                 {formatVariance(summary.netProfitLossMinor)}
            </div>
        </div>

        {/* Detailed Tables */}
        <div className="space-y-6">
            <PnLVarianceTable title="Procurement Efficiency" description="Price differences (Estimated vs Actual Purchasing)" items={categories.PROCUREMENT} />
            <PnLVarianceTable title="Material Usage" description="Quantity excesses (Quoted vs Requisitioned)" items={categories.USAGE} />
            <PnLVarianceTable title="Site Returns" description="Value recovered from site returns" items={categories.RETURNS} />
            {categories.NEGOTIATION.length > 0 && (
                <PnLVarianceTable title="Negotiation Impact" description="Revenue changes from original quote" items={categories.NEGOTIATION} />
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
