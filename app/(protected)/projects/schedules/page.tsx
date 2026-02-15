import Link from 'next/link';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { assertRoles } from '@/lib/workflow';
import { redirect } from 'next/navigation';
import { WorkflowStatusBadge } from '@/components/ui/workflow-status-badge';
import TablePagination from '@/components/ui/table-pagination';
import ProjectTableToolbar from '../components/ProjectTableToolbar';
import { CalendarIcon, HashtagIcon, UserIcon, MapPinIcon, EyeIcon } from '@heroicons/react/24/outline';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const DEFAULT_PAGE_SIZE = 20;

export default async function ProjectSchedulesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; pageSize?: string }>;
}) {
  const me = await getCurrentUser();
  if (!me) redirect('/login');

  assertRoles(me.role as any, ['ADMIN', 'PROJECT_OPERATIONS_OFFICER', 'PROJECT_COORDINATOR', 'MANAGING_DIRECTOR']);

  const { q: query, page: pageParam, pageSize: pageSizeParam } = await searchParams;
  const currentPage = parseInt(pageParam || '1', 10);
  const pageSize = parseInt(pageSizeParam || String(DEFAULT_PAGE_SIZE), 10);
  const skip = (currentPage - 1) * pageSize;

  const where: any = {
    schedules: { isNot: null }, // Only show projects that HAVE a schedule initialized
    ...(query
      ? {
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { projectNumber: { contains: query, mode: 'insensitive' } },
            { quote: { customer: { displayName: { contains: query, mode: 'insensitive' } } } },
          ],
        }
      : {}),
    ...(me.role === 'PROJECT_OPERATIONS_OFFICER' ? { assignedToId: me.id } : {}),
  };

  const [projects, totalCount] = await Promise.all([
    prisma.project.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        quote: {
          select: {
            number: true,
            customer: { select: { displayName: true, city: true } },
          },
        },
        assignedTo: { select: { name: true } },
        schedules: {
          select: {
            hasConflict: true,
            _count: {
              select: {
                items: { where: { hasConflict: true } }
              }
            }
          }
        }
      },
      take: pageSize,
      skip,
    }),
    prisma.project.count({ where }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 border-b border-gray-200 pb-6">
        <div className="p-2 bg-blue-100 rounded-lg dark:bg-blue-900/30">
          <CalendarIcon className="h-8 w-8 text-barmlo-blue dark:text-blue-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">Project Schedules</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">View and manage project timelines and resource allocations.</p>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden dark:border-gray-700 dark:bg-gray-800">
        <div className="p-4 border-b border-gray-100 dark:border-gray-700">
           <ProjectTableToolbar showDateFilter={false} />
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900/50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-500">Ref</th>
                <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-500">Customer</th>
                <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-500">Conflicts</th>
                <th className="px-6 py-4 text-center text-xs font-bold uppercase tracking-wider text-gray-500">Status</th>
                <th className="px-6 py-4 text-center text-xs font-bold uppercase tracking-wider text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white dark:bg-gray-800 dark:divide-gray-700">
              {projects.map((project) => {
                const conflictCount = project.schedules?._count?.items || 0;
                const hasConflicts = conflictCount > 0;

                return (
                  <tr key={project.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors text-sm">
                    <td className="px-6 py-4 font-semibold text-gray-900 dark:text-gray-100">
                       <div className="flex items-center gap-2">
                          <HashtagIcon className="h-4 w-4 text-gray-400" />
                          {project.projectNumber || project.id.slice(0, 8)}
                       </div>
                    </td>
                    <td className="px-6 py-4 text-gray-600 dark:text-gray-300">
                       <div className="flex items-center gap-2">
                          <UserIcon className="h-4 w-4 text-gray-400" />
                          {project.quote?.customer?.displayName || 'Unknown'}
                       </div>
                    </td>
                    <td className="px-6 py-4">
                       {hasConflicts ? (
                          <div className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-2.5 py-1 text-xs font-bold text-red-700 ring-1 ring-inset ring-red-600/20 shadow-sm animate-pulse">
                             <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                             </span>
                             {conflictCount} Conflicts
                          </div>
                       ) : (
                          <span className="text-gray-400 text-xs italic">No conflicts</span>
                       )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <WorkflowStatusBadge status={project.status} />
                    </td>
                    <td className="px-6 py-4 text-center">
                      <Link
                        href={`/projects/${project.id}/schedule`}
                        className={cn(
                          "inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-bold text-white transition-all shadow-sm",
                          hasConflicts 
                            ? "bg-red-600 hover:bg-red-700 ring-2 ring-red-500/20" 
                            : "bg-barmlo-blue hover:bg-barmlo-blue/90"
                        )}
                      >
                        <EyeIcon className="h-3.5 w-3.5" />
                        View Schedule
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="border-t border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-800/50">
           <TablePagination total={totalCount} currentPage={currentPage} pageSize={pageSize} />
        </div>
      </div>
    </div>
  );
}
