
import { prisma } from '@/lib/db';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth';
import { ButtonWithLoading as SubmitButton } from '@/components/ui/button-with-loading';
import { createDispatchFromSelectedInventory } from '@/app/(protected)/projects/actions';
import DispatchTableClient from '@/components/DispatchTableClient';
import { cn } from '@/lib/utils';

export default async function ProjectDispatchesPage({ params }: { params: { projectId: string } }) {
  const user = await getCurrentUser();
  if (!user) return redirect('/sign-in');

  const { projectId } = params;
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      dispatches: { orderBy: { createdAt: 'desc' }, include: { items: true } },
      schedules: { include: { items: true } },
      requisitions: { include: { items: true } },
    },
  });

  if (!project) return notFound();

  // Role checks
  const isPM = ['PROJECT_OPERATIONS_OFFICER', 'PROJECT_COORDINATOR', 'ADMIN'].includes(user.role ?? '');
  // Safely handle schedules whether it is 1-1 or 1-many
  const schedule = project.schedules;
  const opsLocked = project.status === 'DEPOSIT_PENDING' || !schedule;

  // Calculate dispatchable items (logic from main page)
  // 1. Get all approved requisition items
  const approvedReqItems = await prisma.procurementRequisitionItem.findMany({
    where: {
      requisition: { projectId: projectId, status: 'APPROVED' },
    },
  });

  // 2. Get all dispatched items linked to requisition items
  const dispatchedItems = await prisma.dispatchItem.findMany({
    where: {
      dispatch: { projectId },
      requisitionItemId: { not: null },
    },
  });

  // 3. Map to find remaining qty
  const dispatchableItems = approvedReqItems
    .map((ri) => {
      const dispatched = dispatchedItems
        .filter((di) => di.requisitionItemId === ri.id)
        .reduce((sum, di) => sum + Number(di.qty), 0);
      const remaining = Number(ri.qty) - dispatched;
      if (remaining <= 0) return null;
      return {
        ...ri,
        remaining,
        dispatched,
      };
    })
    .filter(Boolean) as any[];

  // Multipurpose inventory for ad-hoc dispatch
  const multipurposeInventory = await prisma.inventoryItem.findMany({
    where: { category: 'MULTIPURPOSE', qty: { gt: 0 } },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b pb-4">
        <div>
           <h1 className="text-2xl font-bold text-gray-900">Dispatches</h1>
           <p className="text-sm text-gray-500">Manage material movements.</p>
        </div>

        <div className="flex gap-2">
            <Link
                href={`/projects/${projectId}`}
                className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
            >
                Back to Dashboard
            </Link>
             
             {/* Floating Action Buttons for Dispatch Creation */}
             {isPM && !opsLocked && (
                <div className="flex gap-2">
                    {/* 1. Standard Dispatch (Requisitions) */}
                    {(dispatchableItems.length > 0) && (
                        <form action={async () => {
                            'use server';
                            const { createAndRedirectDispatch } = await import('@/app/(protected)/dashboard/actions');
                            await createAndRedirectDispatch(projectId);
                        }}>
                             <SubmitButton 
                                className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700"
                             >
                                Create Dispatch
                             </SubmitButton>
                        </form>
                    )}

                    {/* 2. Stock Dispatch */}
                    {(multipurposeInventory.length > 0) && (
                        <form action={async () => {
                            'use server';
                            const { createAndRedirectStockDispatch } = await import('@/app/(protected)/projects/actions');
                            await createAndRedirectStockDispatch(projectId);
                        }}>
                            <SubmitButton className="rounded-md bg-cyan-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-cyan-700">
                                Dispatch from Stock
                            </SubmitButton>
                        </form>
                    )}

                    {/* 2. Assets Dispatch */}
                     {/* We need to check if assets exist. We can do a quick check here or just assume button validity 
                         if we want strictly "active if items in assets".
                         Let's do a server-side check. 
                     */}
                     {(await prisma.inventoryItem.count({ where: { category: 'ASSET', qty: { gt: 0 } } })) > 0 && (
                          <form action={async () => {
                            'use server';
                            const { createDispatchFromAssets } = await import('@/app/(protected)/projects/actions');
                            const res = await createDispatchFromAssets(projectId);
                             if (!res.ok) throw new Error(res.error);
                             redirect(`/projects/${projectId}/dispatches/${res.dispatchId}`);
                        }}>
                             <SubmitButton className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-700">
                                Create Dispatch from Assets
                             </SubmitButton>
                        </form>
                     )}
                </div>
            )}
        </div>
      </div>

      <div className="overflow-hidden bg-white shadow-sm ring-1 ring-gray-900/5 sm:rounded-lg">
        <table className="min-w-full divide-y divide-gray-300">
          <thead className="bg-gray-50">
            <tr>
              <th className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">Dispatch ID</th>
              <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Date</th>
              <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Status</th>
              <th className="px-3 py-3.5 text-right text-sm font-semibold text-gray-900">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {project.dispatches.length === 0 ? (
                <tr><td colSpan={4} className="py-8 text-center text-sm text-gray-500">No dispatches found.</td></tr>
            ) : (
                project.dispatches.map((d: any) => (
                <tr key={d.id}>
                    <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">#{d.id.slice(0, 8)}</td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{new Date(d.createdAt).toLocaleString()}</td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                      <span className="inline-flex items-center rounded-md bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600 ring-1 ring-inset ring-gray-500/10">
                        {d.status}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-right text-sm font-medium">
                    <Link href={`/projects/${d.projectId}/dispatches/${d.id}`} className="text-indigo-600 hover:text-indigo-900">Open</Link>
                    </td>
                </tr>
                ))
            )}
            </tbody>
        </table>
      </div>
    </div>
  );
}

