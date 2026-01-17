import { getProjectPnL, VarianceItem } from '@/lib/profit-loss';
import { getCurrentUser } from '@/lib/auth';
import { redirect, notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import Money from '@/components/Money';
import { 
  ArrowLeftIcon, 
  ShoppingCartIcon,
} from '@heroicons/react/24/outline';
import Link from 'next/link';
import PnLVarianceTable from '../profit-loss/PnLVarianceTable'; // Reusing the table component

export default async function ProjectProcurementPnLPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  // Verify Role
  if (!['ADMIN', 'MANAGING_DIRECTOR', 'ACCOUNTING_CLERK', 'ACCOUNTING_OFFICER', 'ACCOUNTS', 'PROJECT_OPERATIONS_OFFICER', 'PROCUREMENT'].includes(user.role as string)) {
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

  const procurementItems = items.filter(i => i.category === 'PROCUREMENT');

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-8 space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
                <h1 className="text-3xl font-bold text-gray-900">Profit & Loss (Procurement)</h1>
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

        {/* Summary Card */}
        <div className="rounded-2xl bg-white p-8 shadow-sm border border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-4">
                <div className="p-3 bg-indigo-50 rounded-lg">
                    <ShoppingCartIcon className="h-8 w-8 text-indigo-600" />
                </div>
                <div>
                    <h2 className="text-lg font-semibold text-gray-900">Net Procurement Variance</h2>
                    <p className="text-sm text-gray-500 mt-1">Total savings or overspend on purchased materials.</p>
                </div>
            </div>
            <div className="text-4xl font-bold">
                 {formatVariance(summary.procurementVarianceMinor)}
            </div>
        </div>

        {/* Detailed Table */}
        <div className="space-y-6">
            <PnLVarianceTable title="Procurement Efficiency" description="Price differences (Estimated vs Actual Purchasing)" items={procurementItems} />
        </div>
    </div>
  );
}
