
import Link from 'next/link';
import clsx from 'clsx';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { approveFunding, rejectFunding } from './actions';
import { fromMinor } from '@/lib/accounting';
import SubmitButton from '@/components/SubmitButton';
import { revalidatePath } from 'next/cache';
import { SearchInput } from '@/components/ui/search-input';

export default async function AccountsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const user = await getCurrentUser();
  if (!user) return <div className="p-6 text-sm text-gray-600">Authentication required.</div>;

  const resolvedParams = await searchParams;
  const { page, q, status, tab } = resolvedParams;
  const currentPage = Number(page) || 1;
  const itemsPerPage = 10;
  const currentTab = typeof tab === 'string' ? tab : 'funding'; // default to funding

  const currentStatus = (typeof status === 'string' ? status : undefined) ?? 'REQUESTED';

  const role = user.role ?? 'UNKNOWN';
  const canApprove = role === 'ACCOUNTING_OFFICER' || role === 'ACCOUNTS' || role === 'ADMIN';

  // --- FUNDING TAB LOGIC ---
  if (currentTab === 'funding') {
    // Build Filter
    const where: any = {};

    if (currentStatus && currentStatus !== 'ALL') {
      where.status = currentStatus;
    }

    if (q && typeof q === 'string') {
      where.OR = [
        { requisition: { project: { projectNumber: { contains: q, mode: 'insensitive' } } } },
        { requisition: { project: { quote: { number: { contains: q, mode: 'insensitive' } } } } },
        { requisition: { project: { quote: { customer: { displayName: { contains: q, mode: 'insensitive' } } } } } },
      ];
    }

    const [totalFundings, fundings] = await Promise.all([
      prisma.fundingRequest.count({ where }),
      prisma.fundingRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: {
          requisition: {
            include: {
              project: { include: { quote: { select: { number: true, customer: { select: { displayName: true } } } } } },
            },
          },
          approvedBy: { select: { name: true, email: true } },
          submittedBy: { select: { name: true, email: true } },
        },
        skip: (currentPage - 1) * itemsPerPage,
        take: itemsPerPage,
      }),
    ]);

    const totalPages = Math.ceil(totalFundings / itemsPerPage);

    return (
      <div className="min-h-screen bg-gray-50 p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h1 className="text-3xl font-bold text-gray-900">Funding Requests</h1>
          
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
               <form className="flex gap-2 items-center">
                   {/* Preserve search if changing filter, but here we just submit GET */}
                   {q && <input type="hidden" name="q" value={q} />}
                   <select
                     name="status"
                     defaultValue={currentStatus}
                     className="rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm py-2"
                   >
                     <option value="ALL">All Statuses</option>
                     <option value="REQUESTED">Requested</option>
                     <option value="APPROVED">Approved</option>
                     <option value="REJECTED">Rejected</option>
                     <option value="DISBURSED">Disbursed</option>
                   </select>
                   <button type="submit" className="px-3 py-2 bg-gray-100 rounded text-sm hover:bg-gray-200">Filter</button>
               </form>
               <div className="w-full sm:w-64">
                  <SearchInput placeholder="Search project, customer..." />
               </div>
          </div>
        </div>

        <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Ref / Project</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Customer</th>
                  <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Amount</th>
                  <th className="px-6 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Submitted By</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {fundings.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-sm text-gray-500">
                      No funding requests found.
                    </td>
                  </tr>
                ) : (
                  fundings.map((f) => {
                    const req = f.requisition!;
                    const proj = req.project!;
                    return (
                      <tr key={f.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                           <div className="flex flex-col">
                             <span>{proj.projectNumber || proj.quote?.number || proj.id.slice(0, 8)}</span>
                             <span className="text-xs text-gray-500 font-normal">Req: {req.id.slice(0,8)}</span>
                           </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {proj.quote?.customer?.displayName || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 font-medium">
                          {fromMinor(f.amountMinor).toFixed(2)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                           <span
                            className={clsx(
                              'inline-flex items-center rounded-md px-2.5 py-0.5 text-xs font-medium',
                              f.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-800' : 
                              f.status === 'REJECTED' ? 'bg-rose-100 text-rose-800' :
                              f.status === 'DISBURSED' ? 'bg-purple-100 text-purple-800' :
                              'bg-amber-100 text-amber-800'
                            )}
                          >
                            {f.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {f.submittedBy?.name || f.submittedBy?.email || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(f.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex items-center justify-end gap-2">
                             {/* Quick Actions for Pending */}
                             {canApprove && (f.status === 'PENDING' || f.status === 'REQUESTED') ? (
                              <div className="flex items-center gap-2">
                                {/* Inline approval form - simple */}
                                <form action={async () => { 'use server'; await approveFunding(f.id); }}>
                                  <SubmitButton className="text-emerald-600 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 px-2 py-1 rounded">Approve</SubmitButton>
                                </form>
                                <Link href={`/accounts/funding/${f.id}`} className="text-indigo-600 hover:text-indigo-900">Review</Link>
                              </div>
                             ) : (
                                <Link href={`/accounts/funding/${f.id}`} className="text-indigo-600 hover:text-indigo-900">Details</Link>
                             )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          {/* Pagination */}
          {totalPages > 1 && (
              <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                  <Link
                     href={{ query: { ...resolvedParams, page: Math.max(1, currentPage - 1) } }}
                     className={`text-sm font-medium text-gray-700 hover:text-gray-900 ${currentPage === 1 ? 'pointer-events-none opacity-50' : ''}`}
                  >
                     Previous
                  </Link>
                  <span className="text-sm text-gray-500">Page {currentPage} of {totalPages}</span>
                  <Link
                     href={{ query: { ...resolvedParams, page: Math.min(totalPages, currentPage + 1) } }}
                     className={`text-sm font-medium text-gray-700 hover:text-gray-900 ${currentPage === totalPages ? 'pointer-events-none opacity-50' : ''}`}
                  >
                     Next
                  </Link>
              </div>
          )}
        </div>
      </div>
    );
  }

  // --- RECEIPTS TAB LOGIC ---
  if (currentTab === 'receipts') {
     // Fetch Pending GRNs
     const pendingGrnPos = await prisma.purchaseOrder.findMany({
      where: {
        goodsReceivedNotes: { some: { status: 'PENDING' } },
      },
      include: {
        project: {
          select: {
            id: true,
            projectNumber: true,
            quote: { include: { customer: true } },
          },
        },
        goodsReceivedNotes: {
          select: { id: true, createdAt: true, status: true, vendorName: true, receiptNumber: true, receivedAt: true },
        },
      },
    });

     return (
      <div className="min-h-screen bg-gray-50 p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
             <Link href="/dashboard" className="text-gray-500 hover:text-gray-700">
               &larr; Dashboard
             </Link>
             <h1 className="text-3xl font-bold text-gray-900">Pending Receipts</h1>
          </div>
        </div>

        <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                   <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Project</th>
                   <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">PO #</th>
                   <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Pending GRNs</th>
                   <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Last Received</th>
                   <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Action</th>
                </tr>
              </thead>
               <tbody className="bg-white divide-y divide-gray-200">
                {pendingGrnPos.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-sm text-gray-500">
                      No pending receipts found.
                    </td>
                  </tr>
                ) : (
                  pendingGrnPos.map((po) => {
                     const pendingCount = po.goodsReceivedNotes.filter(g => g.status === 'PENDING').length;
                     const lastReceived = new Date(Math.max(...po.goodsReceivedNotes.map(g => g.createdAt.getTime()))).toLocaleString();
                     return (
                      <tr key={po.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                            {po.project?.projectNumber || 'N/A'}
                            <div className="text-xs text-gray-500 font-normal">{po.project?.quote?.customer?.displayName}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                           {po.id.slice(0, 8)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                           {pendingCount} Pending Note{pendingCount !== 1 ? 's' : ''}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                           {lastReceived}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                           <Link
                             href={`/procurement/purchase-orders/${po.id}`}
                             className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500"
                           >
                             Verify / Acknowledge
                           </Link>
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

  return null; // Should not happen with default logic fallback
}
