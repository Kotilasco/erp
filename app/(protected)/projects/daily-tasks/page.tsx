import Link from 'next/link';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { assertRoles } from '@/lib/workflow';
import { redirect } from 'next/navigation';
import { WorkflowStatusBadge } from '@/components/ui/workflow-status-badge';
import TablePagination from '@/components/ui/table-pagination';
import ProjectTableToolbar from '../components/ProjectTableToolbar';
import { ClipboardDocumentListIcon, HashtagIcon, UserIcon, MapPinIcon, EyeIcon } from '@heroicons/react/24/outline';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const DEFAULT_PAGE_SIZE = 20;
import GlobalDailyReportGenerator from './components/GlobalDailyReportGenerator';

export default async function ProjectDailyTasksPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; pageSize?: string }>;
}) {
  const me = await getCurrentUser();
  if (!me) redirect('/login');

  assertRoles(me.role as any, ['ADMIN', 'PROJECT_OPERATIONS_OFFICER', 'PROJECT_COORDINATOR', 'MANAGING_DIRECTOR', 'PM_CLERK']);

  const { q: query, page: pageParam, pageSize: pageSizeParam } = await searchParams;
  const currentPage = parseInt(pageParam || '1', 10);
  const pageSize = parseInt(pageSizeParam || String(DEFAULT_PAGE_SIZE), 10);
  const skip = (currentPage - 1) * pageSize;

  const where: any = {
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
      },
      take: pageSize,
      skip,
    }),
    prisma.project.count({ where }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-gray-200 pb-6">
        <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 rounded-lg dark:bg-emerald-900/30">
            <ClipboardDocumentListIcon className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">Project Daily Tasks</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Track and manage ground-level execution and daily work progress.</p>
            </div>
        </div>
        <div>
            <GlobalDailyReportGenerator />
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
                <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-500">Location</th>
                <th className="px-6 py-4 text-center text-xs font-bold uppercase tracking-wider text-gray-500">Status</th>
                <th className="px-6 py-4 text-center text-xs font-bold uppercase tracking-wider text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white dark:bg-gray-800 dark:divide-gray-700">
              {projects.map((project) => (
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
                  <td className="px-6 py-4 text-gray-500 dark:text-gray-400">
                     <div className="flex items-center gap-2">
                        <MapPinIcon className="h-4 w-4 text-gray-400" />
                        {project.quote?.customer?.city || '-'}
                     </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <WorkflowStatusBadge status={project.status} />
                  </td>
                  <td className="px-6 py-4 text-center">
                    <Link
                      href={`/projects/${project.id}/daily-tasks`}
                      className="inline-flex items-center gap-1 rounded-lg border border-emerald-600 bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white transition-all hover:bg-emerald-600/90 shadow-sm"
                    >
                      <EyeIcon className="h-3.5 w-3.5" />
                      View
                    </Link>
                  </td>
                </tr>
              ))}
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
