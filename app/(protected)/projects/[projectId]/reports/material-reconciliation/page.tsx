import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import MaterialReconciliationReport from '../components/MaterialReconciliationReport';
import { getProjectReportData } from '../actions';
import Link from 'next/link';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import ReportPrintHeader from '@/components/reports/ReportPrintHeader';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ProjectMaterialReconciliationPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const me = await getCurrentUser();
  if (!me) redirect('/login');
  if (['ACCOUNTS', 'ACCOUNTING_CLERK', 'ACCOUNTING_OFFICER', 'ACCOUNTING_AUDITOR'].includes(me.role)) {
    redirect('/dashboard');
  }

  const { projectId } = await params;

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, name: true, projectNumber: true },
  });

  if (!project) redirect('/projects');

  const reportData = await getProjectReportData(projectId);

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      <div className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        <div className="flex flex-col gap-4">
          <nav className="flex items-center text-sm font-medium text-gray-500">
            <Link
              href="/reports/material-reconciliation"
              className="hover:text-green-600 transition-colors flex items-center bg-white px-3 py-1.5 rounded-lg border border-gray-200 shadow-sm"
            >
              <ArrowLeftIcon className="h-4 w-4 mr-1.5 text-green-600" />
              Back to Material Reconciliation
            </Link>
          </nav>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm min-h-[500px] p-6">
          <ReportPrintHeader
            title="Materials Reconciliation"
            subTitle={`${project.name} (${project.projectNumber || 'No Ref'})`}
            hideTinVendor
            centerTitle
          />
          <MaterialReconciliationReport data={reportData} />
        </div>
      </div>
    </div>
  );
}
