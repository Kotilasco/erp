
import Link from 'next/link';
import clsx from 'clsx';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { fromMinor } from '@/lib/accounting';
import { SearchInput } from '@/components/ui/search-input';
import { 
  EyeIcon, 
  CheckIcon, 
  ClipboardDocumentCheckIcon,
  BanknotesIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  FunnelIcon,
  MagnifyingGlassIcon
} from '@heroicons/react/24/outline';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// Helper to format currency
const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
};

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
    const where: any = { AND: [] };

    // Status Filter
    if (currentStatus === 'REQUESTED') {
      where.AND.push({
        OR: [
          { status: 'REQUESTED' },
          { status: 'PENDING' },
          {
            status: 'POSTPONED',
            postponedUntil: { lte: new Date() }
          }
        ]
      });
    } else if (currentStatus === 'POSTPONED') {
         where.AND.push({ status: 'POSTPONED' });
    } else if (currentStatus && currentStatus !== 'ALL') {
      where.AND.push({ status: currentStatus });
    }

    // Search Filter
    if (q && typeof q === 'string') {
      where.AND.push({
        OR: [
          { requisition: { project: { projectNumber: { contains: q, mode: 'insensitive' } } } },
          { requisition: { project: { quote: { number: { contains: q, mode: 'insensitive' } } } } },
          { requisition: { project: { quote: { customer: { displayName: { contains: q, mode: 'insensitive' } } } } } },
        ]
      });
    }

    // Fetch Stats
    const statsRaw = await prisma.fundingRequest.groupBy({
      by: ['status'],
      _count: { id: true },
      _sum: { amountMinor: true },
    });

    const stats = {
      requested: statsRaw.find(s => s.status === 'REQUESTED') || { _count: { id: 0 }, _sum: { amountMinor: 0 } },
      approved: statsRaw.find(s => s.status === 'APPROVED') || { _count: { id: 0 }, _sum: { amountMinor: 0 } },
      rejected: statsRaw.find(s => s.status === 'REJECTED') || { _count: { id: 0 }, _sum: { amountMinor: 0 } },
      postponed: statsRaw.find(s => s.status === 'POSTPONED') || { _count: { id: 0 }, _sum: { amountMinor: 0 } },
      disbursed: statsRaw.find(s => s.status === 'DISBURSED') || { _count: { id: 0 }, _sum: { amountMinor: 0 } },
    };

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
      <div className="min-h-screen bg-gray-50/50 p-8 space-y-8">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Financial Overview</h1>
          <p className="text-gray-500">Manage and track funding requests and disbursements.</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <Link href={{ query: { ...resolvedParams, status: 'REQUESTED' } }} className="block">
            <Card className={clsx("border-none shadow-sm transition-all hover:shadow-md cursor-pointer", currentStatus === 'REQUESTED' ? 'ring-2 ring-indigo-500 bg-amber-100' : 'bg-amber-100')}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-black">Pending Requests</CardTitle>
                <ClockIcon className="h-5 w-5 text-black" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-black">{stats.requested._count.id}</div>
              </CardContent>
            </Card>
          </Link>

          <Link href={{ query: { ...resolvedParams, status: 'APPROVED' } }} className="block">
            <Card className={clsx("border-none shadow-sm transition-all hover:shadow-md cursor-pointer", currentStatus === 'APPROVED' ? 'ring-2 ring-emerald-500 bg-emerald-100' : 'bg-emerald-100')}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-black">Approved</CardTitle>
                <CheckCircleIcon className="h-5 w-5 text-black" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-black">{stats.approved._count.id}</div>
              </CardContent>
            </Card>
          </Link>

          <Link href={{ query: { ...resolvedParams, status: 'POSTPONED' } }} className="block">
            <Card className={clsx("border-none shadow-sm transition-all hover:shadow-md cursor-pointer", currentStatus === 'POSTPONED' ? 'ring-2 ring-orange-500 bg-orange-100' : 'bg-orange-100')}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-black">Postponed</CardTitle>
                <ClockIcon className="h-5 w-5 text-black" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-black">{stats.postponed._count.id}</div>
              </CardContent>
            </Card>
          </Link>
        </div>
          
        <div className="flex flex-col gap-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
             <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-50 rounded-lg">
                  <BanknotesIcon className="h-6 w-6 text-indigo-600" />
                </div>
                <h2 className="text-lg font-semibold text-gray-900">Funding Requests</h2>
             </div>
             
             <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                 <form className="flex gap-3 items-center w-full sm:w-auto">
                     {/* Preserve search if changing filter, but here we just submit GET */}
                     {q && <input type="hidden" name="q" value={q} />}
                     <div className="relative">
                        <FunnelIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <select
                          name="status"
                          defaultValue={currentStatus}
                          className="pl-9 pr-8 py-2 rounded-lg border-gray-200 text-sm focus:border-indigo-500 focus:ring-indigo-500 bg-gray-50 hover:bg-white transition-colors cursor-pointer"
                        >
                          <option value="ALL">All Statuses</option>
                          <option value="REQUESTED">Requested</option>
                          <option value="APPROVED">Approved</option>
                          <option value="POSTPONED">Postponed</option>
                        </select>
                     </div>
                     <button type="submit" className="hidden sm:block px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors shadow-sm">
                       Apply Filter
                     </button>
                 </form>
                 <div className="w-full sm:w-72">
                    <SearchInput placeholder="Search by project, quote or customer..." className="w-full" />
                 </div>
             </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50/80 backdrop-blur-sm">
                  <tr>
                    <th scope="col" className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Project Details</th>
                    <th scope="col" className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Customer</th>
                    <th scope="col" className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Amount</th>
                    <th scope="col" className="px-6 py-4 text-center text-xs font-semibold uppercase tracking-wider text-gray-500">Status</th>
                    <th scope="col" className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Submitted By</th>
                    <th scope="col" className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Date</th>
                    <th scope="col" className="px-6 py-4 text-center text-xs font-semibold uppercase tracking-wider text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {fundings.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <BanknotesIcon className="h-10 w-10 text-gray-300" />
                          <p className="text-sm font-medium text-gray-900">No funding requests found</p>
                          <p className="text-sm text-gray-500">Try adjusting your filters or search query</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    fundings.map((f) => {
                      const req = f.requisition!;
                      const proj = req.project!;
                      return (
                        <tr key={f.id} className="group hover:bg-gray-50/80 transition-all duration-200">
                          <td className="px-6 py-4">
                             <div className="flex flex-col gap-0.5">
                               <span className="font-semibold text-gray-900">{proj.projectNumber || proj.quote?.number || proj.id.slice(0, 8)}</span>
                               <span className="text-xs text-gray-500 font-mono">Req: {req.id.slice(0,8)}</span>
                             </div>
                          </td>
                          <td className="px-6 py-4">
                             <div className="flex items-center gap-2">
                                <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-700">
                                  {(proj.quote?.customer?.displayName || 'C').charAt(0)}
                                </div>
                                <span className="text-sm font-medium text-gray-700">{proj.quote?.customer?.displayName || '-'}</span>
                             </div>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <span className="text-sm font-bold text-gray-900 font-mono tracking-tight">
                              {formatCurrency(fromMinor(f.amountMinor))}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center">
                             <span
                              className={clsx(
                                'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold border',
                                f.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 
                                f.status === 'REJECTED' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                                f.status === 'DISBURSED' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                                'bg-amber-50 text-amber-700 border-amber-200'
                              )}
                            >
                              <span className={clsx("h-1.5 w-1.5 rounded-full", 
                                f.status === 'APPROVED' ? 'bg-emerald-500' : 
                                f.status === 'REJECTED' ? 'bg-rose-500' :
                                f.status === 'DISBURSED' ? 'bg-purple-500' :
                                'bg-amber-500'
                              )} />
                              {f.status}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-col">
                              <span className="text-sm font-medium text-gray-900">{f.submittedBy?.name || '-'}</span>
                              <span className="text-xs text-gray-500">{f.submittedBy?.email}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600 whitespace-nowrap">
                            {new Date(f.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <div className="flex items-center justify-center gap-2">
                               {canApprove && (f.status === 'PENDING' || f.status === 'REQUESTED') ? (
                                  <Link
                                      href={`/accounts/funding/${f.id}`}
                                      className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 transition-all"
                                  >
                                      <EyeIcon className="h-3.5 w-3.5 text-white" />
                                      Review
                                  </Link>
                               ) : (
                                  <Link
                                      href={`/accounts/funding/${f.id}`}
                                      className="inline-flex items-center gap-1.5 rounded-md bg-white px-3 py-1.5 text-xs font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 transition-all"
                                  >
                                      <EyeIcon className="h-3.5 w-3.5 text-gray-500" />
                                      View Details
                                  </Link>
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
                <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
                    <Link
                       href={{ query: { ...resolvedParams, page: Math.max(1, currentPage - 1) } }}
                       className={`inline-flex items-center px-4 py-2 text-sm font-medium rounded-md text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 ${currentPage === 1 ? 'pointer-events-none opacity-50' : ''}`}
                    >
                       Previous
                    </Link>
                    <span className="text-sm font-medium text-gray-700">Page {currentPage} of {totalPages}</span>
                    <Link
                       href={{ query: { ...resolvedParams, page: Math.min(totalPages, currentPage + 1) } }}
                       className={`inline-flex items-center px-4 py-2 text-sm font-medium rounded-md text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 ${currentPage === totalPages ? 'pointer-events-none opacity-50' : ''}`}
                    >
                       Next
                    </Link>
                </div>
            )}
          </div>
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

        <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800 p-4">
          <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900/50">
                <tr>
                   <th scope="col" className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Project</th>
                   <th scope="col" className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">PO #</th>
                   <th scope="col" className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Status</th>
                   <th scope="col" className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Last Received</th>
                   <th scope="col" className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Action</th>
                </tr>
              </thead>
               <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-800">
                {pendingGrnPos.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                      No pending receipts found.
                    </td>
                  </tr>
                ) : (
                  pendingGrnPos.map((po) => {
                     const pendingCount = po.goodsReceivedNotes.filter(g => g.status === 'PENDING').length;
                     const lastReceived = new Date(Math.max(...po.goodsReceivedNotes.map(g => g.createdAt.getTime()))).toLocaleString();
                     return (
                      <tr key={po.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                            {po.project?.projectNumber || 'N/A'}
                            <div className="text-xs text-gray-500 dark:text-gray-400 font-normal">{po.project?.quote?.customer?.displayName}</div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                           {po.id.slice(0, 8)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                           <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                             {pendingCount} Pending Note{pendingCount !== 1 ? 's' : ''}
                           </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                           {lastReceived}
                        </td>
                        <td className="px-4 py-3 text-center">
                           <div className="flex items-center justify-center">
                             <Link
                               href={`/procurement/purchase-orders/${po.id}`}
                               className="flex items-center gap-1 rounded border border-emerald-500 px-2 py-1 text-xs font-bold text-emerald-600 transition-colors hover:bg-emerald-50 dark:border-emerald-400 dark:text-emerald-400 dark:hover:bg-emerald-900/20"
                             >
                               <ClipboardDocumentCheckIcon className="h-3.5 w-3.5" />
                               Verify
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

  return null; // Should not happen with default logic fallback
}
