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

export default async function GlobalProgressTrackingPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

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
      const progressParam = total > 0 ? Math.round((done / total) * 100) : 0; // Simple task completion %
      
      // Calculate "Planned" duration progress? Too complex for now, stick to task count.

      return {
          id: p.id,
          name: p.name || 'Untitled Project',
          customer: p.quote?.customer?.displayName,
          totalTasks: total,
          completedTasks: done,
          inProgressTasks: inProgress,
          progress: progressParam
      };
  }).filter(p => p.totalTasks > 0) // Only show active projects
    .sort((a, b) => b.progress - a.progress); // Sort by completion

  return (
    <div className="p-6 space-y-8 max-w-[1400px] mx-auto bg-gray-50 min-h-screen">
      <PrintHeader />
      
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200 pb-6">
        <div>
           <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center rounded-md bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10">
                Global Report
              </span>
           </div>
           <h1 className="text-3xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
              <GlobeAltIcon className="h-8 w-8 text-gray-400" />
              Consolidated Task Progress Report
           </h1>
           <p className="text-gray-500 mt-2">
             Tracking completion status of all active projects.
           </p>
        </div>
        <div className="flex items-center gap-3">
            <Link
              href={`/reports`}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 hover:text-gray-900 transition-all"
            >
              <ArrowLeftIcon className="h-4 w-4" />
              Reports Center
            </Link>
            <PrintButton />
        </div>
      </div>

      {projectStats.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border border-gray-200 border-dashed">
              <ChartBarSquareIcon className="mx-auto h-12 w-12 text-gray-300" />
              <h3 className="mt-2 text-sm font-semibold text-gray-900">No Active Projects</h3>
              <p className="mt-1 text-sm text-gray-500">No projects with scheduled tasks found.</p>
          </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
            {projectStats.map(stat => (
                <div key={stat.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h3 className="text-lg font-semibold text-gray-900">
                                <Link href={`/projects/${stat.id}/schedule`} className="hover:underline text-indigo-600">
                                    {stat.customer ? `${stat.customer} - ` : ''}{stat.name}
                                </Link>
                            </h3>
                            <p className="text-sm text-gray-500">{stat.completedTasks} of {stat.totalTasks} tasks completed</p>
                        </div>
                        <div className="text-right">
                             <span className={`text-2xl font-bold ${stat.progress === 100 ? 'text-emerald-600' : 'text-gray-900'}`}>
                                 {stat.progress}%
                             </span>
                        </div>
                    </div>
                    
                    {/* Progress Bar */}
                    <div className="w-full bg-gray-100 rounded-full h-4 overflow-hidden">
                        <div 
                            className={`h-4 rounded-full transition-all duration-500 ${stat.progress === 100 ? 'bg-emerald-500' : 'bg-blue-600'}`}
                            style={{ width: `${stat.progress}%` }}
                        />
                    </div>

                    <div className="mt-4 flex items-center justify-between text-xs text-gray-500">
                        <div className="flex gap-4">
                             <div className="flex items-center gap-1">
                                 <span className="w-2 h-2 rounded-full bg-blue-600" />
                                 Done: {stat.completedTasks}
                             </div>
                             <div className="flex items-center gap-1">
                                 <span className="w-2 h-2 rounded-full bg-amber-400" />
                                 In Progress: {stat.inProgressTasks}
                             </div>
                             <div className="flex items-center gap-1">
                                 <span className="w-2 h-2 rounded-full bg-gray-300" />
                                 Pending: {stat.totalTasks - stat.completedTasks - stat.inProgressTasks}
                             </div>
                        </div>
                        <Link href={`/projects/${stat.id}/reports`} className="text-indigo-600 hover:text-indigo-800 font-medium">
                            View Reports &rarr;
                        </Link>
                    </div>
                </div>
            ))}
        </div>
      )}
    </div>
  );
}
