'use server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { toMinor } from '@/lib/accounting';
import { revalidatePath } from 'next/cache';
import { assertRoles } from '@/lib/workflow';
import { redirect } from 'next/navigation';

function assertRole(userRole: string | null | undefined, allowed: string[]) {
  if (!userRole || !allowed.includes(userRole)) throw new Error('Insufficient permissions');
}


function requirePaymentRole(role?: string | null) {
  if (!role || !['SALES_ACCOUNTS', 'ACCOUNTS', 'ADMIN'].includes(role)) {
    throw new Error('Only Sales Accounts or Admin can record payments');
  }
}

export async function recordClientPayment(projectId: string, args: {
  type: 'DEPOSIT' | 'INSTALLMENT' | 'ADJUSTMENT',
  amount: number, // major
  receivedAt: string, // yyyy-mm-dd
  receiptNo?: string | null,
  method?: string | null,
  attachmentUrl?: string | null,
  description?: string | null,
}) {
  const me = await getCurrentUser();
  requirePaymentRole(me?.role);

  const amountMinor = BigInt(Math.round((args.amount ?? 0) * 100));
  if (amountMinor <= 0n) throw new Error('Amount must be positive');

  await prisma.$transaction(async (tx) => {
    const project = await tx.project.findUnique({
      where: { id: projectId },
      select: { status: true },
    });
    if (!project) throw new Error('Project not found');
    const needsDeposit = project.status === 'CREATED' || project.status === 'DEPOSIT_PENDING';

    await tx.clientPayment.create({
      data: {
        projectId,
        type: args.type,
        amountMinor,
        receivedAt: new Date(args.receivedAt),
        receiptNo: args.receiptNo ?? null,
        method: args.method ?? null,
        attachmentUrl: args.attachmentUrl ?? null,
        description: args.description ?? null,
        recordedById: me!.id!,
      },
    });

    let remaining = amountMinor;

    const items = await tx.paymentSchedule.findMany({
      where: { projectId },
      orderBy: [{ dueOn: 'asc' }, { seq: 'asc' }],
    });

    for (const it of items) {
      if (remaining <= 0n) break;
      const need = BigInt(it.amountMinor) - BigInt(it.paidMinor);
      if (need <= 0n) continue;

      const use = need > remaining ? remaining : need;
      const newPaid = BigInt(it.paidMinor) + use;
      const status = newPaid >= BigInt(it.amountMinor) ? 'PAID' : 'PARTIAL';

      await tx.paymentSchedule.update({
        where: { id: it.id },
        data: { paidMinor: newPaid, status },
      });

      remaining -= use;
    }

    await tx.paymentSchedule.updateMany({
      where: {
        projectId,
        status: { in: ['DUE', 'PARTIAL'] },
        dueOn: { lt: new Date() },
      },
      data: { status: 'OVERDUE' },
    });

    if (needsDeposit) {
      const depositItem = await tx.paymentSchedule.findFirst({
        where: { projectId, label: 'Deposit' },
      });
      const isPaid = !depositItem || (BigInt(depositItem.paidMinor) >= BigInt(depositItem.amountMinor));
      if (isPaid) {
        await tx.project.update({
          where: { id: projectId },
          data: { status: 'PLANNED' },
        });
      }
    }
  });

  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/accounts/payments`);
  revalidatePath(`/projects/${projectId}/payments`);
  revalidatePath(`/projects`);
}


// Officers Approve / Reject funding requests
// Officers Approve / Reject funding requests
export async function approveFunding(fundingId: string, approvedAmountMajor?: number) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Authentication required');
  assertRole(user.role, [
    'ACCOUNTING_OFFICER',
    'ADMIN',
    'ACCOUNTS',
    'ACCOUNTING_CLERK',
    'MANAGING_DIRECTOR',
  ]);
  const amountMinor = typeof approvedAmountMajor === 'number' ? toMinor(approvedAmountMajor) : undefined;
  const updatedFunding = await prisma.fundingRequest.update({
    where: { id: fundingId },
    data: {
      status: 'APPROVED',
      amountMinor: amountMinor ?? undefined,
      approvedBy: { connect: { id: user.id } },
      approvedAt: new Date(),
      reason: null,
    },
    select: {
      requisitionId: true,
      requisition: { select: { status: true } }
    }
  });

  // Sync Requisition Status if needed
  if (updatedFunding.requisition?.status === 'SUBMITTED') {
    await prisma.procurementRequisition.update({
      where: { id: updatedFunding.requisitionId },
      data: { status: 'APPROVED' }
    });
  }

  revalidatePath('/dashboard');
  revalidatePath('/accounts');
  return { success: true };
}

export async function rejectFunding(fundingId: string, reason: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Authentication required');
  assertRole(user.role, [
    'ACCOUNTING_OFFICER',
    'ADMIN',
    'ACCOUNTS',
    'ACCOUNTING_CLERK',
    'MANAGING_DIRECTOR',
  ]);
  await prisma.fundingRequest.update({
    where: { id: fundingId },
    data: {
      status: 'REJECTED',
      decidedBy: { connect: { id: user.id } },
      decidedAt: new Date(),
      reason: reason || '—',
    },
  });

  revalidatePath('/dashboard');
  revalidatePath('/accounts');
  return { success: true };
}

export async function postponeFunding(fundingId: string, postponeUntil: Date, reason: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Authentication required');
  assertRole(user.role, [
    'ACCOUNTING_OFFICER',
    'ADMIN',
    'ACCOUNTS',
    'ACCOUNTING_CLERK',
    'MANAGING_DIRECTOR',
  ]);

  await prisma.fundingRequest.update({
    where: { id: fundingId },
    data: {
      status: 'POSTPONED',
      postponedUntil: postponeUntil,
      decidedBy: { connect: { id: user.id } },
      decidedAt: new Date(),
      reason: reason || null,
    },
  });

  revalidatePath('/dashboard');
  revalidatePath('/accounts');
  return { success: true };
}

// --- Purchase Orders: Approve/Reject (Accounts)
export async function approvePO(poId: string) {
  const me = await getCurrentUser();
  assertRoles(me?.role, ['ACCOUNTING_OFFICER', 'ACCOUNTING_CLERK', 'ACCOUNTS', 'ADMIN'] as any);

  const po = await prisma.purchaseOrder.findUnique({ where: { id: poId }, select: { requestedMinor: true } });
  if (!po) throw new Error('PO not found');

  await prisma.purchaseOrder.update({
    where: { id: poId },
    data: { status: 'APPROVED', approvedMinor: po.requestedMinor, decidedAt: new Date(), decidedById: me!.id! },
  });

  revalidatePath('/accounts/po');
  revalidatePath('/dashboard');
  redirect('/dashboard');
}

export async function rejectPO(poId: string, reason?: string | null) {
  const me = await getCurrentUser();
  assertRoles(me?.role, ['ACCOUNTING_OFFICER', 'ACCOUNTS', 'ADMIN'] as any);

  await prisma.purchaseOrder.update({
    where: { id: poId },
    data: { status: 'REJECTED', reason: reason ?? null, decidedAt: new Date(), decidedById: me!.id! },
  });

  revalidatePath('/accounts/po');
  revalidatePath('/dashboard');
  redirect('/dashboard');
}

export async function getApprovedPOBudgetForProject(projectId: string) {
  const agg = await prisma.purchaseOrderItem.aggregate({
    where: { purchaseOrder: { projectId, status: 'APPROVED' } },
    _sum: { totalMinor: true },
  });
  return BigInt(agg._sum?.totalMinor ?? 0);
}

// Clerks record client payments (deposit or installment) with optional file
/* export async function recordClientPayment(input: {
  projectId: string;
  type: 'DEPOSIT' | 'INSTALLMENT';
  amount: number; // major
  paidOn: string; // YYYY-MM-DD
  ref?: string | null;
  file?: File | null;
}) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Authentication required');
  assertRole(user.role, ['ACCOUNTING_CLERK', 'ADMIN']); // Clerk only (or Admin)

  const amountMinor = toMinor(Number(input.amount || 0));
  if (amountMinor <= 0n) throw new Error('Amount must be greater than zero');

  let fileId: string | null = null;
  if (input.file) {
    const ab = await input.file.arrayBuffer();
    const data = Buffer.from(ab);
    const f = await prisma.file.create({
      data: {
        filename: input.file.name,
        mimeType: input.file.type || 'application/pdf',
        size: data.byteLength,
        data,
      },
      select: { id: true },
    });
    fileId = f.id;
  }

  await prisma.projectPayment.create({
    data: {
      projectId: input.projectId,
      type: input.type,
      amountMinor: amountMinor,
      paidOn: new Date(input.paidOn),
      ref: input.ref ?? null,
      fileId,
      createdById: user.id!,
    },
  });
  return { ok: true };
} */
