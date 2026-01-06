// app/(protected)/requisitions/page.tsx
import Link from 'next/link';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { WorkflowStatusBadge } from '@/components/ui/workflow-status-badge';

export const dynamic = 'force-dynamic';

export default async function RequisitionsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const me = await getCurrentUser();
  if (!me) return <div className="p-6">Auth required.</div>;

  const { status, q } = await searchParams;
  const isPM = me.role === 'PROJECT_MANAGER';
  
  // Build where clause
  const where: any = {};
  
  if (isPM) {
    where.project = { assignedToId: me.id };
  }

  if (status && status !== 'ALL') {
    where.status = status;
  }

  // Date filter requested but not passed in params yet? User said "status and or date". 
  // Let's stick to status first as simpler, date needs range picker usually.

  const reqs = await prisma.procurementRequisition.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: {
      project: {
        select: {
          id: true,
          projectNumber: true,
          quote: { 
            select: { 
              number: true, 
              customer: { select: { displayName: true, city: true } } 
            } 
          } 
        } 
      },
      items: true,
      funding: true,
      submittedBy: { select: { name: true } }
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between bg-white p-4 rounded-lg border shadow-sm">
        <h1 className="text-xl font-semibold text-gray-900">Requisitions</h1>
        
        {/* Simple Filter - could be extracted */}
        <div className="flex items-center gap-2">
           <form className="flex gap-2">
             <select 
               name="status" 
               defaultValue={status || ''}
               className="rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              //  onChange="this.form.submit()" // Server Component form submission needs JS or a client component wrapper.
              //  For simplicity in this step, I'll just render it. 
              //  Actually, better to use a client component filter like DispatchFilter.
             >
               <option value="">All Statuses</option>
               <option value="DRAFT">Draft</option>
               <option value="SUBMITTED">Submitted</option>
               <option value="APPROVED">Approved</option>
               <option value="REJECTED">Rejected</option>
               <option value="COMPLETED">Completed</option>
             </select>
             <button type="submit" className="px-3 py-1 bg-gray-100 rounded text-sm hover:bg-gray-200">Filter</button>
           </form>
        </div>
      </div>

      <div className="rounded-md border bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Ref / Project</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Customer</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Created By</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Date</th>
                <th className="px-4 py-3 text-center font-medium text-gray-500">Status</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {reqs.length === 0 ? (
                <tr>
                   <td colSpan={6} className="px-4 py-8 text-center text-gray-500">No requisitions found.</td>
                </tr>
              ) : (
                reqs.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">
                         {r.project.quote?.number ?? r.project.projectNumber ?? r.projectId.slice(0,8)}
                      </div>
                      <div className="text-xs text-gray-500">
                         {r.items.length} items
                      </div>
                    </td>
                    <td className="px-4 py-3">
                       <div className="text-gray-900">
                         {r.project.quote?.customer?.displayName || 'Unknown'}
                       </div>
                       <div className="text-xs text-gray-500">
                         {r.project.quote?.customer?.city || '-'}
                       </div>
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                       {r.submittedBy?.name || '-'}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                       {new Date(r.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-center">
                       <WorkflowStatusBadge status={r.status} />
                    </td>
                    <td className="px-4 py-3 text-right">
                       <Link 
                         href={`/procurement/requisitions/${r.id}`}
                         className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-50"
                       >
                         View Details
                       </Link>
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
