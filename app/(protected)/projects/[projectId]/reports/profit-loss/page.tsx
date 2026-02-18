import { getCurrentUser } from '@/lib/auth';
import { redirect, notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';
import ReportPrintHeader from '@/components/reports/ReportPrintHeader';
import MaterialReconciliationReport from '../components/MaterialReconciliationReport';
import { getProjectReportData } from '../actions';

export default async function ProjectPnLPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  // Verify Role
  if (!['ADMIN', 'MANAGING_DIRECTOR', 'ACCOUNTING_CLERK', 'ACCOUNTING_OFFICER', 'ACCOUNTS', 'PROJECT_OPERATIONS_OFFICER', 'PROJECT_COORDINATOR'].includes(user.role as string)) {
      return <div className="p-8">Unauthorized</div>;
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, name: true, projectNumber: true },
  });
  if (!project) return notFound();

  const reportData = await getProjectReportData(projectId);

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      <div className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        <div className="flex flex-col gap-4">
          <nav className="flex items-center text-sm font-medium text-gray-500">
            <Link
              href="/reports/profit-loss-projects"
              className="hover:text-green-600 transition-colors flex items-center bg-white px-3 py-1.5 rounded-lg border border-gray-200 shadow-sm"
            >
              <ArrowLeftIcon className="h-4 w-4 mr-1.5 text-green-600" />
              Back to Profit and Loss
            </Link>
          </nav>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm min-h-[500px] p-6">
          <ReportPrintHeader
            title="PROJECT PROFIT OR LOSS"
            subTitle={`${project.name} (${project.projectNumber || 'No Ref'})`}
            hideTinVendor
            centerTitle
          />
          <MaterialReconciliationReport
            data={reportData}
            surplusLabel="Profit or Loss"
            title="Project Profit or Loss"
            description="Comparing quoted limits vs actual deliveries to determine profit or loss."
          />
        </div>
      </div>
    </div>
  );
}
