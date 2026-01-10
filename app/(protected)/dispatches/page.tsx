import Link from 'next/link';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { WorkflowStatusBadge } from '@/components/ui/workflow-status-badge';
import { DispatchFilter } from './DispatchFilter';
import { getPendingDispatchItems } from '@/lib/dispatch-logic';
import ApproveDispatchButton from '@/components/ApproveDispatchButton';

export const runtime = 'nodejs';

export default async function DispatchListPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; search?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) {
    return <div>Please log in</div>;
  }

  const isSecurity = user.role === 'SECURITY';

  // Default status logic
  let defaultStatus = 'AWAITING';
  if (isSecurity) defaultStatus = 'APPROVED';

  const { status, search } = await searchParams;
  const currentStatus = status || defaultStatus;
  const searchTerm = search?.trim() || '';
  const isProjectManager = user.role === 'PROJECT_OPERATIONS_OFFICER';
  const isDriver = user.role === 'DRIVER';

  // State A: "Ready to Dispatch" (Calculated)
  let pendingItems: any[] = [];
  // State B: "Dispatch Records" (DB)
  let dispatches: any[] = [];

  // Security cannot see "AWAITING" items (creation flow)
  // Strictly enforce that Security ONLY sees APPROVED/DISPATCHED/DELIVERED
  if (currentStatus === 'AWAITING' && !searchTerm && !isSecurity && !isDriver) {
    pendingItems = await getPendingDispatchItems(user.id, user.role ?? 'USER');
  } else {
    const where: any = {};
    if (searchTerm) {
      where.OR = [
        { project: { projectNumber: { contains: searchTerm, mode: 'insensitive' } } },
        { project: { quote: { customer: { displayName: { contains: searchTerm, mode: 'insensitive' } } } } },
        { project: { quote: { customer: { city: { contains: searchTerm, mode: 'insensitive' } } } } },
      ];
    }
    if (isProjectManager) {
      where.project = { assignedToId: user.id };
    }

    if (user.role === 'DRIVER') {
      where.assignedToDriverId = user.id;
      // Driver sees: DISPATCHED (Open) or DELIVERED (History)
      // They should NOT see 'APPROVED' (waiting for security) or 'AWAITING'.
      if (currentStatus === 'ALL') {
          where.status = { in: ['DISPATCHED', 'DELIVERED'] };
      }
    }

    if (currentStatus !== 'ALL' && currentStatus !== 'AWAITING') {
      where.status = currentStatus;
    }

    if (isSecurity) {
       // Security can only see approved/dispatched/delivered.
       // If they request ALL or an invalid status, fallback to the allowed list.
       const allowedStats = ['APPROVED', 'DISPATCHED', 'DELIVERED'];
       if (currentStatus === 'ALL' || !allowedStats.includes(currentStatus)) {
          where.status = { in: allowedStats };
       } else {
          where.status = currentStatus;
       }
    }

    dispatches = await prisma.dispatch.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        items: true,
        project: {
          include: {
            quote: {
              include: {
                customer: true,
              },
            },
          },
        },
      },
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between bg-white p-4 rounded-lg border shadow-sm">
        <h1 className="text-xl font-semibold text-gray-900">Dispatches</h1>
        <DispatchFilter role={user.role ?? undefined} />
      </div>

      <div className="rounded-md border bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse" style={{ minWidth: '1000px' }}>
            <thead className="bg-muted/50 border-b bg-gray-50">
              <tr>
                {currentStatus === 'AWAITING' ? (
                  <>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">Project / Ref</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">Customer</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">Pending Items</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-500 w-[150px]">Action</th>
                  </>
                ) : (
                  <>
                    <th className="px-4 py-3 text-left font-medium text-gray-500 w-[120px]">Dispatch #</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">Customer</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">Location</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500 w-[120px]">Date</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">Driver</th>
                    <th className="px-4 py-3 text-center font-medium text-gray-500 w-[120px]">Status</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-500 w-[150px]">Action</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {currentStatus === 'AWAITING' ? (
                pendingItems.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                      No items ready for dispatch.
                    </td>
                  </tr>
                ) : (
                  pendingItems.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-2 text-gray-900 font-medium">
                        {item.projectNumber || item.id.slice(0, 8)}
                      </td>
                      <td className="px-4 py-2 text-gray-900">{item.customerName}</td>
                      <td className="px-4 py-2 text-gray-500">
                        {item.pendingCount} item{item.pendingCount !== 1 ? 's' : ''} ready
                      </td>
                      <td className="px-4 py-2 text-right">
                        <Link
                          href={`/projects/${item.id}/dispatches`}
                          className="inline-flex items-center justify-center rounded-md border border-transparent bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                        >
                          View Dispatches
                        </Link>
                      </td>
                    </tr>
                  ))
                )
              ) : dispatches.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                    No dispatches found.
                  </td>
                </tr>
              ) : (
                dispatches.map((dispatch) => (
                  <tr key={dispatch.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-2 font-mono text-xs text-gray-500">
                      {dispatch.id.slice(0, 8).toUpperCase()}
                    </td>
                    <td className="px-4 py-2 text-gray-900">
                      {dispatch.project?.quote?.customer?.displayName || 'Unknown'}
                    </td>
                    <td className="px-4 py-2 text-gray-500">
                      {dispatch.project?.quote?.customer?.city || '-'}
                    </td>
                    <td className="px-4 py-2 text-gray-500">
                      {new Date(dispatch.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-2 text-gray-500">
                      {dispatch.driverName || '-'}
                    </td>
                    <td className="px-4 py-2 text-center">
                      <div className="flex justify-center">
                         <WorkflowStatusBadge status={dispatch.status} />
                      </div>
                    </td>
                    <td className="px-4 py-2 text-right">
                      {dispatch.status === 'DRAFT' ? (
                        <Link
                          href={`/projects/${dispatch.projectId}/dispatches/${dispatch.id}`}
                          className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-3 py-1 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                        >
                          Edit
                        </Link>
                      ) : dispatch.status === 'SUBMITTED' && (user.role === 'PROJECT_OPERATIONS_OFFICER' || user.role === 'ADMIN') ? (
                        <div className="flex items-center justify-end gap-2">
                           <ApproveDispatchButton dispatchId={dispatch.id} />
                           <Link
                              href={`/dispatches/${dispatch.id}`}
                              className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-3 py-1 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                            >
                              View
                            </Link>
                        </div>
                      ) : (
                        <Link
                          href={`/dispatches/${dispatch.id}`}
                          className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-3 py-1 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                        >
                          View
                        </Link>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
