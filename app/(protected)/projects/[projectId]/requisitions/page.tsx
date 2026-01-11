
import { prisma } from '@/lib/db';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth';
import { ButtonWithLoading as SubmitButton } from '@/components/ui/button-with-loading';
import { createPOFromRequisition } from '@/app/(protected)/procurement/requisitions/[requisitionId]/actions';
import { ShoppingCartIcon, PlusIcon, ArrowLeftIcon } from '@heroicons/react/24/outline';

export default async function ProjectRequisitionsPage({ params }: { params: { projectId: string } }) {
  const user = await getCurrentUser();
  if (!user) return redirect('/sign-in');

  const { projectId } = await params;
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      schedules: true,
      requisitions: { orderBy: { createdAt: 'desc' } },
    },
  });

  if (!project) return notFound();

  // Role checks logic (copied from main page)
  const isPM = ['PROJECT_OPERATIONS_OFFICER', 'PROJECT_COORDINATOR', 'ADMIN'].includes(user.role);
  const isProc = ['PROCUREMENT', 'ADMIN'].includes(user.role);
  const opsLocked = project.status === 'DEPOSIT_PENDING' || project.status === 'QUOTE_ACCEPTED' || !project.schedules; // Simplify lock check logic

  // Fetch POs for these requisitions to show status
  const reqIds = project.requisitions.map((r) => r.id);
  const purchaseOrders = await prisma.purchaseOrder.findMany({
    where: { requisitionId: { in: reqIds } },
    select: { id: true, status: true, requisitionId: true },
  });

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b border-gray-200 pb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-orange-100 rounded-lg dark:bg-orange-900/30">
            <ShoppingCartIcon className="h-8 w-8 text-orange-600 dark:text-orange-400" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">Requisitions</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Manage material requests for <span className="font-medium text-gray-900">{project.projectNumber || 'this project'}</span>.
            </p>
          </div>
        </div>
        <div className="flex gap-3">
            <Link
                href={`/projects/${projectId}`}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-bold text-gray-700 shadow-sm border border-gray-300 transition-all hover:bg-orange-50 hover:text-orange-700 hover:border-orange-200 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2"
            >
                <ArrowLeftIcon className="h-4 w-4 stroke-2" />
                Back to Dashboard
            </Link>
            {isPM && (
            <Link
                href={`/projects/${projectId}/requisitions/new`}
                aria-disabled={opsLocked}
                className={`inline-flex items-center justify-center gap-2 rounded-lg bg-orange-600 px-4 py-2.5 text-sm font-bold text-white shadow-md transition-all hover:bg-orange-700 hover:shadow-lg hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 active:scale-95 ${opsLocked ? 'pointer-events-none opacity-50' : ''}`}
            >
                <PlusIcon className="h-5 w-5 stroke-2" />
                Create Requisition
            </Link>
            )}
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden dark:border-gray-700 dark:bg-gray-800">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50/80 backdrop-blur-sm dark:bg-gray-900/50">
              <tr>
                <th scope="col" className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Reference</th>
                <th scope="col" className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Created Date</th>
                <th scope="col" className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Status</th>
                <th scope="col" className="px-6 py-4 text-right text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-800">
              {project.requisitions.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <ShoppingCartIcon className="h-10 w-10 text-gray-300" />
                        <p className="text-base font-medium">No requisitions found</p>
                        <p className="text-sm">Get started by creating a new requisition above.</p>
                      </div>
                  </td>
                </tr>
              ) : (
                project.requisitions.map((req) => {
                  const po = purchaseOrders.find((p) => p.requisitionId === req.id);
                  return (
                    <tr key={req.id} className="group hover:bg-orange-50/30 transition-colors dark:hover:bg-gray-700/50">
                      <td className="px-6 py-4 whitespace-nowrap">
                         <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 font-bold border border-gray-200 group-hover:bg-orange-100 group-hover:text-orange-600 group-hover:border-orange-200 transition-colors text-xs">
                                REQ
                            </div>
                            <span className="font-mono text-sm font-semibold text-gray-900 dark:text-gray-100">
                                #{req.id.slice(0, 8)}
                            </span>
                         </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-medium">
                        {new Date(req.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide ring-1 ring-inset ${
                          req.status === 'APPROVED' ? 'bg-green-50 text-green-700 ring-green-600/20' :
                          req.status === 'REJECTED' ? 'bg-red-50 text-red-700 ring-red-600/20' :
                          'bg-gray-100 text-gray-600 ring-gray-500/10'
                        }`}>
                          {req.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-3">
                        <Link
                          href={`/projects/${projectId}/requisitions/${req.id}`}
                          className="inline-flex items-center justify-center rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-gray-700 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-orange-50 hover:text-orange-700 hover:ring-orange-200 transition-all"
                        >
                          View Details
                        </Link>
                        {po ? (
                          <Link
                            href={`/procurement/purchase-orders/${po.id}`}
                            className="inline-flex items-center justify-center rounded-lg bg-orange-50 px-3 py-1.5 text-sm font-semibold text-orange-700 ring-1 ring-inset ring-orange-600/20 hover:bg-orange-100 transition-all"
                          >
                            View PO ({po.status})
                          </Link>
                        ) : (
                          req.status === 'APPROVED' &&
                          isProc && (
                            <div className="inline-block">
                                <form
                                action={async (fd) => {
                                    'use server';
                                    await createPOFromRequisition(req.id, fd);
                                }}
                                className="inline-flex items-center gap-2"
                                >
                                <input
                                    name="vendor"
                                    placeholder="Vendor Name"
                                    required
                                    className="h-8 w-32 rounded border border-gray-300 px-2 text-xs focus:border-orange-500 focus:ring-orange-500"
                                />
                                <SubmitButton className="bg-orange-600 hover:bg-orange-700 text-white text-xs px-2 py-1 rounded shadow-sm transition-colors">
                                    Create PO
                                </SubmitButton>
                                </form>
                            </div>
                          )
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
