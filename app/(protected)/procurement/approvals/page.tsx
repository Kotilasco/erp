import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { CheckCircleIcon, XCircleIcon, EyeIcon } from '@heroicons/react/24/outline';
import { approveTopup, rejectTopup, approveRequisition } from './actions';

import TablePagination from '@/components/ui/table-pagination';
import ApprovalsTableToolbar from './components/ApprovalsTableToolbar';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ApprovalsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; page?: string; pageSize?: string; q?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const allowedRoles = ['SENIOR_PROCUREMENT', 'ADMIN', 'MANAGING_DIRECTOR', 'GENERAL_MANAGER'];
  if (!allowedRoles.includes(user.role as string)) return <div className="p-8">Access Denied</div>;

  const { view, page, pageSize, q } = await searchParams;
  
  // Default to reviews view for consistent URL/Sidebar state
  if (!view) {
      redirect('/procurement/approvals?view=reviews');
  }

  const isTopups = view === 'topups';
  const currentPage = Math.max(1, Number(page || '1'));
  const size = Math.max(1, Number(pageSize || '20'));
  const query = q || '';

  let topups: any[] = [];
  let reviewReqs: any[] = [];
  let total = 0;

  if (isTopups) {
      const where: any = {
          decidedAt: null,
          requestedById: { not: user.id } // Conflict of Interest Safety
      };

      if (query) {
          where.OR = [
             { requisitionItem: { description: { contains: query, mode: 'insensitive' } } },
             { requisitionItem: { requisition: { project: { projectNumber: { contains: query, mode: 'insensitive' } } } } },
             { requestedBy: { name: { contains: query, mode: 'insensitive' } } }
          ];
      }

      [topups, total] = await Promise.all([
          prisma.requisitionItemTopup.findMany({
            where,
            include: {
                requisitionItem: {
                    include: {
                        requisition: {
                            include: { project: true }
                        }
                    }
                },
                requestedBy: true
            },
            orderBy: { createdAt: 'desc' },
            skip: (currentPage - 1) * size,
            take: size,
          }),
          prisma.requisitionItemTopup.count({ where })
      ]);

  } else {
      const where: any = {
          OR: [
              {
                  status: 'SUBMITTED',
                  note: { contains: 'Review request from Req' },
              },
              {
                  status: 'AWAITING_APPROVAL'
              }
          ],
          submittedById: { not: user.id }
      };

      if (query) {
          where.AND = [
              {
                  OR: [
                     { project: { projectNumber: { contains: query, mode: 'insensitive' } } },
                     { id: { contains: query, mode: 'insensitive' } },
                     { submittedBy: { name: { contains: query, mode: 'insensitive' } } }
                  ]
              }
          ];
      }

      [reviewReqs, total] = await Promise.all([
          prisma.procurementRequisition.findMany({
            where,
            include: {
                project: true,
                items: true,
                submittedBy: true
            },
            orderBy: { createdAt: 'desc' },
            skip: (currentPage - 1) * size,
            take: size,
          }),
          prisma.procurementRequisition.count({ where })
      ]);
  }

  const pageTitle = isTopups ? 'Quantity Top-Ups' : 'Price Reviews';
  const pageDesc = isTopups 
    ? 'Review quantity top-up requests from Procurement.' 
    : 'Review requisitions with price variance or manual review requests.';

  return (
    <div className="space-y-8 p-6 md:p-8 max-w-[1600px] mx-auto min-h-screen bg-slate-50">
       <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b border-gray-200 pb-6">
        <div>
           <h1 className="text-3xl font-bold tracking-tight text-gray-900">{pageTitle}</h1>
           <p className="text-sm text-gray-500 mt-1">{pageDesc}</p>
        </div>
        <Link href="/dashboard" className="text-sm font-medium text-indigo-600 hover:text-indigo-500">
           Back to Dashboard
        </Link>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
         <ApprovalsTableToolbar />
         <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
               <thead className="bg-gray-50/80 backdrop-blur-sm">
                 <tr>
                   {isTopups ? (
                     <>
                        <th scope="col" className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-500">Project</th>
                        <th scope="col" className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-500">Item</th>
                        <th scope="col" className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-500">Requester</th>
                        <th scope="col" className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-500">Reason</th>
                        <th scope="col" className="px-6 py-4 text-right text-xs font-bold uppercase tracking-wider text-gray-500">Extra Qty</th>
                        <th scope="col" className="px-6 py-4 text-center text-xs font-bold uppercase tracking-wider text-gray-500">Action</th>
                     </>
                   ) : (
                     <>
                        <th scope="col" className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-500">Project</th>
                        <th scope="col" className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-500">Requisition #</th>
                        <th scope="col" className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-500">Requester</th>
                        <th scope="col" className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-500">Note</th>
                        <th scope="col" className="px-6 py-4 text-center text-xs font-bold uppercase tracking-wider text-gray-500">Items</th>
                        <th scope="col" className="px-6 py-4 text-center text-xs font-bold uppercase tracking-wider text-gray-500">Action</th>
                     </>
                   )}
                 </tr>
               </thead>
               <tbody className="divide-y divide-gray-200 bg-white">
                 {isTopups ? (
                    topups.length === 0 ? (
                       <tr><td colSpan={6} className="px-6 py-12 text-center text-gray-500">No pending top-ups found.</td></tr>
                    ) : (
                       topups.map((t) => (
                         <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-6 py-4 text-sm font-medium text-gray-900">
                               {t.requisitionItem.requisition.project.projectNumber}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-700">
                               {t.requisitionItem.description}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-500">
                               {t.requestedBy?.name || 'Unknown'}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-500 italic">
                               "{t.reason}"
                            </td>
                            <td className="px-6 py-4 text-sm text-right font-bold text-gray-900">
                               +{t.qtyRequested} {t.requisitionItem.unit}
                            </td>
                            <td className="px-6 py-4 text-center">
                               <div className="flex justify-center gap-2">
                                  <form action={approveTopup}>
                                     <input type="hidden" name="topupId" value={t.id} />
                                     <button className="p-1.5 rounded-md bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-200 transition-colors" title="Approve">
                                        <CheckCircleIcon className="h-5 w-5" />
                                     </button>
                                  </form>
                                  <form action={rejectTopup}>
                                     <input type="hidden" name="topupId" value={t.id} />
                                     <button className="p-1.5 rounded-md bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200 transition-colors" title="Reject">
                                        <XCircleIcon className="h-5 w-5" />
                                     </button>
                                  </form>
                               </div>
                            </td>
                         </tr>
                       ))
                    )
                 ) : (
                    reviewReqs.length === 0 ? (
                       <tr><td colSpan={6} className="px-6 py-12 text-center text-gray-500">No pending price reviews found.</td></tr>
                    ) : (
                       reviewReqs.map((req) => (
                         <tr key={req.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-6 py-4 text-sm font-medium text-gray-900">
                               {req.project.projectNumber}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-500 font-mono">
                               {req.id.slice(-6).toUpperCase()}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-500">
                               {req.submittedBy?.name || 'Unknown'}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                               {req.note}
                            </td>
                            <td className="px-6 py-4 text-sm text-center text-gray-500">
                               {req.items.length}
                            </td>
                            <td className="px-6 py-4 text-center">
                              <form action={approveRequisition}>
                                  <input type="hidden" name="id" value={req.id} />
                                  <button
                                  type="submit"
                                  className="inline-flex items-center gap-2 px-3 py-1.5 bg-green-600 border border-transparent rounded-lg text-xs font-bold text-white shadow-sm transition-all hover:bg-green-700 hover:shadow-md focus:ring-2 focus:ring-green-500 focus:ring-offset-1"
                                  >
                                      <CheckCircleIcon className="h-4 w-4" />
                                      Approve
                                  </button>
                              </form>
                            </td>
                         </tr>
                       ))
                    )
                 )}
               </tbody>
            </table>
         </div>
         <TablePagination 
            currentPage={currentPage} 
            pageSize={size} 
            total={total} 
         />
      </div>
    </div>
  );
}