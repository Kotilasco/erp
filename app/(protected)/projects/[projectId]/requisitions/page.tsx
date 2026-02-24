
import { prisma } from '@/lib/db';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth';
import { ButtonWithLoading as SubmitButton } from '@/components/ui/button-with-loading';
import { ShoppingCartIcon, PlusIcon, ArrowLeftIcon, ClipboardDocumentListIcon, EyeIcon } from '@heroicons/react/24/outline';
import POORequisitionToolbar from '@/app/(protected)/requisitions/components/POORequisitionToolbar';
import TablePagination from '@/components/ui/table-pagination';
import { WorkflowStatusBadge } from '@/components/ui/workflow-status-badge';
import Money from '@/components/Money';

export default async function ProjectRequisitionsPage({ 
  params, 
  searchParams 
}: { 
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ q?: string; status?: string; page?: string; pageSize?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return redirect('/sign-in');

  const { projectId } = await params;
  const { q, status, page, pageSize } = await searchParams;

  const projectCheck = await prisma.project.findUnique({
    where: { id: projectId },
    select: { projectNumber: true, status: true, schedules: true } // Minimal check
  });
  if (!projectCheck) return notFound();

  // Role checks
  const isPM = ['PROJECT_OPERATIONS_OFFICER', 'PROJECT_COORDINATOR', 'ADMIN'].includes(user.role as string);
  const opsLocked = (projectCheck.status as string) === 'DEPOSIT_PENDING' || (projectCheck.status as string) === 'QUOTE_ACCEPTED' || !projectCheck.schedules; // Simplify lock check logic

  // Pagination & Filtering
  const currentPage = Math.max(1, parseInt(page || '1', 10));
  const size = Math.max(1, parseInt(pageSize || '20', 10));
  const skip = (currentPage - 1) * size;

  const where: any = { projectId };

  if (status) {
    where.status = status;
  }

  if (q) {
    where.OR = [
      { id: { contains: q, mode: 'insensitive' } },
      // Project filter is redundant here since we are IN a project, but we can search item descriptions if we want? 
      // For now, let's keep it simple: Search ID (Ref)
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

  // Helper to calculate total
  const calculateTotal = (req: any) => {
    return req.items.reduce((sum: number, item: any) => {
      const amount = Number(item.amountMinor ?? item.estPriceMinor ?? 0);
      return sum + amount;
    }, 0) / 100;
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Header Section */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b border-gray-200 pb-6">
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex h-16 w-16 items-center justify-center rounded-2xl bg-orange-100 text-orange-600 shadow-inner">
            <ShoppingCartIcon className="h-8 w-8" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">Requisitions</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Manage material requests for <span className="font-medium text-gray-900">{projectCheck.projectNumber || 'this project'}</span>.
            </p>
          </div>
        </div>
        <div className="flex gap-3">
            <Link
                href="/dashboard"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 shadow-sm border border-gray-300 transition-all hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2"
            >
                <ArrowLeftIcon className="h-4 w-4 stroke-2" />
                Back to Dashboard
            </Link>
            {isPM && (
            <Link
                href={`/projects/${projectId}/requisitions/new`}
                aria-disabled={opsLocked}
                className={`inline-flex items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-bold text-white shadow-md transition-all hover:bg-green-700 hover:shadow-lg hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 active:scale-95 ${opsLocked ? 'pointer-events-none opacity-50' : ''}`}
            >
                <PlusIcon className="h-5 w-5 stroke-2" />
                Create Requisition
            </Link>
            )}
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden dark:border-gray-700 dark:bg-gray-800">
        
        <div className="p-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50/30">
            <POORequisitionToolbar />
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900/50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Project</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Requisition</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Description</th>
                <th scope="col" className="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Status</th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Total</th>
                <th scope="col" className="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white dark:divide-gray-700 dark:bg-gray-800">
              {requisitions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <ClipboardDocumentListIcon className="h-10 w-10 text-gray-300" />
                        <p className="text-base font-medium">No requisitions found</p>
                        <p className="text-sm">Get started by creating a new requisition above.</p>
                      </div>
                  </td>
                </tr>
              ) : (
                requisitions.map((req) => (
                  <tr key={req.id} className="group hover:bg-orange-50/30 transition-colors dark:hover:bg-gray-700/50">
                     <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                        <div className="flex flex-col">
                           <span className="font-medium text-gray-900 dark:text-gray-200">
                               {req.project?.projectNumber || 'N/A'}
                           </span>
                           <span className="text-xs text-gray-500">{req.project?.quote?.customer?.displayName}</span>
                        </div>
                    </td>
                    <td className="px-6 py-4 text-sm font-semibold text-gray-900 dark:text-gray-100 font-mono">
                      {req.id.slice(0, 8).toUpperCase()}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700 font-medium group-hover:text-gray-900 dark:text-gray-400 dark:group-hover:text-gray-300">
                      <div className="max-w-[200px] truncate" title={req.items[0]?.description}>
                        {req.items[0]?.description || 'No items'}
                        {req.items.length > 1 && <span className="text-xs text-gray-400 ml-1">(+{req.items.length - 1} more)</span>}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                       <div className="flex justify-center">
                          <WorkflowStatusBadge status={req.status} />
                       </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-right font-mono font-medium text-gray-900 dark:text-gray-100">
                        <Money value={calculateTotal(req)} />
                    </td>
                    <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                            <Link 
                                href={`/projects/${req.project.id}/requisitions/${req.id}`}
                                className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 shadow-sm hover:bg-gray-50 hover:text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                            >
                                <EyeIcon className="h-3.5 w-3.5" />
                                View
                            </Link>
                        </div>
                    </td>
                  </tr>
                ))
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
