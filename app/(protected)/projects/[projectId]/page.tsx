import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { assertRole } from '@/lib/workflow';
import { computeBalances, nextDueDate, formatDateYMD } from '@/lib/accounting';
import Link from 'next/link';
import DispatchTableClient from '@/components/DispatchTableClient';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  createDispatchFromPurchases,
  createDispatchFromInventory,
  createDispatchFromSelectedInventory,
  createRequisitionFromQuote,
  generatePaymentSchedule,
  createDispatchFromPurchasesAndTools,
  createMultipurposeDispatch,
  createScheduleFromQuote,
  requestFunding,
  ensureProjectIsPlanned,
} from '../actions';
import { createPOFromRequisition } from '@/app/(protected)/procurement/requisitions/[requisitionId]/actions';
import Money from '@/components/Money';
import { createDispatch as create_dispatch } from './dispatch-actions';
import { fromMinor } from '@/helpers/money';
import { recordDisbursement } from '@/app/(protected)/projects/actions';
import { recordClientPayment } from '@/app/(protected)/accounts/actions';
import SubmitButton from '@/components/SubmitButton';
import { setFlashMessage } from '@/lib/flash.server';
import ScheduleBlock from './_Schedule';
import { WorkflowStatusBadge } from '@/components/ui/workflow-status-badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import DailyTasksPage from './daily-tasks/page';
import ProjectReportsPage from './reports/page';

export const runtime = 'nodejs';

async function createProcurementRequisition(projectId: string, note?: string) {
  'use server';
  const user = await getCurrentUser();
  if (!user) throw new Error('Auth required');
  const role = assertRole(user.role);
  if (role !== 'PROJECT_OPERATIONS_OFFICER' && role !== 'ADMIN') throw new Error('Only PM/Admin');
  await ensureProjectIsPlanned(projectId);
  await prisma.procurementRequisition.create({
    data: { projectId, status: 'PENDING', note: note ?? null, submittedById: user.id! },
  });
  revalidatePath(`/projects/${projectId}`);
}

async function recordPurchase(
  requisitionId: string,
  input: { vendor: string; taxInvoiceNo: string; price: number; date: string }
) {
  'use server';
  const user = await getCurrentUser();
  if (!user) throw new Error('Auth required');
  const role = assertRole(user.role);
  if (!['PROCUREMENT', 'SENIOR_PROCUREMENT', 'ADMIN'].includes(role)) throw new Error('Only Procurement/Admin');
  const reqProject = await prisma.procurementRequisition.findUnique({
    where: { id: requisitionId },
    select: { projectId: true },
  });
  if (!reqProject) throw new Error('Requisition not found');
  await ensureProjectIsPlanned(reqProject.projectId);
  await prisma.purchase.create({
    data: {
      requisitionId,
      vendor: input.vendor,
      taxInvoiceNo: input.taxInvoiceNo,
      priceMinor: BigInt(Math.round(input.price * 100)),
      purchasedAt: new Date(input.date),
    },
  });
  revalidatePath(`/projects/${reqProject.projectId}`);
}

function StatusBadge({ status }: { status: string }) {
  const m: Record<string, string> = {
    PENDING: 'bg-amber-100 text-amber-800',
    APPROVED: 'bg-emerald-100 text-emerald-800',
    REJECTED: 'bg-red-100 text-red-800',
  };
  return (
    <span
      className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold ${m[status] || 'bg-gray-100 text-gray-700'}`}
    >
      {status}
    </span>
  );
}

async function createDispatch(
  projectId: string,
  items: Array<{ description: string; qty: number; unit?: string | null; requisitionItemId?: string | null }>
) {
  'use server';
  const user = await getCurrentUser();
  if (!user) throw new Error('Auth required');
  const role = assertRole(user.role);
  if (!['PROJECT_OPERATIONS_OFFICER', 'ADMIN'].includes(role)) throw new Error('Only PM/Admin');
  await ensureProjectIsPlanned(projectId);

  // Validate quantities against inventory/purchases
  for (const item of items) {
    if (item.requisitionItemId) {
      const [purchasedAgg, dispatchedAgg] = await Promise.all([
        prisma.purchase.aggregate({
          where: { requisitionItemId: item.requisitionItemId },
          _sum: { qty: true },
        }),
        prisma.dispatchItem.aggregate({
          where: { requisitionItemId: item.requisitionItemId },
          _sum: { qty: true },
        }),
      ]);
      const purchased = Number(purchasedAgg._sum.qty ?? 0);
      const dispatched = Number(dispatchedAgg._sum.qty ?? 0);
      const remaining = Math.max(0, purchased - dispatched);
      
      if (item.qty > remaining) {
        throw new Error(`Cannot dispatch ${item.qty} of ${item.description}. Only ${remaining} remaining.`);
      }
    }
  }

  await prisma.dispatch.create({
    data: {
      projectId,
      items: {
        create: items.map((i) => ({
          description: i.description,
          qty: i.qty,
          unit: i.unit ?? null,
          requisitionItemId: i.requisitionItemId ?? null,
        })),
      },
    },
  });
  revalidatePath(`/projects/${projectId}`);
}

async function securityApprove(dispatchId: string, driverName: string) {
  'use server';
  const user = await getCurrentUser();
  if (!user) throw new Error('Auth required');
  const role = assertRole(user.role);
  if (!['SECURITY', 'ADMIN'].includes(role)) throw new Error('Only Security/Admin');
  const d = await prisma.dispatch.update({
    where: { id: dispatchId },
    data: { status: 'OUT_FOR_DELIVERY', securityById: user.id!, driverName },
    include: { project: true },
  });
  revalidatePath(`/projects/${d.projectId}`);
}

async function markDelivered(dispatchId: string, signedBy: string) {
  'use server';
  const user = await getCurrentUser();
  if (!user) throw new Error('Auth required');
  const role = assertRole(user.role);
  if (!['DRIVER', 'SECURITY', 'ADMIN'].includes(role))
    throw new Error('Only Driver/Security/Admin');

  let d = null;
  if (['DRIVER'].includes(role)) {
    d = await prisma.dispatch.update({
      where: { id: dispatchId },
      data: { status: 'DELIVERED', signedBy, driverSignedAt: new Date(), driverById: user.id! },
      include: { project: true },
    });
  }
  if (['SECURITY'].includes(role)) {
    d = await prisma.dispatch.update({
      where: { id: dispatchId },
      data: { status: 'DELIVERED', signedBy, securitySignedAt: new Date(), securityById: user.id! },
      include: { project: true },
    });
  }

  if (['ADMIN'].includes(role)) {
    d = await prisma.dispatch.update({
      where: { id: dispatchId },
      data: { status: 'DELIVERED', signedBy },
      include: { project: true },
    });
  }

  if (!d) throw new Error('Failed to mark delivered');
  revalidatePath(`/projects/${d.projectId}`);
}

export default async function ProjectPage({ params, searchParams }: { params: Promise<{ projectId: string }>; searchParams: Promise<{ tab?: string }> }) {
  const user = await getCurrentUser();
  if (!user) return <div className="p-6">Auth required</div>;
  const role = assertRole(user.role);
  const { projectId } = await params;
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      quote: { select: { number: true, metaJson: true, customer: { select: { displayName: true, email: true, phone: true, city: true } } } },
      requisitions: { include: { items: true, funding: true } },
      dispatches: { include: { items: true } },
      clientPayments: true,
      assignedTo: true,
    },
  });

  const { tab } = await searchParams;


  if (!project) return <div className="p-6">Not found</div>;

  // Strict Access Control for Project Managers
  if (role === 'PROJECT_OPERATIONS_OFFICER' && project.assignedToId !== user.id) {
    redirect('/projects');
  }

  // Redirect Sales Accounts directly to Record Payment page
  if (role === 'SALES_ACCOUNTS') {
    redirect(`/projects/${projectId}/payments`);
  }

  const hasSchedule = (await prisma.schedule.count({ where: { projectId } })) > 0;

  const requisitions = await prisma.procurementRequisition.findMany({
    where: { projectId: projectId },
    include: {
      funding: {
        include: {
          requestedBy: { select: { name: true, email: true } },
          decidedBy: { select: { name: true, email: true } },
          disbursements: { select: { id: true, amountMinor: true, paidAt: true, ref: true, attachmentUrl: true } },
        },
      },
      items: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  // Sort funding arrays client-side
  requisitions.forEach((r) => {
    const funding = (r as any).funding;
    if (Array.isArray(funding)) {
      funding.sort((a: any, b: any) =>
        a.createdAt && b.createdAt
          ? b.createdAt > a.createdAt ? 1 : b.createdAt < a.createdAt ? -1 : 0
          : 0
      );
    }
  });

  const isPM = role === 'PROJECT_OPERATIONS_OFFICER' || role === 'ADMIN';
  const isProc = role === 'PROCUREMENT' || role === 'SENIOR_PROCUREMENT' || role === 'ADMIN';
  const isAccounts = role === 'SALES_ACCOUNTS' || (role as string).startsWith('ACCOUNT') || role === 'ADMIN';
  const canRecordPayments = role === 'SALES_ACCOUNTS' || role === 'ADMIN';
  const canViewFinancials = [
    'SALES',
    'ADMIN',
    'ACCOUNTS',
    'CASHIER',
    'ACCOUNTING_OFFICER',
    'ACCOUNTING_AUDITOR',
    'GENERAL_MANAGER',
    'MANAGING_DIRECTOR',
  ].includes(role);
  const canViewSchedule = ['PROJECT_OPERATIONS_OFFICER', 'PROJECT_COORDINATOR', 'MANAGING_DIRECTOR', 'ADMIN'].includes(role);
  const isSalesAccountsOnly = role === 'SALES_ACCOUNTS';
  
  const sch = await prisma.paymentSchedule.findMany({ where: { projectId } });
  if (sch.length === 0) {
    try {
      await generatePaymentSchedule(projectId);
    } catch (e) {
      console.error('Failed to auto-generate payment schedule', e);
    }
  }

  const schedule = await prisma.paymentSchedule.findMany({
    where: { projectId },
    orderBy: [{ seq: 'asc' }],
  });
  
  // Find deposit item
  const depositItem = schedule.find(s => s.label === 'Deposit');
  // Check if fully paid (tolerant of slight mismatches if needed, but strict for now)
  const isDepositPaid = depositItem 
    ? (BigInt(depositItem.paidMinor ?? 0n) >= BigInt(depositItem.amountMinor))
    : true; // If no deposit row, assume no deposit needed/paid.

  const requiresDeposit = (project?.status === 'CREATED' || project?.status === 'DEPOSIT_PENDING') && !isDepositPaid;
  
  const depositLocked = !!requiresDeposit;
  const opsLocked = depositLocked || !hasSchedule;
  
  const totalDue = schedule.reduce((a, s) => a + BigInt(s.amountMinor), 0n);
  const totalPaid = schedule.reduce((a, s) => a + BigInt(s.paidMinor ?? 0), 0n);
  const bal = totalDue - totalPaid;
  
  // Financial Snapshot Logic
  const firstFunding = (
    Array.isArray((project as any).requisitions)
      ? (project as any).requisitions.find((r: any) => r.funding?.status === 'APPROVED')?.funding
      : null
  ) as any;
  const totals = computeBalances({
    quote: project.quote as any,
    payments: project.clientPayments as any,
    funding: firstFunding ?? null,
  });
  const next = nextDueDate((project as any).installmentDueDay ?? null, project.commenceOn);

    return (
    <div className="min-h-screen bg-slate-50/50 pb-20 font-sans">
      {/* Premium Header */}
      <header className="relative overflow-hidden bg-gradient-to-br from-indigo-900 via-blue-800 to-blue-900 pb-12 pt-10 text-white shadow-xl">
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-100 contrast-150 mix-blend-overlay"></div>
        <div className="relative mx-auto max-w-7xl px-6 lg:px-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <h1 className="text-4xl font-extrabold tracking-tight text-white drop-shadow-sm">
                  {project.quote?.customer?.displayName || 'Project'}
                </h1>
                <span className="inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-sm font-medium text-white ring-1 ring-inset ring-white/20 backdrop-blur-md">
                  {project.status.replace(/_/g, ' ')}
                </span>
              </div>
              <p className="text-lg text-blue-100">
                {project.quote?.customer?.city ? `${project.quote.customer.city} • ` : ''}
                <span className="font-mono opacity-80">{project.projectNumber || project.id}</span>
              </p>
              <div className="mt-2 flex items-center gap-6 text-sm font-medium text-blue-200">
                <span className="flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 opacity-70">
                    <path fillRule="evenodd" d="M5.75 2a.75.75 0 01.75.75V4h7V2.75a.75.75 0 011.5 0V4h.25A2.75 2.75 0 0118 6.75v8.5A2.75 2.75 0 0115.25 18H4.75A2.75 2.75 0 012 15.25v-8.5A2.75 2.75 0 014.75 4h.25V2.75A.75.75 0 015.75 2zm-1 5.5c-.69 0-1.25.56-1.25 1.25v6.5c0 .69.56 1.25 1.25 1.25h10.5c.69 0 1.25-.56 1.25-1.25v-6.5c0-.69-.56-1.25-1.25-1.25H4.75z" clipRule="evenodd" />
                  </svg>
                  Commenced: {new Date(project.commenceOn).toLocaleDateString()}
                </span>
                {next && (
                   <span className="flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 opacity-70">
                      <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
                    </svg>
                    Next Due: {formatDateYMD(next)}
                  </span>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              {canRecordPayments && (
                <Link
                  href={`/projects/${projectId}/payments`}
                  className="rounded-lg bg-emerald-500/20 px-4 py-2.5 text-sm font-semibold text-white shadow-sm ring-1 ring-inset ring-white/20 backdrop-blur-sm transition-all hover:bg-emerald-500/30 hover:ring-white/30"
                >
                  💰 Payments
                </Link>
              )}
              <Link
                href="/projects"
                className="rounded-lg bg-white/10 px-4 py-2.5 text-sm font-semibold text-white shadow-sm ring-1 ring-inset ring-white/20 backdrop-blur-sm transition-all hover:bg-white/20 hover:ring-white/30"
              >
                Back to Projects
              </Link>
            </div>
          </div>

          {/* Key Metrics Strip (Glass) */}
          {canViewFinancials && role !== 'SALES_ACCOUNTS' && (
            <div className="mt-8 grid grid-cols-1 divide-y divide-white/10 rounded-2xl bg-white/5 shadow-2xl ring-1 ring-white/10 backdrop-blur-2xl md:grid-cols-3 md:divide-x md:divide-y-0 text-center">
              <div className="p-4">
                <p className="text-xs font-medium uppercase tracking-wider text-blue-200">Contract Value</p>
                <p className="mt-1 text-2xl font-bold text-white"><Money minor={BigInt(Math.round(totals.contractTotal * 100))} /></p>
              </div>
              <div className="p-4">
                <p className="text-xs font-medium uppercase tracking-wider text-blue-200">Paid to Date</p>
                <p className="mt-1 text-2xl font-bold text-emerald-300"><Money minor={BigInt(Math.round(totals.paid * 100))} /></p>
              </div>
              <div className="p-4">
                 <p className="text-xs font-medium uppercase tracking-wider text-blue-200">Balance Due</p>
                 <p className={cn("mt-1 text-2xl font-bold", totals.remaining > 0 ? "text-rose-300" : "text-white")}>
                    <Money minor={BigInt(Math.round(totals.remaining * 100))} />
                 </p>
              </div>
            </div>
          )}
        </div>
      </header>
      
      <main className="mx-auto max-w-7xl px-6 lg:px-8 space-y-8">
        {/* Alerts */}
        {depositLocked && (
          <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 shadow-sm">
            Deposit not recorded yet. Project functions are limited until status is PLANNED.
          </div>
        )}
        
        {!depositLocked && !hasSchedule && (
          <div className="mt-6 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900 shadow-sm">
            Project schedule not created yet. Please create a schedule to unlock requisitions and dispatches.
          </div>
        )}

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            
            {/* Schedule Button */}
            {!isSalesAccountsOnly && canViewSchedule && (
                <Link 
                    href={hasSchedule ? `/projects/${projectId}/schedule` : '#'} 
                    className="group relative overflow-hidden rounded-2xl bg-white p-8 shadow-sm ring-1 ring-gray-900/5 transition-all hover:-translate-y-1 hover:shadow-lg"
                >
                    <div className="absolute right-0 top-0 -mr-4 -mt-4 h-24 w-24 rounded-full bg-blue-50 transition-all group-hover:bg-blue-100"></div>
                    <div className="relative">
                        <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-600/20">
                           <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-6 w-6">
                             <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                           </svg>
                        </div>
                        <h3 className="text-xl font-semibold text-gray-900">Schedule</h3>
                        <p className="mt-2 text-sm text-gray-500">Manage timeline, tasks, and employee assignments.</p>
                        
                        {!hasSchedule && (
                             <div className="mt-4">
                                <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10">Not Created</span>
                             </div>
                        )}
                        {hasSchedule && (
                            <div className="mt-4 flex items-center gap-2 text-sm font-medium text-blue-600 group-hover:text-blue-700">
                                View Schedule
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                                    <path fillRule="evenodd" d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z" clipRule="evenodd" />
                                </svg>
                            </div>
                        )}
                    </div>
                </Link>
            )}

            {/* Requisitions Button */}
            {!isSalesAccountsOnly && (
                <Link 
                    href={`/projects/${projectId}/requisitions`}
                    className="group relative overflow-hidden rounded-2xl bg-white p-8 shadow-sm ring-1 ring-gray-900/5 transition-all hover:-translate-y-1 hover:shadow-lg"
                >
                    <div className="absolute right-0 top-0 -mr-4 -mt-4 h-24 w-24 rounded-full bg-indigo-50 transition-all group-hover:bg-indigo-100"></div>
                     <div className="relative">
                        <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-lg shadow-indigo-600/20">
                           <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-6 w-6">
                             <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
                           </svg>
                        </div>
                        <div className="flex justify-between items-start">
                             <h3 className="text-xl font-semibold text-gray-900">Requisitions</h3>
                             {requisitions.length > 0 && <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-semibold text-indigo-600">{requisitions.length}</span>}
                        </div>
                        <p className="mt-2 text-sm text-gray-500">Create requests and track procurement status.</p>
                         <div className="mt-4 flex items-center gap-2 text-sm font-medium text-indigo-600 group-hover:text-indigo-700">
                             Manage Requisitions
                             <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                               <path fillRule="evenodd" d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z" clipRule="evenodd" />
                             </svg>
                         </div>
                    </div>
                </Link>
            )}

            {/* Dispatches Button */}
            {!isSalesAccountsOnly && (
                 <Link 
                    href={`/projects/${projectId}/dispatches`}
                    className="group relative overflow-hidden rounded-2xl bg-white p-8 shadow-sm ring-1 ring-gray-900/5 transition-all hover:-translate-y-1 hover:shadow-lg"
                 >
                    <div className="absolute right-0 top-0 -mr-4 -mt-4 h-24 w-24 rounded-full bg-emerald-50 transition-all group-hover:bg-emerald-100"></div>
                     <div className="relative">
                        <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-lg shadow-emerald-600/20">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-6 w-6">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
                            </svg>
                        </div>
                         <div className="flex justify-between items-start">
                             <h3 className="text-xl font-semibold text-gray-900">Dispatches</h3>
                             {project.dispatches.length > 0 && <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-600">{project.dispatches.length}</span>}
                        </div>
                        <p className="mt-2 text-sm text-gray-500">Inventory movement and delivery tracking.</p>
                         <div className="mt-4 flex items-center gap-2 text-sm font-medium text-emerald-600 group-hover:text-emerald-700">
                             Manage Dispatches
                             <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                               <path fillRule="evenodd" d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z" clipRule="evenodd" />
                             </svg>
                         </div>
                    </div>
                </Link>
            )}

            {/* Daily Tasks Button */}
            {!isSalesAccountsOnly && ['PM_CLERK', 'PROJECT_OPERATIONS_OFFICER', 'PROJECT_COORDINATOR', 'ADMIN'].includes(user.role) && (
                 <Link 
                    href={`/projects/${projectId}/daily-tasks`}
                    className="group relative overflow-hidden rounded-2xl bg-white p-8 shadow-sm ring-1 ring-gray-900/5 transition-all hover:-translate-y-1 hover:shadow-lg"
                 >
                    <div className="absolute right-0 top-0 -mr-4 -mt-4 h-24 w-24 rounded-full bg-amber-50 transition-all group-hover:bg-amber-100"></div>
                     <div className="relative">
                        <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-amber-600 text-white shadow-lg shadow-amber-600/20">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-6 w-6">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
                            </svg>
                        </div>
                        <h3 className="text-xl font-semibold text-gray-900">Daily Tasks</h3>
                        <p className="mt-2 text-sm text-gray-500">Log progress and daily activities.</p>
                         <div className="mt-4 flex items-center gap-2 text-sm font-medium text-amber-600 group-hover:text-amber-700">
                             View Daily Tasks
                             <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                               <path fillRule="evenodd" d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z" clipRule="evenodd" />
                             </svg>
                         </div>
                    </div>
                 </Link>
            )}
            
            {/* Reports Button */}
            {!isSalesAccountsOnly && ['PM_CLERK', 'PROJECT_OPERATIONS_OFFICER', 'PROJECT_COORDINATOR', 'ADMIN'].includes(user.role) && (
                 <Link 
                    href={`/projects/${projectId}/reports`}
                    className="group relative overflow-hidden rounded-2xl bg-white p-8 shadow-sm ring-1 ring-gray-900/5 transition-all hover:-translate-y-1 hover:shadow-lg"
                 >
                     <div className="absolute right-0 top-0 -mr-4 -mt-4 h-24 w-24 rounded-full bg-purple-50 transition-all group-hover:bg-purple-100"></div>
                     <div className="relative">
                        <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-purple-600 text-white shadow-lg shadow-purple-600/20">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-6 w-6">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m3.75 9v6m3-3H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                            </svg>
                        </div>
                        <h3 className="text-xl font-semibold text-gray-900">Reports</h3>
                        <p className="mt-2 text-sm text-gray-500">Generate analytics and progress reports.</p>
                         <div className="mt-4 flex items-center gap-2 text-sm font-medium text-purple-600 group-hover:text-purple-700">
                             View Reports
                             <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                               <path fillRule="evenodd" d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z" clipRule="evenodd" />
                             </svg>
                         </div>
                    </div>
                 </Link>
            )}
            
        </div>
      </main>
    </div>
  );
}
