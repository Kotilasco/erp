
import { prisma } from '@/lib/db';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth';
import { ButtonWithLoading as SubmitButton } from '@/components/ui/button-with-loading';
import { createPOFromRequisition } from '@/app/(protected)/projects/actions';

export default async function ProjectRequisitionsPage({ params }: { params: { projectId: string } }) {
  const user = await getCurrentUser();
  if (!user) return redirect('/sign-in');

  const { projectId } = params;
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
      <div className="flex items-center justify-between border-b pb-4">
        <div>
           <h1 className="text-2xl font-bold text-gray-900">Requisitions</h1>
           <p className="text-sm text-gray-500">Manage material requests for {project.projectNumber || 'this project'}.</p>
        </div>
        <div className="flex gap-2">
            <Link
                href={`/projects/${projectId}`}
                className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
            >
                Back to Dashboard
            </Link>
            {isPM && (
            <Link
                href={`/projects/${projectId}/requisitions/new`}
                aria-disabled={opsLocked}
                className={`inline-flex items-center justify-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 ${opsLocked ? 'pointer-events-none opacity-50' : ''}`}
            >
                Create Requisition
            </Link>
            )}
        </div>
      </div>

      <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Ref</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Created</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {project.requisitions.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-sm text-gray-500">
                    No requisitions found.
                  </td>
                </tr>
              ) : (
                project.requisitions.map((req) => {
                  const po = purchaseOrders.find((p) => p.requisitionId === req.id);
                  return (
                    <tr key={req.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-600">
                        #{req.id.slice(0, 8)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(req.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${
                          req.status === 'APPROVED' ? 'bg-green-50 text-green-700 ring-green-600/20' :
                          req.status === 'REJECTED' ? 'bg-red-50 text-red-700 ring-red-600/20' :
                          'bg-gray-100 text-gray-600 ring-gray-500/10'
                        }`}>
                          {req.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                        <Link
                          href={`/procurement/requisitions/${req.id}`}
                          className="text-indigo-600 hover:text-indigo-900"
                        >
                          View
                        </Link>
                        {po ? (
                          <Link
                            href={`/procurement/purchase-orders/${po.id}`}
                            className="text-emerald-600 hover:text-emerald-900"
                          >
                            PO ({po.status})
                          </Link>
                        ) : (
                          req.status === 'APPROVED' &&
                          isProc && (
                            <form
                              action={async (fd) => {
                                'use server';
                                await createPOFromRequisition(req.id, fd);
                              }}
                              className="inline-flex items-center gap-2"
                            >
                              <input
                                name="vendor"
                                placeholder="Vendor"
                                required
                                className="h-7 w-24 rounded border px-2 text-xs"
                              />
                              <SubmitButton className="text-indigo-600 hover:text-indigo-900">
                                Create PO
                              </SubmitButton>
                            </form>
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
