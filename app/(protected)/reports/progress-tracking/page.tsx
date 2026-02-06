import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeftIcon,
  ChartBarSquareIcon,
  GlobeAltIcon
} from '@heroicons/react/24/outline';
import PrintHeader from '@/components/PrintHeader';
import PrintButton from '@/components/PrintButton';
import TablePagination from '@/components/ui/table-pagination';
import PageSizeSelector from '@/components/ui/page-size-selector';

export default async function GlobalProgressTrackingPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; pageSize?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  
  const { page: pageStr, pageSize: pageSizeStr } = await searchParams;
  const currentPage = Number(pageStr) || 1;
  const pageSize = Number(pageSizeStr) || 10;

  const allowedRoles = ['PM_CLERK', 'PROJECT_OPERATIONS_OFFICER', 'PROJECT_COORDINATOR', 'ADMIN', 'MANAGING_DIRECTOR', 'ACCOUNTING_CLERK', 'ACCOUNTING_OFFICER', 'ACCOUNTS'];
  if (!allowedRoles.includes(user.role)) return redirect('/reports');

  // Filter Logic
  const projectWhere = user.role === 'PROJECT_OPERATIONS_OFFICER' 
      ? { assignedToId: user.id } 
      : {};

  const projects = await prisma.project.findMany({
    where: projectWhere,
    include: {
      schedules: {
          include: {
              items: {
                  select: { status: true }
              }
          }
      },
      quote: {
          select: {
              customer: { select: { displayName: true } }
          }
      }
    }
  });

  const projectStats = projects.map(p => {
      const items = p.schedules?.items || [];
      const total = items.length;
      const done = items.filter(i => i.status === 'DONE').length;
      const inProgress = items.filter(i => i.status === 'IN_PROGRESS').length;
      const progressParam = total > 0 ? Math.round((done / total) * 100) : 0; 
      
      return {
          id: p.id,
          name: p.name || 'Untitled Project',
          customer: p.quote?.customer?.displayName,
          totalTasks: total,
          completedTasks: done,
          inProgressTasks: inProgress,
          pendingTasks: total - done - inProgress,
          progress: progressParam
      };
  }).filter(p => p.totalTasks > 0)
    .sort((a, b) => b.progress - a.progress);

  // Summary Metrics
  const totalProjects = projectStats.length;
  const avgProgress = totalProjects > 0 
    ? Math.round(projectStats.reduce((acc, curr) => acc + curr.progress, 0) / totalProjects) 
    : 0;
  const totalTasksGlobal = projectStats.reduce((acc, curr) => acc + curr.totalTasks, 0);
  const totalDoneGlobal = projectStats.reduce((acc, curr) => acc + curr.completedTasks, 0);

  // Pagination Logic
  const totalItems = projectStats.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const paginatedStats = projectStats.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="p-6 space-y-8 max-w-[1600px] mx-auto bg-slate-50 min-h-screen font-sans">
      <PrintHeader />
      
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-gray-200 pb-8">
        <div>
           <div className="flex items-center gap-2 mb-3">
              <span className="inline-flex items-center rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700 ring-1 ring-inset ring-indigo-700/10">
                Global Report
              </span>
              <span className="inline-flex items-center rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20">
                Live Data
              </span>
           </div>
           <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 flex items-center gap-3">
              <GlobeAltIcon className="h-10 w-10 text-indigo-600" />
              Consolidated Progress
           </h1>
           <p className="text-lg text-slate-500 mt-2 max-w-2xl">
             Real-time tracking of schedule tasks and completion status across all active projects.
           </p>
        </div>
        <div className="flex items-center gap-3">
            <Link
              href={`/reports`}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-5 py-3 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50 hover:text-gray-900 transition-all hover:shadow-md"
            >
              <ArrowLeftIcon className="h-4 w-4" />
              Reports Center
            </Link>
            <PrintButton />
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex items-center justify-between">
           <div>
              <p className="text-sm font-medium text-slate-500">Active Projects</p>
              <p className="text-3xl font-bold text-slate-900 mt-1">{totalProjects}</p>
           </div>
           <div className="h-12 w-12 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
              <GlobeAltIcon className="h-6 w-6" />
           </div>
        </div>
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex items-center justify-between">
           <div>
              <p className="text-sm font-medium text-slate-500">Avg. Completion</p>
              <p className="text-3xl font-bold text-slate-900 mt-1">{avgProgress}%</p>
           </div>
           <div className={`h-12 w-12 rounded-full flex items-center justify-center ${avgProgress >= 75 ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
              <ChartBarSquareIcon className="h-6 w-6" />
           </div>
        </div>
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex items-center justify-between">
           <div>
              <p className="text-sm font-medium text-slate-500">Total Tasks</p>
              <p className="text-3xl font-bold text-slate-900 mt-1">{totalTasksGlobal}</p>
           </div>
           <div className="h-12 w-12 rounded-full bg-purple-50 flex items-center justify-center text-purple-600">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
           </div>
        </div>
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex items-center justify-between">
           <div>
              <p className="text-sm font-medium text-slate-500">Tasks Completed</p>
              <p className="text-3xl font-bold text-slate-900 mt-1">{totalDoneGlobal}</p>
           </div>
           <div className="h-12 w-12 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
           </div>
        </div>
      </div>

      {projectStats.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-gray-300">
              <ChartBarSquareIcon className="mx-auto h-16 w-16 text-gray-300" />
              <h3 className="mt-4 text-lg font-semibold text-gray-900">No Active Projects Found</h3>
              <p className="mt-2 text-gray-500 max-w-sm mx-auto">There are currently no projects with active schedules. Start by creating a schedule for a project.</p>
          </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <ChartBarSquareIcon className="h-5 w-5 text-gray-500" />
              <h2 className="text-lg font-bold text-gray-900">Task Progress Tracking</h2>
            </div>
            <PageSizeSelector defaultSize={10} />
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Project</th>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Client</th>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/4">Progress</th>
                  <th scope="col" className="px-6 py-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Done</th>
                  <th scope="col" className="px-6 py-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Active</th>
                  <th scope="col" className="px-6 py-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Todo</th>
                  <th scope="col" className="px-6 py-4 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {paginatedStats.map((stat) => (
                  <tr key={stat.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className={`flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold ${
                          stat.progress === 100 ? 'bg-emerald-100 text-emerald-700' : 
                          stat.progress > 50 ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'
                        }`}>
                          {stat.name.charAt(0)}
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">
                            <Link href={`/projects/${stat.id}/schedule`} className="hover:text-indigo-600 hover:underline">
                              {stat.name}
                            </Link>
                          </div>
                          <div className="text-xs text-gray-500">ID: {stat.id.slice(-6).toUpperCase()}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{stat.customer || 'Unknown Client'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap align-middle">
                      <div className="w-full max-w-xs">
                        <div className="flex justify-between text-xs mb-1">
                          <span className="font-medium text-gray-700">{stat.progress}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                          <div 
                            className={`h-2.5 rounded-full ${
                                stat.progress === 100 ? 'bg-emerald-500' : 
                                stat.progress > 50 ? 'bg-blue-500' : 'bg-amber-400'
                            }`}
                            style={{ width: `${stat.progress}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                        {stat.completedTasks}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {stat.inProgressTasks}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        {stat.pendingTasks}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <Link 
                        href={`/projects/${stat.id}/reports/progress-tracking`} 
                        className="text-indigo-600 hover:text-indigo-900 inline-flex items-center gap-1 group/link"
                      >
                        Detailed Report
                        <span className="transition-transform group-hover/link:translate-x-1">&rarr;</span>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {/* Pagination */}
          {totalItems > 0 && (
            <div className="border-t border-gray-200 bg-gray-50 px-4 py-3">
              <TablePagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={totalItems}
                pageSize={pageSize}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
