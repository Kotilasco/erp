import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { projectApprovedSpendMinor } from '@/lib/projectTotals';
import Link from 'next/link';
import clsx from 'clsx';
import { EyeIcon } from '@heroicons/react/24/outline';

const STATUS_BADGE: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  SUBMITTED: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  APPROVED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  REJECTED: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
  ORDERED: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  PURCHASED: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  PARTIAL: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  RECEIVED: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  COMPLETED: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
};

export default async function AccountsPOList({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const me = await getCurrentUser();
  if (!me) return <div className="p-6 text-sm text-gray-600">Authentication required.</div>;

  const { status } = await searchParams;
  const isSecurity = me.role === 'SECURITY';

  const where: any = {};

  if (isSecurity || status === 'INCOMING') {
     // Show POs that are ready to receive
     where.status = { in: ['SUBMITTED', 'APPROVED', 'PURCHASED', 'PARTIAL', 'ORDERED'] }; 
  } else if (status && status !== 'ALL') {
     where.status = status;
  }

  const pos = await prisma.purchaseOrder.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: { 
      requisition: { 
        include: { 
          project: {
             select: {
                id: true,
                projectNumber: true,
                quote: { select: { customer: { select: { displayName: true } } } }
             }
          }
        } 
      }, 
      items: true 
    },
    take: 50,
  });

  // example: show total used for the first project in list
  // Note: This logic seems specific to a "Project View" but is on a general list. 
  // We'll keep it as requested but style it better.
  const firstProjectId = pos[0]?.requisition.projectId;
  const used = firstProjectId ? await projectApprovedSpendMinor(firstProjectId) : 0n;

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
         <div>
           <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Purchase Orders</h1>
           <p className="text-sm text-gray-500 dark:text-gray-400">Manage and track purchase orders</p>
         </div>
      </div>

      {firstProjectId && (
        <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-blue-800 dark:border-blue-900/30 dark:bg-blue-900/20 dark:text-blue-300">
          <span className="font-semibold">Project spend to date:</span> {(Number(used)/100).toFixed(2)}
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800 p-4">
        <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900/50">
              <tr>
                <th scope="col" className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">PO Number</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Project / Customer</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Vendor</th>
                <th scope="col" className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Amount</th>
                <th scope="col" className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Status</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Date</th>
                <th scope="col" className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-800">
              {pos.length === 0 ? (
                 <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                       No purchase orders found.
                    </td>
                 </tr>
              ) : (
                pos.map((po) => {
                  const project = po.requisition?.project;
                  const customerName = project?.quote?.customer?.displayName;
                  
                  return (
                    <tr key={po.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                        {po.id.slice(0, 8)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                        <div className="flex flex-col">
                           <span className="font-medium text-gray-900 dark:text-white">{project?.projectNumber || 'N/A'}</span>
                           <span className="text-xs text-gray-500 dark:text-gray-400">{customerName || '-'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                        {po.vendor || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-medium text-gray-900 dark:text-white">
                        {(Number(po.requestedMinor)/100).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={clsx(
                            'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide',
                            STATUS_BADGE[po.status] || 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                          )}
                        >
                          {po.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">
                        {new Date(po.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center">
                           <Link
                              href={`/procurement/purchase-orders/${po.id}`}
                              className="flex items-center gap-1 rounded border border-emerald-500 px-2 py-1 text-xs font-bold text-emerald-600 transition-colors hover:bg-emerald-50 dark:border-emerald-400 dark:text-emerald-400 dark:hover:bg-emerald-900/20"
                           >
                              <EyeIcon className="h-3.5 w-3.5" />
                              Details
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
      </div>
    </div>
  );
}
