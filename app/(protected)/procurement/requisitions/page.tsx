import Link from 'next/link';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { RequisitionStatusBadge } from '@/components/ui/requisition-status-badge';
import TablePagination from '@/components/ui/table-pagination';
import RequisitionTableToolbar from './components/RequisitionTableToolbar';
import { ClipboardDocumentCheckIcon, PlusIcon, ShoppingBagIcon, HashtagIcon, FolderIcon, UserIcon, CurrencyDollarIcon, CalendarIcon, BoltIcon, DocumentTextIcon } from '@heroicons/react/24/outline';

export const dynamic = 'force-dynamic';
// Force rebuild
export const revalidate = 0;

export default async function RequisitionsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; tab?: string; pageSize?: string }>;
}) {
  const me = await getCurrentUser();
  if (!me) redirect('/login');

  const { q, page, tab, pageSize } = await searchParams;
  const currentPage = Math.max(1, Number(page || '1'));
  const size = Math.max(1, Number(pageSize || '20'));

  const currentTab = tab || 'funding_needed';

  const where: any = {};
  
  if (q) {
    where.OR = [
      { id: { contains: q, mode: 'insensitive' } },
      { submittedBy: { name: { contains: q, mode: 'insensitive' } } },
      { project: { projectNumber: { contains: q, mode: 'insensitive' } } },
      { project: { quote: { customer: { displayName: { contains: q, mode: 'insensitive' } } } } },
    ];
  }

  // Tab Logic
  if (currentTab === 'funding_needed') {
      where.status = 'SUBMITTED';
      where.funding = { none: { status: { in: ['REQUESTED', 'APPROVED'] } } };
      where.OR = [
          { note: null },
          { note: { not: { contains: 'Review request from Req' } } }
      ];
  } else if (currentTab === 'action_purchases') {
      where.status = { in: ['APPROVED', 'PARTIAL'] };
  } else if (currentTab === 'completed') {
      where.status = { in: ['COMPLETED', 'REJECTED'] };
  } else if (currentTab === 'my_requests') {
      where.submittedById = me.id;
  } else if (currentTab === 'pending_approval') {
      where.status = 'SUBMITTED';
      where.funding = { some: { status: 'REQUESTED' } };
  }

  const [requisitions, total] = await Promise.all([
    prisma.procurementRequisition.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (currentPage - 1) * size,
      take: size,
      include: {
        submittedBy: { select: { name: true } },
        project: {
          select: {
            projectNumber: true,
            quote: {
              select: {
                number: true,
                customer: { select: { displayName: true } }
              }
            }
          }
        },
        items: {
            select: {
                amountMinor: true
            }
        }
      },
    }),
    prisma.procurementRequisition.count({ where }),
  ]);

  const totalPages = Math.ceil(total / size);

  // Helper to calculate total amount
  const calculateTotal = (items: any[]) => {
      return items.reduce((sum, item) => sum + (Number(item.amountMinor) || 0), 0) / 100;
  };

  let pageTitle = 'Requisitions';
  let pageDesc = 'Manage purchase requisitions.';
  let PageIcon = ClipboardDocumentCheckIcon;

  if (currentTab === 'funding_needed') {
      pageTitle = 'Create Purchase Order';
      pageDesc = 'Requisitions approved but waiting to be converted into POs.';
      PageIcon = DocumentTextIcon;
  } else if (currentTab === 'action_purchases') {
      pageTitle = 'Procure';
      pageDesc = 'Items ready to be purchased from approved funding.';
      PageIcon = ShoppingBagIcon;
  } else if (currentTab === 'pending_approval') {
      pageTitle = 'Pending Approval';
      pageDesc = 'Requisitions waiting for manager approval.';
      PageIcon = ClipboardDocumentCheckIcon;
  }

  return (
    <div className="space-y-8 p-2 sm:p-4 max-w-7xl mx-auto">
      {/* Header Section */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b border-gray-200 pb-6">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-indigo-50 rounded-xl border border-indigo-100 dark:bg-indigo-900/30 dark:border-indigo-800">
            <PageIcon className="h-8 w-8 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">{pageTitle}</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {pageDesc}
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden dark:border-gray-700 dark:bg-gray-800">
        <div className="p-4 border-b border-gray-100 dark:border-gray-700">
           <RequisitionTableToolbar currentTab={currentTab} />
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50/80 backdrop-blur-sm dark:bg-gray-900/50">
              <tr>
                <th scope="col" className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    <div className="flex items-center gap-1">
                        <HashtagIcon className="h-3.5 w-3.5" />
                        Ref #
                    </div>
                </th>
                <th scope="col" className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    <div className="flex items-center gap-1">
                        <FolderIcon className="h-3.5 w-3.5" />
                        Project
                    </div>
                </th>
                <th scope="col" className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    <div className="flex items-center gap-1">
                        <UserIcon className="h-3.5 w-3.5" />
                        Requester
                    </div>
                </th>
                <th scope="col" className="px-6 py-4 text-right text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    <div className="flex items-center justify-end gap-1">
                        <CurrencyDollarIcon className="h-3.5 w-3.5" />
                        Amount
                    </div>
                </th>
                <th scope="col" className="px-6 py-4 text-center text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Status</th>
                <th scope="col" className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    <div className="flex items-center gap-1">
                        <CalendarIcon className="h-3.5 w-3.5" />
                        Date
                    </div>
                </th>
                <th scope="col" className="px-6 py-4 text-center text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    <div className="flex items-center justify-center gap-1">
                        <BoltIcon className="h-3.5 w-3.5" />
                        Action
                    </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-800">
              {requisitions.length === 0 ? (
                <tr>
                  <td className="px-6 py-12 text-center text-gray-500 dark:text-gray-400" colSpan={7}>
                    <div className="flex flex-col items-center justify-center gap-2">
                       <ClipboardDocumentCheckIcon className="h-10 w-10 text-gray-300" />
                       <p className="text-base font-medium">No requisitions found</p>
                       <p className="text-sm">Try adjusting your filters.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                requisitions.map((r) => (
                  <tr key={r.id} className="group hover:bg-blue-50/30 transition-colors dark:hover:bg-gray-700/50">
                    <td className="px-6 py-4 text-sm font-semibold text-gray-900 dark:text-gray-100 font-mono">
                      {r.id.slice(0, 8).toUpperCase()}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                        <div className="flex flex-col">
                           <span className="font-medium text-gray-900 dark:text-gray-200">
                               {r.project?.projectNumber || 'N/A'}
                           </span>
                           <span className="text-xs text-gray-500">{r.project?.quote?.customer?.displayName}</span>
                        </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                      {r.submittedBy?.name || '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-right font-medium text-gray-900 dark:text-gray-100">
                        {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(calculateTotal(r.items))}
                    </td>
                    <td className="px-6 py-4 text-center">
                       <div className="flex justify-center">
                          <RequisitionStatusBadge status={r.status} />
                       </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 font-mono">
                      {new Date(r.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <Link 
                        href={`/procurement/requisitions/${r.id}`}
                        className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 transition-all hover:bg-emerald-100 hover:border-emerald-300 hover:shadow-sm dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 dark:hover:bg-emerald-900/50"
                      >
                        {currentTab === 'action_purchases' ? (
                            <>
                                <ShoppingBagIcon className="h-4 w-4" />
                                Procure
                            </>
                        ) : (
                            <>
                                <PlusIcon className="h-4 w-4" />
                                Create
                            </>
                        )}
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        {total > 0 && (
          <div className="border-t border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-800/50">
            <TablePagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={total}
              pageSize={size}
            />
          </div>
        )}
      </div>
    </div>
  );
}
