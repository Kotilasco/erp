import Link from 'next/link';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { assertRoles } from '@/lib/workflow';
import { redirect } from 'next/navigation';
import { WorkflowStatusBadge } from '@/components/ui/workflow-status-badge';
import Money from '@/components/Money';

import TablePagination from '@/components/ui/table-pagination';
import { Prisma, PaymentScheduleStatus } from '@prisma/client';
import ProjectTableToolbar from './components/ProjectTableToolbar';
<<<<<<< HEAD
import { EyeIcon, BriefcaseIcon, BanknotesIcon } from '@heroicons/react/24/outline';
=======
import { EyeIcon, BriefcaseIcon } from '@heroicons/react/24/outline';
>>>>>>> 6ceb169f31dd33949aef05a222ac753c3611dd87

import { ProjectAssigner } from './project-assigner';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const DEFAULT_PAGE_SIZE = 20;

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; tab?: string; status?: string; start_date?: string; pageSize?: string }>;
}) {
  const me = await getCurrentUser();
  if (!me) return <div className="p-6 text-sm text-gray-600">Authentication required.</div>;

  try {
    assertRoles(
      me.role as any,
      [
        'ADMIN',
        'CLIENT',
        'VIEWER',
        'PROJECT_OPERATIONS_OFFICER',
        'PROJECT_COORDINATOR',
        'PROCUREMENT',
        'SENIOR_PROCUREMENT',
        'ACCOUNTS',
        'CASHIER',
        'ACCOUNTING_OFFICER',
        'ACCOUNTING_AUDITOR',
        'ACCOUNTING_CLERK',
        'DRIVER',
        'GENERAL_MANAGER',
        'MANAGING_DIRECTOR',
        'SALES_ACCOUNTS',
      ] as any
    );
  } catch {
    redirect('/dashboard');
  }

  const role = me.role as string;
  const isSeniorPM = ['PROJECT_COORDINATOR', 'ADMIN', 'GENERAL_MANAGER', 'MANAGING_DIRECTOR'].includes(role);
  const isProjectManager = role === 'PROJECT_OPERATIONS_OFFICER';
  const isSalesAccounts = role === 'SALES_ACCOUNTS';

  const { q: query, page: pageParam, tab, status, start_date, pageSize: pageSizeParam } = await searchParams;
  const currentPage = parseInt(pageParam || '1', 10);
  const pageSize = parseInt(pageSizeParam || String(DEFAULT_PAGE_SIZE), 10);
  const skip = (currentPage - 1) * pageSize;

  let currentTab = 'active';
  if (isSeniorPM) {
    currentTab = tab || 'assignment'; // Default tab for Senior PM
  } else if (isSalesAccounts) {
    currentTab = tab === 'all_payments' ? 'all_payments' : 'due_today';
  } else if (isProjectManager) {
    currentTab = tab || 'active';
  }

  const baseWhere: Prisma.ProjectWhereInput = {
    ...(query
      ? {
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { projectNumber: { contains: query, mode: 'insensitive' } },
            { quote: { customer: { displayName: { contains: query, mode: 'insensitive' } } } },
            { quote: { customer: { city: { contains: query, mode: 'insensitive' } } } },
          ],
        }
      : {}),
    // Delegation Filter for regular PMs:
    ...(isProjectManager ? { assignedToId: me.id } : {}),
  };
  
  // Apply Status Filter
  if (status) {
    baseWhere.status = status as any;
  }
  
  // Apply Date Filter
  if (start_date) {
    baseWhere.commenceOn = { gte: new Date(start_date) };
  }

  let where = baseWhere;

  // Specific Logic for tabs (mostly for Senior PM logic or Sales logic)
  if (isSalesAccounts && currentTab === 'due_today') {
    where = {
      ...where,
      paymentSchedules: {
        some: {
          OR: [
            {
              status: { in: [PaymentScheduleStatus.DUE, PaymentScheduleStatus.PARTIAL, PaymentScheduleStatus.OVERDUE] },
              dueOn: { lte: new Date() },
            },
            {
              status: { in: [PaymentScheduleStatus.DUE, PaymentScheduleStatus.PARTIAL, PaymentScheduleStatus.OVERDUE] },
              label: { contains: 'Deposit', mode: 'insensitive' },
            },
          ],
        },
      },
    };
  }

  if (isSeniorPM) {
     if (currentTab === 'assignment') {
       where = { ...where, assignedToId: null, status: { notIn: ['CREATED','COMPLETED','CLOSED'] } };
     } else if (currentTab === 'unplanned') {
       where = { ...where, status: 'PLANNED', schedules: null };
     } else if (currentTab === 'planning') {
       where = { ...where, status: 'CREATED' };
     }
  }

  if (isProjectManager) {
    if (currentTab === 'unplanned') {
      where = {
        ...where,
        OR: [
          { schedules: { is: null } },
          { schedules: { status: 'DRAFT' } }
        ]
      };
    } else if (currentTab === 'active') {
       where = { ...where, schedules: { status: 'ACTIVE' } };
    }
  }

  // Fetch Data
  const [projects, totalCount, projectManagers] = await Promise.all([
    prisma.project.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }],
      include: {
        quote: {
          select: {
            number: true,
            customer: { select: { displayName: true, city: true } },
            createdBy: { select: { name: true, email: true } },
          },
        },
        assignedTo: { select: { id: true, name: true, email: true } },
        // For Sales
        paymentSchedules: isSalesAccounts ? { select: { amountMinor: true, paidMinor: true, status: true, dueOn: true, label: true, seq: true } } : false,
        clientPayments: isSalesAccounts ? { select: { amountMinor: true, type: true } } : false,
      },
      take: pageSize,
      skip,
    }),
    prisma.project.count({ where }),
    isSeniorPM
      ? prisma.user.findMany({ where: { role: 'PROJECT_OPERATIONS_OFFICER' }, select: { id: true, name: true } })
      : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-8 p-2 sm:p-4 max-w-7xl mx-auto">
      {/* Header Section */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b border-gray-200 pb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg dark:bg-blue-900/30">
            <BriefcaseIcon className="h-8 w-8 text-barmlo-blue dark:text-blue-400" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">Projects</h1>
            {!isSalesAccounts && !isSeniorPM && (
               <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {currentTab === 'unplanned' ? 'Projects waiting for schedule.' : 'Active projects overview.'}
               </p>
            )}
            {isSeniorPM && (
               <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Manage and assign all projects.</p>
            )}
            {isSalesAccounts && (
               <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Track payments and receivables.</p>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden dark:border-gray-700 dark:bg-gray-800">
        <div className="p-4 border-b border-gray-100 dark:border-gray-700">
<<<<<<< HEAD
           <ProjectTableToolbar showDateFilter={!isSalesAccounts} />
=======
           <ProjectTableToolbar />
>>>>>>> 6ceb169f31dd33949aef05a222ac753c3611dd87
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50/80 backdrop-blur-sm dark:bg-gray-900/50">
               {isSalesAccounts ? (
                 <tr>
                   <th scope="col" className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Ref</th>
                   <th scope="col" className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Customer</th>
                   <th scope="col" className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Location</th>
                   <th scope="col" className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Type</th>
                   <th scope="col" className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Due Amount</th>
                   <th scope="col" className="px-6 py-4 text-center text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Action(s)</th>
                 </tr>
               ) : (
                 <tr>
                   <th scope="col" className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Ref</th>
                   <th scope="col" className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Customer</th>
                   <th scope="col" className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Location</th>
                   <th scope="col" className="px-6 py-4 text-center text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Status</th>
                   <th scope="col" className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Start Date</th>
                  {!isProjectManager && <th scope="col" className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">PM</th>}
                  {!isSeniorPM && (
                    <th scope="col" className="px-6 py-4 text-center text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Actions</th>
                  )}
                </tr>
              )}
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-800">
              {projects.length === 0 ? (
                <tr>
                  <td colSpan={isSalesAccounts || isSeniorPM || isProjectManager ? 6 : 7} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                       <BriefcaseIcon className="h-10 w-10 text-gray-300" />
                       <p className="text-base font-medium">No projects found</p>
                       <p className="text-sm">Try adjusting your filters.</p>
                    </div>
                  </td>
                </tr>
               ) : (
                 projects.map((project) => {
                   if (isSalesAccounts) {
                    const schedules = (project as any).paymentSchedules || [];
                    let typeLabel = 'Installment';
                    let dueAmount = 0n;

                    if (schedules.length > 0) {
<<<<<<< HEAD
                      const sorted = [...schedules].sort((a: any, b: any) => {
                        const da = new Date(a.dueOn).getTime();
                        const db = new Date(b.dueOn).getTime();
                        if (da !== db) return da - db;
                        return (a.seq ?? 0) - (b.seq ?? 0);
                      });
                      const totalPaid = ((project as any).clientPayments || []).reduce(
                        (sum: bigint, p: any) => sum + BigInt(p.amountMinor ?? 0),
                        0n
                      );
                      let cumulativeDue = 0n;
                      let currentItem: any = null;
                      for (const s of sorted) {
                        cumulativeDue += BigInt(s.amountMinor ?? 0);
                        if (cumulativeDue > totalPaid) {
                          currentItem = s;
                          break;
                        }
                      }
                      if (currentItem) {
                        const lbl = String(currentItem.label || '').toLowerCase();
                        typeLabel = lbl.includes('deposit') ? 'Deposit' : (currentItem.label || 'Installment');
                        dueAmount = cumulativeDue - totalPaid;
                      } else {
                        typeLabel = 'Completed';
                        dueAmount = 0n;
                      }
=======
                      const sorted = [...schedules].sort((a: any, b: any) => new Date(a.dueOn).getTime() - new Date(b.dueOn).getTime());
                      const nextPayment = sorted.find((s: any) => s.status !== 'PAID') || sorted[sorted.length - 1];
                      typeLabel = nextPayment?.label || 'Installment';
                      dueAmount = nextPayment ? (BigInt(nextPayment.amountMinor) - BigInt(nextPayment.paidMinor || 0)) : 0n;
>>>>>>> 6ceb169f31dd33949aef05a222ac753c3611dd87
                    } else {
                       // Fallback
                       const deposit = BigInt((project as any).depositMinor ?? 0);
                       const installment = BigInt((project as any).installmentMinor ?? 0);
                       let totalPaid = ((project as any).clientPayments || []).reduce(
                           (sum: bigint, p: any) => sum + BigInt(p.amountMinor ?? 0),
                           0n
                       );

                       if (deposit > 0n) {
                           if (totalPaid < deposit) {
                               typeLabel = 'Deposit';
                               dueAmount = deposit - totalPaid;
                           } else {
                               totalPaid -= deposit;
                               if (installment > 0n) {
                                   typeLabel = 'Installment';
                                   const remainder = totalPaid % installment;
                                   dueAmount = installment - remainder;
                               } else {
                                   typeLabel = 'Completed';
                                   dueAmount = 0n;
                               }
                           }
                       } else if (installment > 0n) {
                           typeLabel = 'Installment';
                           const remainder = totalPaid % installment;
                           dueAmount = installment - remainder;
                       }
                    }

                    return (
                       <tr key={project.id} className="group hover:bg-blue-50/30 transition-colors dark:hover:bg-gray-700/50">
                         <td className="px-6 py-4 text-sm font-semibold text-gray-900 dark:text-white">
                           {project.projectNumber || project.id.slice(0, 8)}
                         </td>
                         <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                           {project.quote?.customer?.displayName || 'Unknown'}
                         </td>
                         <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                           {project.quote?.customer?.city || '-'}
                         </td>
                         <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                            <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10 dark:bg-blue-400/10 dark:text-blue-400 dark:ring-blue-400/30">
                              {typeLabel}
                            </span>
                         </td>
                         <td className="px-6 py-4 text-sm text-gray-900 dark:text-white font-medium">
<<<<<<< HEAD
                            <Money minor={dueAmount} />
                         </td>
                         <td className="px-6 py-4 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <Link 
                                 href={`/projects/${project.id}/payments`}
                                 className="inline-flex items-center justify-center gap-1 rounded border border-orange-600 bg-orange-600 px-2 py-1 text-xs font-bold text-white transition-colors hover:bg-orange-500 hover:border-orange-500 shadow-sm"
                              >
                                 <BanknotesIcon className="h-3.5 w-3.5" />
                                 Receive Payment
                              </Link>
                            </div>
=======
                            <Money amountMinor={dueAmount} />
                         </td>
                         <td className="px-6 py-4 text-center">
                            <Link 
                               href={`/projects/${project.id}`}
                               className="inline-flex items-center justify-center gap-1 rounded border border-emerald-500 px-2 py-1 text-xs font-bold text-emerald-600 transition-colors hover:bg-emerald-50 dark:border-emerald-400 dark:text-emerald-400 dark:hover:bg-emerald-900/20"
                            >
                               <EyeIcon className="h-3.5 w-3.5" />
                               View
                            </Link>
>>>>>>> 6ceb169f31dd33949aef05a222ac753c3611dd87
                         </td>
                       </tr>
                    );
                   }

                   // Standard View
                   return (
                     <tr key={project.id} className="group hover:bg-blue-50/30 transition-colors dark:hover:bg-gray-700/50">
                       <td className="px-6 py-4 text-sm font-semibold text-gray-900 dark:text-white">
                         {project.projectNumber || project.id.slice(0, 8)}
                       </td>
                       <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                         {project.quote?.customer?.displayName || 'Unknown'}
                       </td>
                       <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                         {project.quote?.customer?.city || '-'}
                       </td>
                       <td className="px-6 py-4 text-center">
                         <div className="flex justify-center">
                            <WorkflowStatusBadge status={project.status} />
                         </div>
                       </td>
                       <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 font-mono">
                         {project.commenceOn ? new Date(project.commenceOn).toLocaleDateString() : '-'}
                       </td>
                       {!isProjectManager && (
                         <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                            {isSeniorPM && currentTab === 'assignment' ? (
                               <ProjectAssigner projectId={project.id} managers={projectManagers} />
                            ) : (
                               project.assignedTo?.name || '-'
                            )}
                         </td>
                       )}
                       {!isSeniorPM && (
                         <td className="px-6 py-4 text-center">
                            <div className="flex items-center justify-center gap-2">
                                <Link 
                                   href={`/projects/${project.id}`}
                                   className="inline-flex items-center gap-1 rounded border border-emerald-500 px-2 py-1 text-xs font-bold text-emerald-600 transition-colors hover:bg-emerald-50 dark:border-emerald-400 dark:text-emerald-400 dark:hover:bg-emerald-900/20"
                                >
                                   <EyeIcon className="h-3.5 w-3.5" />
                                   View
                                </Link>
                            </div>
                         </td>
                       )}
                     </tr>
                   );
                 })
               )}
            </tbody>
          </table>
        </div>
        <div className="border-t border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-800/50">
           <TablePagination total={totalCount} currentPage={currentPage} pageSize={pageSize} />
        </div>
      </div>
    </div>
  );
}
