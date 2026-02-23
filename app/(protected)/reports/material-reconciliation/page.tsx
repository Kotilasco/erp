import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import PrintHeader from '@/components/PrintHeader';
import { getProjectsForReports } from '../../projects/actions';
import ReportsProjectList from '../ReportsProjectList';
import { ClipboardDocumentListIcon } from '@heroicons/react/24/outline';

export default async function MaterialReconciliationReportsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  if (['ACCOUNTS', 'ACCOUNTING_CLERK', 'ACCOUNTING_OFFICER', 'ACCOUNTING_AUDITOR'].includes(user.role as string)) {
    redirect('/dashboard');
  }
  const projects = await getProjectsForReports();

  return (
    <div className="p-6 space-y-8 max-w-[1600px] mx-auto min-h-screen">
      <PrintHeader />

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-700/10">
              Project Materials
            </span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 flex items-center gap-3">
            <ClipboardDocumentListIcon className="h-8 w-8 text-gray-400" />
            Material Reconciliation
          </h1>
          <p className="text-gray-500 mt-2">
            Select a project below to view detailed material reconciliation based on quoted
            quantities and actual deliveries.
          </p>
        </div>
      </div>

      <ReportsProjectList projects={projects} viewPath="reports/material-reconciliation" />
    </div>
  );
}
