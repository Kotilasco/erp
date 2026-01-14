import Link from 'next/link';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { assertRoles } from '@/lib/workflow';
import { redirect } from 'next/navigation';
import { DispatchStatusBadge } from '@/components/ui/dispatch-status-badge';
import TablePagination from '@/components/ui/table-pagination';
import DispatchTableToolbar from './components/DispatchTableToolbar';
import { TruckIcon, EyeIcon } from '@heroicons/react/24/outline';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function DispatchesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; status?: string; pageSize?: string; driver?: string }>;
}) {
  const me = await getCurrentUser();
  if (!me) redirect('/login');

  try {
    assertRoles(me.role as any, ['PROJECT_OPERATIONS_OFFICER', 'PROCUREMENT', 'SENIOR_PROCUREMENT', 'SECURITY', 'ADMIN', 'STORE_KEEPER', 'DRIVER'] as any);
  } catch {
    redirect('/projects');
  }

  const { q, page, status, pageSize, driver } = await searchParams;
  const currentPage = Math.max(1, Number(page || '1'));
  const size = Math.max(1, Number(pageSize || '20'));
  
  // Force driver view if the user is explicitly a driver role, or if URL param is set
  const isDriver = me.role === 'DRIVER';
  const isDriverView = isDriver || driver === 'me';

  const where: any = {};
  
  if (q) {
    where.OR = [
      { id: { contains: q, mode: 'insensitive' } },
      { createdBy: { name: { contains: q, mode: 'insensitive' } } },
      { project: { projectNumber: { contains: q, mode: 'insensitive' } } },
      { project: { quote: { customer: { displayName: { contains: q, mode: 'insensitive' } } } } },
    ];
  }

  if (status) {
    where.status = status === 'ALL' ? undefined : status;
    if (where.status === undefined) delete where.status; // Cleanup if ALL
  }

  // Enforce driver filter
  if (isDriverView) {
    where.assignedToDriverId = me.id;
  }

  const [dispatches, total] = await Promise.all([
    prisma.dispatch.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (currentPage - 1) * size,
      take: size,
      include: {
        createdBy: { select: { name: true } },
        project: {
          select: {
            projectNumber: true,
            quote: {
              select: {
                customer: { select: { displayName: true } }
              }
            }
          }
        },
      },
    }),
    prisma.dispatch.count({ where }),
  ]);

  const totalPages = Math.ceil(total / size);

  return (
    <div className="space-y-8 p-2 sm:p-4 max-w-7xl mx-auto">
      {/* Header Section */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b border-gray-200 pb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg dark:bg-blue-900/30">
            <TruckIcon className="h-8 w-8 text-barmlo-blue dark:text-blue-400" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">Dispatches</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Manage inventory dispatches and requests.
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden dark:border-gray-700 dark:bg-gray-800">
        <div className="p-4 border-b border-gray-100 dark:border-gray-700">
           <DispatchTableToolbar role={me.role} hideStatusFilter={isDriverView} />
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50/80 backdrop-blur-sm dark:bg-gray-900/50">
              <tr>
                <th scope="col" className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Ref #</th>
                <th scope="col" className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Project</th>
                <th scope="col" className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Requester</th>
                <th scope="col" className="px-6 py-4 text-center text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Status</th>
                <th scope="col" className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Date</th>
                <th scope="col" className="px-6 py-4 text-center text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-800">
              {dispatches.length === 0 ? (
                <tr>
                  <td className="px-6 py-12 text-center text-gray-500 dark:text-gray-400" colSpan={6}>
                    <div className="flex flex-col items-center justify-center gap-2">
                       <TruckIcon className="h-10 w-10 text-gray-300" />
                       <p className="text-base font-medium">No dispatches found</p>
                       <p className="text-sm">Try adjusting your filters.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                dispatches.map((d) => (
                  <tr key={d.id} className="group hover:bg-blue-50/30 transition-colors dark:hover:bg-gray-700/50">
                    <td className="px-6 py-4 text-sm font-semibold text-gray-900 dark:text-gray-100 font-mono">
                      {d.id.slice(0, 8).toUpperCase()}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                       <div className="flex flex-col">
                          <span className="font-medium text-gray-900 dark:text-gray-200">{d.project?.projectNumber || 'N/A'}</span>
                          <span className="text-xs text-gray-500">{d.project?.quote?.customer?.displayName}</span>
                       </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                      {d.createdBy?.name || '-'}
                    </td>
                    <td className="px-6 py-4 text-center">
                       <div className="flex justify-center">
                          <DispatchStatusBadge status={d.status} />
                       </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 font-mono">
                      {new Date(d.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <Link 
                        href={`/dispatches/${d.id}`}
                        className="inline-flex items-center gap-1 rounded border border-emerald-500 px-2 py-1 text-xs font-bold text-emerald-600 transition-colors hover:bg-emerald-50 dark:border-emerald-400 dark:text-emerald-400 dark:hover:bg-emerald-900/20"
                      >
                        <EyeIcon className="h-3.5 w-3.5" />
                        View
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        {total > 0 && (
          <div className="border-t border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-800/50">
            <TablePagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={total}
              pageSize={size}
            />
          </div>
        )}
      </div>
    </div>
  );
}
