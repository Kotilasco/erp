import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import PrintHeader from '@/components/PrintHeader';
import { getProjectsForReports } from '../../projects/actions';
import ReportsProjectList from '../ReportsProjectList';
import { ChartPieIcon } from '@heroicons/react/24/outline';

export default async function ProfitLossProjectsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  // Match Material Reconciliation listing pattern and role guard
  const allowedRoles = ['PROJECT_COORDINATOR', 'ADMIN', 'MANAGING_DIRECTOR'];
  if (!allowedRoles.includes(user.role!)) return redirect('/reports');

  const projects = await getProjectsForReports();

  return (
    <div className="p-6 space-y-8 max-w-[1600px] mx-auto min-h-screen">
      <PrintHeader />

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-flex items-center rounded-md bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700 ring-1 ring-inset ring-indigo-700/10">
              Project Financials
            </span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 flex items-center gap-3">
            <ChartPieIcon className="h-8 w-8 text-gray-400" />
            Profit and Loss
          </h1>
          <p className="text-gray-500 mt-2">
            Select a project to view its profit and loss breakdown.
          </p>
        </div>
      </div>

      <ReportsProjectList projects={projects} viewPath="reports/profit-loss" />
    </div>
  );
}
