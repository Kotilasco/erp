// app/(protected)/projects/[projectId]/reports/page.tsx
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeftIcon,
  ClipboardDocumentCheckIcon,
  PlayCircleIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  DocumentChartBarIcon,
} from '@heroicons/react/24/outline';
import PrintButton from '@/components/PrintButton';
import PrintHeader from '@/components/PrintHeader';
import ExcelExportButton from '@/components/ExcelExportButton';

export default async function ProjectReportsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      quote: {
        select: {
          number: true,
          customer: {
            select: {
              displayName: true,
            },
          },
        },
      },
    },
  });

  if (!project) return notFound();

  const schedule = await prisma.schedule.findUnique({
    where: { projectId },
    include: {
      items: {
        include: {
          assignees: {
            select: {
              id: true,
              givenName: true,
              surname: true,
            },
          },
          reports: {
            orderBy: { reportedForDate: 'desc' },
            include: {
              reporter: {
                select: { name: true },
              },
            },
          },
        },
        orderBy: { plannedStart: 'asc' },
      },
    },
  });

  if (!schedule) {
    return (
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Progress Reports</h1>
            <p className="text-sm text-gray-600">
              Project: {project.quote?.number ?? projectId}
            </p>
          </div>
          <Link
            href={`/projects/${projectId}`}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Back to Project
          </Link>
        </div>
        <div className="rounded-md border border-yellow-200 bg-yellow-50 p-4">
          <p className="text-sm text-yellow-800">
            No schedule found for this project. Create a schedule first to start tracking progress.
          </p>
        </div>
      </div>
    );
  }

  // Calculate statistics
  const totalTasks = schedule.items.length;
  const doneTasks = schedule.items.filter((i) => i.status === 'DONE').length;
  const activeTasks = schedule.items.filter((i) => i.status === 'ACTIVE').length;
  const onHoldTasks = schedule.items.filter((i) => i.status === 'ON_HOLD').length;
  const totalReports = schedule.items.reduce((sum, item) => sum + item.reports.length, 0);

  // Calculate progress for each task
  const tasksWithProgress = schedule.items.map((item) => {
    const totalCompleted = item.reports.reduce((sum, r) => sum + (r.usedQty || 0), 0);
    const planned = item.quantity || 0;
    const progress = planned > 0 ? (totalCompleted / planned) * 100 : 0;
    const remaining = Math.max(0, planned - totalCompleted);
    const variance = totalCompleted - planned;

    return {
      ...item,
      totalCompleted,
      progress: Math.min(100, progress),
      remaining,
      variance,
      isAhead: variance > 0,
      isBehind: progress < 100 && item.status === 'ACTIVE' && item.plannedEnd && new Date(item.plannedEnd) < new Date(),
    };
  });

  const behindSchedule = tasksWithProgress.filter((t) => t.isBehind).length;

  return (
    <div className="p-6 space-y-8 max-w-[1600px] mx-auto bg-gray-50 min-h-screen">
      <PrintHeader />
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200 pb-6">
        <div>
           <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10">
                Analytics & Reporting
              </span>
              <span className="text-sm text-gray-500">• {new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
           </div>
           <h1 className="flex items-center text-3xl font-bold tracking-tight text-gray-900">
              <span className="text-gray-500 font-medium text-xl mr-2">Project Name:</span>
              <span className="text-2xl font-bold text-gray-900">{project.quote?.customer?.displayName || project.name}</span>
           </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          {['PM_CLERK', 'PROJECT_OPERATIONS_OFFICER', 'PROJECT_COORDINATOR', 'ADMIN'].includes(user.role as string) && (
            <Link
              href={`/projects/${projectId}/daily-tasks`}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 shadow-sm transition-colors"
            >
              Daily Tasks
            </Link>
          )}
          <Link
            href={`/projects/${projectId}`}
            className="inline-flex items-center gap-2 rounded-lg border border-transparent bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 transition-colors"
          >
            <ArrowLeftIcon className="h-4 w-4" />
            Back to Project
          </Link>
          <ExcelExportButton tasks={tasksWithProgress} projectName={project.quote?.customer?.displayName || project.name || projectId} />
          <PrintButton />
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-gray-500 mb-1">Total Tasks</div>
            <div className="text-3xl font-bold text-gray-900">{totalTasks}</div>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <ClipboardDocumentCheckIcon className="h-6 w-6 text-gray-600" />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-gray-500 mb-1">Active</div>
            <div className="text-3xl font-bold text-green-600">{activeTasks}</div>
          </div>
          <div className="p-3 bg-green-50 rounded-lg">
            <PlayCircleIcon className="h-6 w-6 text-green-600" />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-gray-500 mb-1">Completed</div>
            <div className="text-3xl font-bold text-blue-600">{doneTasks}</div>
          </div>
          <div className="p-3 bg-blue-50 rounded-lg">
            <CheckCircleIcon className="h-6 w-6 text-blue-600" />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-gray-500 mb-1">Behind Schedule</div>
            <div className="text-3xl font-bold text-red-600">{behindSchedule}</div>
          </div>
          <div className="p-3 bg-red-50 rounded-lg">
            <ExclamationCircleIcon className="h-6 w-6 text-red-600" />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-gray-500 mb-1">Total Reports</div>
            <div className="text-3xl font-bold text-indigo-600">{totalReports}</div>
          </div>
          <div className="p-3 bg-indigo-50 rounded-lg">
            <DocumentChartBarIcon className="h-6 w-6 text-indigo-600" />
          </div>
        </div>
      </div>

      {/* Progress Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex items-center gap-2">
          <DocumentChartBarIcon className="h-5 w-5 text-gray-500" />
          <h2 className="text-lg font-bold text-gray-900">Task Progress Tracking</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-4 text-left font-semibold text-gray-900 uppercase tracking-wider text-xs">Task</th>
                <th className="px-6 py-4 text-left font-semibold text-gray-900 uppercase tracking-wider text-xs">Status</th>
                <th className="px-6 py-4 text-right font-semibold text-gray-900 uppercase tracking-wider text-xs">Planned</th>
                <th className="px-6 py-4 text-right font-semibold text-gray-900 uppercase tracking-wider text-xs">Completed</th>
                <th className="px-6 py-4 text-right font-semibold text-gray-900 uppercase tracking-wider text-xs">Remaining</th>
                <th className="px-6 py-4 text-right font-semibold text-gray-900 uppercase tracking-wider text-xs w-32">Progress</th>
                <th className="px-6 py-4 text-left font-semibold text-gray-900 uppercase tracking-wider text-xs">Last Report</th>
                <th className="px-6 py-4 text-left font-semibold text-gray-900 uppercase tracking-wider text-xs">Workers</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {tasksWithProgress.map((task) => {
                const lastReport = task.reports[0];
                const workerNames = task.assignees
                  .map((a) => [a.givenName, a.surname].filter(Boolean).join(' '))
                  .join(', ') || 'No workers assigned';
                const workerCount = task.assignees.length;

                return (
                  <tr key={task.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-bold text-gray-900">{task.title}</div>
                      {task.description && (
                        <div className="text-xs text-gray-500 mt-1 line-clamp-1">{task.description}</div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center justify-center rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide ${
                          task.status === 'DONE'
                            ? 'bg-blue-100 text-blue-800'
                            : task.status === 'ACTIVE'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-yellow-100 text-yellow-800'
                        }`}
                      >
                        {task.status}
                      </span>
                      {task.isBehind && (
                        <div className="flex items-center gap-1 text-xs text-red-600 mt-1.5 font-medium">
                          <ExclamationCircleIcon className="h-3 w-3" />
                          Behind
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right whitespace-nowrap text-gray-600">
                      {task.quantity} <span className="text-gray-400 text-xs">{task.unit}</span>
                    </td>
                    <td className="px-6 py-4 text-right whitespace-nowrap font-semibold text-gray-900">
                      {task.totalCompleted.toFixed(2)} <span className="text-gray-400 text-xs font-normal">{task.unit}</span>
                    </td>
                    <td className="px-6 py-4 text-right whitespace-nowrap text-gray-600">
                      {task.remaining.toFixed(2)} <span className="text-gray-400 text-xs">{task.unit}</span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex flex-col items-end gap-1">
                        <span className="font-bold text-gray-900">{task.progress.toFixed(0)}%</span>
                        <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              task.progress >= 100
                                ? 'bg-blue-600'
                                : task.progress >= 75
                                  ? 'bg-green-600'
                                  : task.progress >= 50
                                    ? 'bg-yellow-500'
                                    : 'bg-orange-500'
                            }`}
                            style={{ width: `${Math.min(100, task.progress)}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {lastReport ? (
                        <div>
                          <div className="text-xs font-medium text-gray-900">
                            {new Date(lastReport.reportedForDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                          </div>
                          <div className="text-xs text-gray-500 mt-0.5">
                            by {lastReport.reporter?.name || 'Unknown'}
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400 italic">No reports</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-xs font-medium text-gray-600" title={workerNames}>
                       {workerCount > 0 ? (
                         <div className="flex items-center gap-1">
                           <div className="flex -space-x-2 overflow-hidden">
                             {[...Array(Math.min(3, workerCount))].map((_, i) => (
                               <div key={i} className="inline-block h-6 w-6 rounded-full ring-2 ring-white bg-gray-200 flex items-center justify-center text-[10px] font-bold text-gray-500">
                                 {task.assignees[i]?.givenName?.[0] || 'U'}
                               </div>
                             ))}
                             {workerCount > 3 && (
                               <div className="inline-block h-6 w-6 rounded-full ring-2 ring-white bg-gray-100 flex items-center justify-center text-[9px] font-medium text-gray-500">
                                 +{workerCount - 3}
                               </div>
                             )}
                           </div>
                           <span className="ml-1 text-gray-500">{workerCount} Assigned</span>
                         </div>
                       ) : (
                         <span className="text-gray-400">-</span>
                       )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
