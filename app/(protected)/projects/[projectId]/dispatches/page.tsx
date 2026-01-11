import { prisma } from '@/lib/db';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth';
import { ButtonWithLoading as SubmitButton } from '@/components/ui/button-with-loading';
import { createDispatchFromSelectedInventory } from '@/app/(protected)/projects/actions';
import DispatchTableClient from '@/components/DispatchTableClient';
import { cn } from '@/lib/utils';
import { EyeIcon } from '@heroicons/react/24/outline';
import DispatchFilter from './DispatchFilter';
import QuotePagination from '@/app/(protected)/quotes/components/QuotePagination';

export default async function ProjectDispatchesPage(props: { 
  params: Promise<{ projectId: string }>, 
  searchParams: Promise<{ [key: string]: string | string[] | undefined }> 
}) {
  const user = await getCurrentUser();
  if (!user) return redirect('/sign-in');

  const { projectId } = await props.params;
  const searchParams = await props.searchParams;
  
  const statusFilter = typeof searchParams.status === 'string' ? searchParams.status : undefined;
  const searchQuery = typeof searchParams.q === 'string' ? searchParams.q : undefined;
  const pageSize = typeof searchParams.pageSize === 'string' ? parseInt(searchParams.pageSize) : (typeof searchParams.show === 'string' ? parseInt(searchParams.show) : 20);
  const page = typeof searchParams.page === 'string' ? parseInt(searchParams.page) : 1;
  const skip = (page - 1) * pageSize;

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      schedules: { include: { items: true } },
      requisitions: { include: { items: true } },
      quote: { include: { customer: true } },
    },
  });

  if (!project) return notFound();

  // Fetch Dispatches with Pagination
  const where: any = {
    projectId,
    AND: [
        statusFilter && statusFilter !== 'All' ? { status: statusFilter as any } : {},
        searchQuery ? {
            OR: [
                { id: { contains: searchQuery, mode: 'insensitive' } },
                { dispatchNumber: { contains: searchQuery, mode: 'insensitive' } },
                { driverName: { contains: searchQuery, mode: 'insensitive' } },
            ]
        } : {}
    ]
  };

  const [dispatches, totalDispatches] = await Promise.all([
      prisma.dispatch.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take: pageSize,
          include: { items: true }
      }),
      prisma.dispatch.count({ where })
  ]);

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
      {/* Header Section */}
      <div className="space-y-6">
        <div className="border-b border-gray-200 pb-4">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">
            <span className="text-black font-semibold text-lg tracking-wide mr-2">Project Name:</span>
            {project.quote?.customer?.displayName || project.name}
          </h1>
        </div>

        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-end">
            <div className="flex flex-wrap items-center gap-2">
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
                                    className="rounded-md bg-orange-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-orange-700"
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
                                <SubmitButton className="rounded-md bg-orange-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-orange-700">
                                    Dispatch from Stock
                                </SubmitButton>
                            </form>
                        )}

                        {/* 2. Assets Dispatch */}
                         {(await prisma.inventoryItem.count({ where: { category: 'ASSET', qty: { gt: 0 } } })) > 0 && (
                              <form action={async () => {
                                'use server';
                                const { createDispatchFromAssets } = await import('@/app/(protected)/projects/actions');
                                const res = await createDispatchFromAssets(projectId);
                                 if (!res.ok) throw new Error(res.error);
                                 redirect(`/projects/${projectId}/dispatches/${res.dispatchId}`);
                            }}>
                                 <SubmitButton className="rounded-md bg-orange-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-orange-700">
                                    Create Dispatch from Assets
                                 </SubmitButton>
                            </form>
                         )}
                    </div>
                )}
            </div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800 p-4">
        {/* Filter Bar */}
        <DispatchFilter />

        <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900/50">
              <tr>
                <th scope="col" className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Dispatch ID</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Date</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Status</th>
                <th scope="col" className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-800">
              {dispatches.length === 0 ? (
                  <tr><td colSpan={4} className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">No dispatches found.</td></tr>
              ) : (
                  dispatches.map((d) => (
                  <tr key={d.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">#{d.id.slice(0, 8)}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{new Date(d.createdAt).toLocaleString()}</td>
                      <td className="px-4 py-3 text-sm">
                        <span className={cn(
                          "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide",
                          d.status === 'APPROVED' ? "bg-green-100 text-green-800" :
                          d.status === 'SUBMITTED' ? "bg-blue-100 text-blue-800" :
                          "bg-gray-100 text-gray-800"
                        )}>
                          {d.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Link 
                            href={`/projects/${projectId}/dispatches/${d.id}`} 
                            className="inline-flex items-center gap-1 rounded border border-orange-500 px-2 py-1 text-xs font-bold text-orange-600 transition-colors hover:bg-orange-50 dark:border-orange-400 dark:text-orange-400 dark:hover:bg-orange-900/20"
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

        <QuotePagination total={totalDispatches} currentPage={page} pageSize={pageSize} />
      </div>
    </div>
  );
}
