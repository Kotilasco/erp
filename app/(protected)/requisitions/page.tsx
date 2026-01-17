
import Link from 'next/link';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { WorkflowStatusBadge } from '@/components/ui/workflow-status-badge';
import Money from '@/components/Money';
import { EyeIcon, ClipboardDocumentListIcon } from '@heroicons/react/24/outline';
import POORequisitionToolbar from './components/POORequisitionToolbar';
import TablePagination from '@/components/ui/table-pagination';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function RequisitionsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string; pageSize?: string }>;
}) {
  const me = await getCurrentUser();
  if (!me) return <div className="p-6 text-sm text-gray-600">Authentication required.</div>;

  const role = me.role as string;
  const isSeniorPM = ['PROJECT_COORDINATOR', 'ADMIN', 'GENERAL_MANAGER', 'MANAGING_DIRECTOR'].includes(role);
  const isPOO = role === 'PROJECT_OPERATIONS_OFFICER';

  // Only allow POO and Senior PMs (Coordinator)
  if (!isSeniorPM && !isPOO) {
    redirect('/dashboard');
  }

  const { q, status, page, pageSize } = await searchParams;
  const currentPage = Math.max(1, parseInt(page || '1', 10));
  const size = Math.max(1, parseInt(pageSize || '20', 10));
  const skip = (currentPage - 1) * size;

  const where: any = {};
  
  // If user is just a POO (and not a Senior role), filter by assigned projects
  if (isPOO && !isSeniorPM) {
    where.project = { assignedToId: me.id };
  }

  // Filter by Status
  if (status) {
    where.status = status;
  }

  // Search Logic (q)
  if (q) {
    where.OR = [
        { id: { contains: q, mode: 'insensitive' } },
        { project: { projectNumber: { contains: q, mode: 'insensitive' } } },
        { project: { name: { contains: q, mode: 'insensitive' } } },
        { project: { quote: { customer: { displayName: { contains: q, mode: 'insensitive' } } } } },
    ];
  }

  const [requisitions, totalCount] = await Promise.all([
      prisma.procurementRequisition.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: size,
        include: {
          project: {
            select: {
              id: true,
              projectNumber: true,
              name: true,
              quote: {
                select: {
                  customer: { select: { displayName: true, city: true } },
                },
              },
            },
          },
          items: {
            select: { description: true, amountMinor: true, estPriceMinor: true, qtyRequested: true },
          },
          submittedBy: { select: { name: true } }
        },
      }),
      prisma.procurementRequisition.count({ where }),
  ]);

  const totalPages = Math.ceil(totalCount / size);

  return (
    <div className="space-y-8 p-2 sm:p-4 max-w-7xl mx-auto">
      {/* Header Section */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b border-gray-200 pb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg dark:bg-blue-900/30">
            <ClipboardDocumentListIcon className="h-8 w-8 text-barmlo-blue dark:text-blue-400" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">Requisitions</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {isSeniorPM ? 'All project requisitions.' : 'Requisitions from your assigned projects.'}
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden dark:border-gray-700 dark:bg-gray-800">
        
        <div className="p-4 border-b border-gray-100 dark:border-gray-700">
            <POORequisitionToolbar />
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50/80 backdrop-blur-sm dark:bg-gray-900/50">
              <tr>
                <th scope="col" className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Project</th>
                <th scope="col" className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Requisition</th>
                <th scope="col" className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Description</th>
                <th scope="col" className="px-6 py-4 text-center text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Status</th>
                <th scope="col" className="px-6 py-4 text-right text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Total</th>
                <th scope="col" className="px-6 py-4 text-center text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-800">
              {requisitions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <ClipboardDocumentListIcon className="h-10 w-10 text-gray-300" />
                      <p className="text-base font-medium">No requisitions found</p>
                      <p className="text-sm">Try adjusting your filters.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                requisitions.map((req) => {
                  const totalMinor = req.items.reduce((acc, it) => acc + BigInt(it.amountMinor ?? it.estPriceMinor ?? 0n), 0n);
                  const firstItem = req.items[0]?.description || 'No items';
                  const itemCount = req.items.length;
                  const description = itemCount > 1 ? `${firstItem} + ${itemCount - 1} more` : firstItem;

                  return (
                    <tr key={req.id} className="group hover:bg-blue-50/30 transition-colors dark:hover:bg-gray-700/50">
                      <td className="px-6 py-4 text-sm font-semibold text-gray-900 dark:text-white">
                        <div className="flex flex-col">
                          <span>{req.project?.projectNumber || 'No Project'}</span>
                          <span className="text-xs text-gray-500 font-normal">{req.project?.quote?.customer?.displayName}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 font-mono">
                         {req.id.slice(0, 8)}...
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                        {description}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex justify-center">
                          <WorkflowStatusBadge status={req.status} />
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 dark:text-white font-medium text-right">
                        <Money minor={totalMinor} />
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                            <Link 
                                href={`/projects/${req.project.id}/requisitions/${req.id}`}
                                className="inline-flex items-center gap-1 rounded border border-emerald-500 px-2 py-1 text-xs font-bold text-emerald-600 transition-colors hover:bg-emerald-50 dark:border-emerald-400 dark:text-emerald-400 dark:hover:bg-emerald-900/20"
                            >
                                <EyeIcon className="h-3.5 w-3.5" />
                                View
                            </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        
        {totalCount > 0 && (
          <div className="border-t border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-800/50">
             <TablePagination
               currentPage={currentPage}
               totalPages={totalPages}
               totalItems={totalCount}
               pageSize={size}
             />
          </div>
        )}
      </div>
    </div>
  );
}
