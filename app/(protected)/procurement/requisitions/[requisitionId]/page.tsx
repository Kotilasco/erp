// app/(protected)/procurement/requisitions/[requisitionId]/page.tsx
import Link from 'next/link';
import PurchaseItemForm from './PurchaseItemForm';
import { createPurchase } from '@/app/(protected)/projects/actions';
import { cn } from '@/lib/utils';
import { prisma } from '@/lib/db';
import { fromMinor } from '@/helpers/money';
import { parseReviewFlagUpdates, parseUnitPriceUpdates } from '@/lib/requisition-form';
import FundingActionsClient from '../FundingActionsClient';
import FundingApprovalClient from '../FundingApprovalClient';
import ReviewActionsClient from '../ReviewActionsClient';
import {
  approveFunding,
  rejectFunding,
  requestTopUp,
  sendRequisitionForReview,
  sendRequisitionForReviewInPlace,
  saveUnitPricesForRequisition,
  submitProcurementRequest,
} from '@/app/(protected)/projects/actions';
import Money from '@/components/Money';
import ProcurementItemsTable from '@/components/ProcurementItemsTable';
import { getCurrentUser } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import QuantityInput from '@/components/QuantityInput';
import clsx from 'clsx';
import { USER_ROLES, UserRole } from '@/lib/workflow';
import SubmitButton from '@/components/SubmitButton';
import { redirect } from 'next/navigation';
import { setFlashMessage } from '@/lib/flash.server';
import { markAsPurchased, submitRequisition, deleteStagedPurchase, cancelItemReview, rejectItemReview } from './actions';
import { createPartialPOFromPurchases } from '@/app/(protected)/projects/actions';
import PrintButton from '@/components/PrintButton';
import PurchaseOrderHeader from '@/components/PurchaseOrderHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  CheckBadgeIcon,
  ClockIcon,
  BanknotesIcon,
  ExclamationTriangleIcon,
  ShoppingBagIcon,
  CurrencyDollarIcon,
  TruckIcon,
  TrashIcon
} from '@heroicons/react/24/outline';

export function assertRole(role: string | null | undefined): UserRole {
  if (!role) throw new Error('Unsupported user role');
  const value = String(role) as UserRole;
  if ((USER_ROLES as readonly string[]).includes(value)) return value as UserRole;
  throw new Error('Unsupported user role');
}

export default async function RequisitionDetailPage({
  params,
}: {
  params: Promise<{ requisitionId: string }>;
}) {
  const { requisitionId } = await params;

  const user = await getCurrentUser();

  const req = await prisma.procurementRequisition.findUnique({
    where: { id: requisitionId },
    include: {
      items: {
        include: {
          quoteLine: { select: { metaJson: true, unitPriceMinor: true } },
          topups: { orderBy: { createdAt: 'desc' } },
        },
      },
      project: {
        include: {
          quote: {
            include: { customer: true },
          },
        },
      },
      submittedBy: { select: { name: true } },
      reviewSubmittedBy: { select: { name: true } },
      funding: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { id: true, status: true, amountMinor: true, createdAt: true, decidedBy: { select: { name: true, email: true } }, decidedAt: true },
      },
    },
  });
  if (!req) return <div className="p-6">Requisition not found.</div>;

  const funding = req.funding[0]; // Already included with take: 1
  const fundingLocked = funding?.status === 'REQUESTED' || funding?.status === 'APPROVED';

  const grandMinor = req.items.reduce((acc, it) => acc + BigInt(it.amountMinor ?? 0), 0n);
  const grand = fromMinor(grandMinor);
  const getItemSection = (item: (typeof req.items)[number]) => {
    const rawMeta = item.quoteLine?.metaJson;
    if (typeof rawMeta === 'string' && rawMeta.trim().length > 0) {
      try {
        const parsed = JSON.parse(rawMeta) as { section?: string; category?: string };
        const fromMeta =
          (typeof parsed?.section === 'string' && parsed.section.trim().length > 0
            ? parsed.section
            : typeof parsed?.category === 'string' && parsed.category.trim().length > 0
              ? parsed.category
              : null) ?? null;
        if (fromMeta) return fromMeta.trim();
      } catch {
        // ignore malformed meta JSON
      }
    }
    return 'Uncategorized';
  };
  const groupedItemEntries = (() => {
    const buckets = new Map<string, (typeof req.items)[number][]>();
    for (const item of req.items) {
      const section = getItemSection(item);
      const bucket = buckets.get(section);
      if (bucket) {
        bucket.push(item);
      } else {
        buckets.set(section, [item]);
      }
    }
    return Array.from(buckets.entries());
  })();
  const currency = process.env.NEXT_PUBLIC_CURRENCY || 'USD';
  const groupedForClient = groupedItemEntries.map(([section, items]) => {
    const rows = items.map((it) => {
      const quotedQty = Number(it.qty ?? 0);
      const requestedQty = Number(it.qtyRequested ?? 0);
      const extraQty = Number(it.extraRequestedQty ?? 0);
      const totalRequestedQty = requestedQty + extraQty;
      // Calculate Quoted Price (Original Approved Base) with multiple fallbacks
      let quotedTotalMajor = Number(it.amountMinor ?? 0n) / 100;
      let quotedUnitMajor = 0;

      // 1. Try to derive from Total Amount / Qty if possible (This is the "Committed" price on the requisition)
      if (quotedQty > 0 && quotedTotalMajor > 0) {
          quotedUnitMajor = quotedTotalMajor / quotedQty;
      }

      // 2. If NO valid price on the item itself, fallback to Quote Line
      if (quotedUnitMajor === 0 && it.quoteLine?.unitPriceMinor) {
          quotedUnitMajor = Number(it.quoteLine.unitPriceMinor) / 100;
          if (quotedQty > 0) quotedTotalMajor = quotedUnitMajor * quotedQty;
      }
      
      // 3. Last fallback to Estimate
      if (quotedUnitMajor === 0 && it.estPriceMinor) {
          quotedUnitMajor = Number(it.estPriceMinor) / 100;
          if (quotedQty > 0) quotedTotalMajor = quotedUnitMajor * quotedQty;
      }

      // If the item has been approved by a reviewer, treat the approved price as the new "quoted" baseline
      // so that we don't show a variance against the old quote.
      if (it.reviewApproved && typeof it.requestedUnitPriceMinor === 'bigint') {
        const approvedUnit = Number(it.requestedUnitPriceMinor) / 100;
        if (approvedUnit > 0) {
          quotedUnitMajor = approvedUnit;
          // Update total too if needed for display
          if (quotedQty > 0) {
            quotedTotalMajor = quotedUnitMajor * quotedQty;
          }
        }
      }

      let requestedUnitMajor =
        typeof it.requestedUnitPriceMinor === 'bigint'
          ? Number(it.requestedUnitPriceMinor) / 100
          : 0;
      
      // Fallback: If requested price is 0 (e.g. reset/cancelled) or not set, use Quoted (Original) price.
      if (requestedUnitMajor === 0 && quotedUnitMajor > 0) {
          requestedUnitMajor = quotedUnitMajor;
      }

      // REMOVED: Previous logic forced this to revert to quotedUnitMajor (Original Price).
      // But if the "Original Price" was never saved to amountMinor (e.g. it was just a draft 0.50),
      // we lost it when the user typed 10.00.
      // Better to show the ACTUAL current pending price (10.00) than fallback to the Quote (12.50).
      
      // if (it.reviewRequested && !it.reviewApproved && quotedUnitMajor > 0) {
      //     requestedUnitMajor = quotedUnitMajor;
      // }

      const requestedTotalMajor = requestedUnitMajor * (totalRequestedQty || 0);

      // If the item has been fully moved (totalRequestedQty <= 0), we might want to hide it
      // UNLESS it was partially purchased (bought > 0).
      // However, if we moved it, we set qtyRequested to purchasedQty.
      // So if purchasedQty is 0, qtyRequested is 0.
      // We should hide it if totalRequestedQty is 0 AND we haven't bought any (or rather, if it's effectively gone from this req).
      // Assuming purchasedQty matches qtyRequested if all remaining was moved.
      
      return {
        id: it.id,
        description: it.description,
        unit: it.unit,
        quotedQty,
        requestedQty,
        extraQty,
        totalRequestedQty,
        quotedTotalMajor,
        requestedTotalMajor,
        quotedUnitMajor,
        requestedUnitMajor,
        // @ts-ignore
        stagedUnitMajor: typeof it.stagedUnitPriceMinor === 'bigint' ? Number(it.stagedUnitPriceMinor) / 100 : 0,
        reviewRequested: it.reviewRequested,
        reviewApproved: it.reviewApproved,
        // @ts-ignore
        reviewRejectionReason: it.reviewRejectionReason,
        topups: (it.topups || []).map((top) => ({
          id: top.id,
          qtyRequested: Number(top.qtyRequested ?? 0),
          approved: Boolean(top.approved),
          reason: top.reason,
          createdAt: top.createdAt.toISOString(),
        })),
      };
    }).filter(row => row.totalRequestedQty > 0 || (row.quotedQty > 0 && row.reviewRequested)); 
    // ^ Filter: Hide if requested quantity is 0, UNLESS it's under review? 
    // No, if it's under review, it has qtyRequested > 0 (unless we moved it).
    // The user said "completely removed from the above list" if sent.
    // If sent, I set `reviewRequested=false` and `qtyRequested=0` (if fully moved).
    // So `row.totalRequestedQty > 0` should be the main filter.
    // But wait, what if I want to see "Quoted vs Actual" for historical purpose?
    // Current requirement: "riversend is completely removed".
    // So filtering by `totalRequestedQty > 0` seems correct.
    // But wait, if I purchased some, `qtyRequested` is > 0 (it equals purchased qty). So it stays. Clean.
    
    // Updated filter to be simple:
    const activeRows = rows.filter(row => row.totalRequestedQty > 0);

    return { section, items: activeRows };
  });
  const totals = groupedForClient.reduce(
    (acc, group) => {
      group.items.forEach((row) => {
        acc.quoted += row.quotedTotalMajor;
        acc.requested += row.requestedTotalMajor;
      });
      return acc;
    },
    { quoted: 0, requested: 0 }
  );
  const varianceTotal = totals.requested - totals.quoted;
  const hasPendingReviews = req.items.some((it) => it.reviewRequested && !it.reviewApproved);
  const reviewSubmissionPending = Boolean(req.reviewSubmittedAt);
  const reviewSubmittedLabel = req.reviewSubmittedAt
    ? new Date(req.reviewSubmittedAt).toLocaleString()
    : null;
  const reviewSubmittedByName = req.reviewSubmittedBy?.name ?? 'Procurement';

  const fundingAction = async (formData: FormData) => {
    'use server';
    const updates = parseUnitPriceUpdates(formData);
    if (updates.length) await saveUnitPricesForRequisition(requisitionId, updates);
    const priceMap = new Map(updates.map((u) => [u.itemId, u.unitPriceMajor]));
    const items = await prisma.procurementRequisitionItem.findMany({
      where: { requisitionId },
      select: { id: true, qty: true, qtyRequested: true, requestedUnitPriceMinor: true },
    });
    const missingPrices: string[] = [];
    const amount = items.reduce((sum, item) => {
      const qty = Number(item.qtyRequested ?? item.qty ?? 0);
      if (!(qty > 0)) return sum;
      // Use only the value supplied in this funding form; do not fall back to quoted unit price
      const unit = priceMap.get(item.id);
      if (!(typeof unit === 'number' && unit > 0)) {
        missingPrices.push(item.id);
        return sum;
      }
      return sum + qty * unit;
    }, 0);
    if (missingPrices.length > 0 || !(amount > 0)) {
      await setFlashMessage({
        type: 'error',
        message: 'Enter a unit price for every requisition item before requesting funding.',
      });
      revalidatePath(`/procurement/requisitions/${requisitionId}`);
      return;
    }
    await submitProcurementRequest(requisitionId, amount);
  };

  const sendForReviewAction = async (formData: FormData) => {
    'use server';
    const updates = parseUnitPriceUpdates(formData);
    // Removed early save: We save AFTER updating flags now.
    const reviewFlags = parseReviewFlagUpdates(formData);
    // Persist review flags only; leave existing ones true unless explicitly unchecked
    const trueIds = reviewFlags.filter((r) => r.flag).map((r) => r.itemId);
    const falseIds = reviewFlags.filter((r) => !r.flag).map((r) => r.itemId);
    if (trueIds.length) {
      await prisma.procurementRequisitionItem.updateMany({
        where: { id: { in: trueIds } },
        data: { reviewRequested: true, reviewApproved: false },
      });
    }
    if (falseIds.length) {
      await prisma.procurementRequisitionItem.updateMany({
        where: { id: { in: falseIds } },
        data: { reviewRequested: false },
      });
    }

    // Save unit prices AFTER updating flags, so that if an item is now marked for review,
    // the price is saved to 'stagedUnitPriceMinor' (via saveUnitPricesForRequisition logic).
    if (updates.length) await saveUnitPricesForRequisition(requisitionId, updates);

    // Re-check after updates to ensure at least one is marked
    let pending = await prisma.procurementRequisitionItem.count({
      where: { requisitionId, reviewRequested: true },
    });

    // If none marked, attempt to auto-flag lines whose requested unit price exceeds quoted
    if (pending === 0) {
      const items = await prisma.procurementRequisitionItem.findMany({
        where: { requisitionId },
        select: {
          id: true,
          qty: true,
          qtyRequested: true,
          amountMinor: true,
          requestedUnitPriceMinor: true,
          reviewApproved: true,
          quoteLine: { select: { unitPriceMinor: true } },
        },
      });
      const toFlag: string[] = [];
      for (const it of items) {
        // Skip if already approved
        if (it.reviewApproved) continue;

        const quotedQty = Number(it.qty ?? it.qtyRequested ?? 0);
        let quotedTotalMajor = Number(it.amountMinor ?? 0n) / 100;
        let quotedUnit = quotedQty > 0 ? quotedTotalMajor / quotedQty : quotedTotalMajor;

        // Fallback validation logic same as display
        if (quotedUnit === 0 && it.quoteLine?.unitPriceMinor) {
          quotedUnit = Number(it.quoteLine.unitPriceMinor) / 100;
        }

        const requestedUnit =
          typeof it.requestedUnitPriceMinor === 'bigint'
            ? Number(it.requestedUnitPriceMinor) / 100
            : 0;
        
        // Tolerance? Strict > check
        if (requestedUnit > quotedUnit) {
          toFlag.push(it.id);
        }
      }
      if (toFlag.length) {
        await prisma.procurementRequisitionItem.updateMany({
          where: { id: { in: toFlag } },
          data: { reviewRequested: true, reviewApproved: false },
        });
      }
      pending = await prisma.procurementRequisitionItem.count({
        where: { requisitionId, reviewRequested: true },
      });
    }

    if (pending === 0) {
      await setFlashMessage({
        type: 'error',
        message: 'Mark at least one item for review before sending',
      });
      revalidatePath(`/procurement/requisitions/${requisitionId}`);
      return;
    }

    if (funding?.status === 'APPROVED') {
        // Post-Funding / Purchase Stage: Split logic (Move bad items to new req)
        await sendRequisitionForReview(requisitionId);
    } else {
        // Pre-Funding: In-Place logic (Flag items on current req)
        await sendRequisitionForReviewInPlace(requisitionId);
    }

  };



  const requisition = await prisma.procurementRequisition.findUnique({
    where: { id: requisitionId },
    include: {
      items: {
        include: { quoteLine: true },
      },
      purchases: true,
    },
  });
  if (!requisition) return <div className="p-4">Requisition not found</div>;

  const purchasedByItem = new Map<string, { qty: number; totalMinor: bigint }>();
  for (const p of requisition.purchases) {
    if (!p.requisitionItemId) continue;
    const key = p.requisitionItemId;
    const prev = purchasedByItem.get(key) ?? { qty: 0, totalMinor: 0n };
    purchasedByItem.set(key, {
      qty: prev.qty + Number(p.qty),
      totalMinor: prev.totalMinor + BigInt(p.priceMinor),
    });
  }

  const projectId = req.projectId;

  // existing:
  const approvedAgg = await prisma.fundingRequest.aggregate({
    where: { status: 'APPROVED', requisitionId },
    _sum: { amountMinor: true },
  });

  const usedAgg = await prisma.purchase.aggregate({
    where: { requisitionId },
    _sum: { priceMinor: true },
  });

  // NEW: sum of all disbursements for funding requests under this requisition
  const disbursedAgg = await prisma.fundDisbursement.aggregate({
    where: { fundingRequest: { requisitionId } }, // relies on FundDisbursement -> FundingRequest relation
    _sum: { amountMinor: true },
  });

  // Active top-up (PENDING/REQUESTED/APPROVED = still active)
  const activeTopUp = await prisma.fundingRequest.findFirst({
    where: {
      requisitionId,
      isTopUp: true,
      status: { in: ['REQUESTED', 'APPROVED'] }, // treat APPROVED as still active until fully disbursed (optional)
    },
    orderBy: { createdAt: 'desc' },
    select: { id: true, status: true, amountMinor: true, requestedAt: true },
  });

  // Safely coerce to BigInt
  const approvedMinor = BigInt(approvedAgg._sum.amountMinor ?? 0);
  const spentMinor = BigInt(usedAgg._sum.priceMinor ?? 0);
  const disbursedMinor = BigInt(disbursedAgg._sum.amountMinor ?? 0);

  // Derived balances (still in minor units)
  const remainingMinor = approvedMinor - spentMinor; // budget remaining
  const cashGapMinor = disbursedMinor - spentMinor; // cash position; negative => bought on credit

  // Convert to major (number) using your helper
  const approved = fromMinor(approvedMinor);
  const used = fromMinor(spentMinor);
  const disbursed = fromMinor(disbursedMinor);
  const remaining = fromMinor(remainingMinor);
  const cashGap = fromMinor(cashGapMinor);

  const remainingClass = remainingMinor >= 0n ? 'text-emerald-700' : 'text-red-700';
  const cashGapClass = cashGapMinor >= 0n ? 'text-emerald-700' : 'text-red-700';

  const role = assertRole(user?.role);

  const isProcurement = role === 'PROCUREMENT' || role === 'SENIOR_PROCUREMENT' || role === 'ADMIN';
  const isSecurity = role === 'SECURITY' || role === 'ADMIN';
  const canViewVariance = role === 'PROJECT_COORDINATOR' || role === 'SENIOR_PROCUREMENT' || role === 'MANAGING_DIRECTOR' || role === 'ADMIN';
  const showReviewControls = role === 'PROCUREMENT' || role === 'SENIOR_PROCUREMENT';
  const fundingFormId = 'funding-form';
  const lastFundingStatus = req.funding?.[0]?.status;
  const isFundingRequested = lastFundingStatus === 'REQUESTED';

  const reviewFormId = 'review-form';
  const lockedByAccounts = funding?.status && funding.status !== 'REJECTED';
  const permissions = {
    canRequestTopUp: ['PROCUREMENT', 'SENIOR_PROCUREMENT', 'PROJECT_OPERATIONS_OFFICER', 'PROJECT_COORDINATOR', 'ADMIN'].includes(role),
    canApproveTopUp: ['PROJECT_COORDINATOR', 'MANAGING_DIRECTOR', 'ADMIN'].includes(role),
    canToggleReview: ['PROCUREMENT', 'SENIOR_PROCUREMENT', 'PROJECT_OPERATIONS_OFFICER', 'ADMIN'].includes(role),
    canApproveReview: ['SENIOR_PROCUREMENT', 'MANAGING_DIRECTOR', 'ADMIN'].includes(role),
    canEditUnitPrice: ['PROCUREMENT', 'SENIOR_PROCUREMENT', 'ADMIN'].includes(role) && !lockedByAccounts,
  };

  // Hide Top-up form when there is an active top-up OR funds remain
  const hideTopUpForm = Boolean(activeTopUp) || remainingMinor > 0n;

  const showStagePurchases = isProcurement &&
    (requisition.status === 'PURCHASED' ||
      requisition.status === 'PARTIAL' ||
      requisition.status === 'APPROVED');

  return (
    <div className="min-h-screen bg-slate-50/50 pb-20 font-sans">
      <div className="mx-auto max-w-5xl px-6 pt-6 mb-4 no-print">
         <Link href={`/projects/${req.projectId}`} className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
              <path fillRule="evenodd" d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z" clipRule="evenodd" />
            </svg>
            Back to Project
         </Link>
      </div>

      <main className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="space-y-6">
          {isProcurement ? (
            <div className="mb-6">
               <PurchaseOrderHeader 
                 customer={req.project.quote.customer}
                 project={req.project}
                 requisition={req}
                 title="Purchase Order"
               />
            </div>
          ) : (
          <div className="md:flex md:items-center md:justify-between">
            <div className="min-w-0 flex-1">
              <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:truncate sm:text-3xl sm:tracking-tight">
                {req.project.name}
              </h2>
              <div className="mt-1 flex flex-col sm:mt-0 sm:flex-row sm:flex-wrap sm:space-x-6">
                 <div className="mt-2 flex items-center text-sm text-gray-500">
                    Requisition #{req.id.slice(-6).toUpperCase()}
                 </div>
                 {req.submittedBy && (
                    <div className="mt-2 flex items-center text-sm text-gray-500">
                        Submitted by {req.submittedBy.name}
                    </div>
                 )}
              </div>
            </div>
            <div className="mt-4 flex md:ml-4 md:mt-0">
                 <span className={cn(
                    "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset shadow-sm",
                    funding?.status === 'APPROVED' 
                      ? "bg-emerald-50 text-emerald-700 ring-emerald-600/20"
                      : funding?.status === 'REJECTED'
                      ? "bg-red-50 text-red-700 ring-red-600/20"
                      : req.status === 'AWAITING_APPROVAL'
                      ? "bg-amber-50 text-amber-700 ring-amber-600/20"
                      : "bg-blue-50 text-blue-700 ring-blue-700/10"
                  )}>
                    {funding?.status || (req.status === 'AWAITING_APPROVAL' ? 'Awaiting Approval' : req.status)}
                  </span>
            </div>
          </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 mb-6">
               {!isProcurement && <PrintButton />}
               {req.status === 'DRAFT' && ['PROJECT_OPERATIONS_OFFICER', 'PROJECT_COORDINATOR', 'ADMIN'].includes(role) && (
                <form action={submitRequisition.bind(null, req.id)}>
                  <SubmitButton className="inline-flex items-center rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white shadow-md hover:bg-orange-500 transition-all">
                    Submit Requisition
                  </SubmitButton>
                </form>
              )}
          </div>
        
        <div className="space-y-8">
        
        {/* Key Metrics / Summary - REMOVED as per user request */}
        
        {/* Main Items Table */}
        {!showStagePurchases && (
          <Card className="overflow-hidden border-0 shadow-md ring-1 ring-gray-900/5">
            <CardContent className="p-0">
              <div className="max-h-[70vh] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent p-0">
              <ProcurementItemsTable
                  grouped={groupedForClient}
                  permissions={permissions}
                  currency={currency}
                  showTopUps={false}
                  showVariance={canViewVariance}
                  unitPriceFormIds={[fundingFormId, reviewFormId]}
                  reviewFlagFormIds={[reviewFormId]}
                  readOnly={reviewSubmissionPending || fundingLocked}
                  hideFinancials={role === 'PROJECT_OPERATIONS_OFFICER' && !fundingLocked}
                  rejectItemReviewAction={rejectItemReview.bind(null, requisitionId)}
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Review Status Banner / Staged Items Table */}
        {isProcurement && hasPendingReviews && !req.note?.includes('Review request from Req') && (
          <Card className="border-orange-100 bg-orange-50/50 shadow-sm ring-1 ring-orange-900/5">
             {/* If Post-Funding (Split Mode), show the Table. If Pre-Funding (In-Place), just show the Banner. */}
             {funding?.status === 'APPROVED' ? (
                 <>
                   <CardHeader className="pb-3 border-b border-orange-200/50">
                      <div className="flex items-center justify-between">
                          <div className="space-y-1">
                              <CardTitle className="flex items-center gap-2 text-lg font-bold text-orange-900">
                                  <ExclamationTriangleIcon className="h-5 w-5 text-orange-600" />
                                  Items Staged for Review
                              </CardTitle>
                              <CardDescription className="text-orange-800">
                                   Items are marked for review. Sending them will create a separate requisition for Senior QS approval.
                              </CardDescription>
                          </div>
                          {/* Action Button */}
                           <div className="flex items-center">
                              {reviewSubmissionPending ? (
                                   <p className="text-sm text-orange-700 bg-orange-100 px-3 py-1 rounded-full border border-orange-200">
                                     Sent on <span className="font-semibold">{reviewSubmittedLabel}</span>. Awaiting approval.
                                   </p>
                              ) : (
                                   <ReviewActionsClient
                                     reviewFormId={reviewFormId}
                                     sendForReviewAction={sendForReviewAction}
                                   />
                              )}
                           </div>
                      </div>
                   </CardHeader>
                   <CardContent className="pt-0 p-0">
                      <div className="bg-white border-t border-orange-200">
                          <table className="min-w-full divide-y divide-orange-100">
                              <thead className="bg-orange-50">
                                  <tr>
                                      <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-orange-800 uppercase tracking-wider">Item Description</th>
                                      <th scope="col" className="px-4 py-3 text-right text-xs font-semibold text-orange-800 uppercase tracking-wider">Quantity to Move</th>
                                      <th scope="col" className="px-4 py-3 text-right text-xs font-semibold text-orange-800 uppercase tracking-wider">New Unit Price</th>
                                      <th scope="col" className="px-4 py-3 text-right text-xs font-semibold text-orange-800 uppercase tracking-wider">Total Impact</th>
                                      <th scope="col" className="px-4 py-3 text-right text-xs font-semibold text-orange-800 uppercase tracking-wider">Actions</th>
                                  </tr>
                              </thead>
                              <tbody className="divide-y divide-orange-50 bg-white">
                                  {req.items.filter(it => it.reviewRequested && !it.reviewApproved).map(it => {
                                      const bought = purchasedByItem.get(it.id) ?? { qty: 0 };
                                      const remaining = Math.max(0, Number(it.qtyRequested ?? 0) - bought.qty);
                                      // @ts-ignore
                                      const unitPrice = Number(it.stagedUnitPriceMinor ?? 0n) / 100;
                                      const total = unitPrice * remaining;
                                      return (
                                          <tr key={it.id} className="hover:bg-orange-50/30 transition-colors">
                                              <td className="px-4 py-3 text-sm text-gray-900 font-medium">{it.description}</td>
                                              <td className="px-4 py-3 text-sm text-gray-600 text-right">{remaining} {it.unit}</td>
                                              <td className="px-4 py-3 text-sm text-gray-900 text-right font-mono"><Money value={unitPrice} /></td>
                                              <td className="px-4 py-3 text-sm text-orange-700 text-right font-bold font-mono"><Money value={total} /></td>
                                              <td className="px-4 py-3 text-right">
                                                  <form action={cancelItemReview.bind(null, req.id, it.id)}>
                                                      <button type="submit" className="text-gray-400 hover:text-red-600 transition-colors" title="Remove from Review Stage">
                                                          <TrashIcon className="h-4 w-4" />
                                                      </button>
                                                  </form>
                                              </td>
                                          </tr>
                                      )
                                  })}
                              </tbody>
                          </table>
                      </div>
                   </CardContent>
                 </>
             ) : (
                 /* Pre-Funding (In-Place Mode): Simple Banner only */
                 <CardContent className="flex items-center gap-4 p-6">
                   <div className="rounded-full bg-orange-100 p-3 shadow-sm ring-1 ring-orange-500/10">
                      <ClockIcon className="h-6 w-6 text-orange-600" />
                   </div>
                   <div className="flex-1">
                      <h3 className="text-base font-bold text-orange-900">Review Status</h3>
                      <div className="mt-1 text-sm text-orange-700">
                        {reviewSubmissionPending ? (
                          <p>
                            Sent to Senior Procurement on <span className="font-semibold">{reviewSubmittedLabel}</span>.
                            Awaiting approval.
                          </p>
                        ) : (
                          <ReviewActionsClient
                            reviewFormId={reviewFormId}
                            sendForReviewAction={sendForReviewAction}
                          />
                        )}
                      </div>
                   </div>
                 </CardContent>
             )}
          </Card>
        )}

        {/* Funding Actions */}
        {user?.role === 'PROCUREMENT' && !fundingLocked && (
           <Card className="border-0 shadow-md ring-1 ring-gray-900/5">
              <CardHeader className="border-b border-gray-100 bg-gray-50/50 py-4">
                <CardTitle className="flex items-center gap-2 text-lg font-bold text-gray-900">
                  <BanknotesIcon className="h-5 w-5 text-emerald-600" />
                  Request Funding
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <FundingActionsClient
                  canRequestFunding
                  fundingPending={hasPendingReviews}
                  fundingAction={fundingAction}
                  reviewFormId={reviewFormId}
                />
              </CardContent>
           </Card>
        )}

        {/* Accounts Approval UI */}
        {(['ACCOUNTS', 'ACCOUNTING_OFFICER', 'ADMIN', 'MANAGING_DIRECTOR'].includes(role)) && isFundingRequested && req.funding?.[0] && (
          <Card className="border-0 shadow-md ring-1 ring-gray-900/5">
             <CardHeader className="border-b border-gray-100 bg-gray-50/50 py-4">
               <CardTitle className="flex items-center gap-2 text-lg font-bold text-gray-900">
                 <CurrencyDollarIcon className="h-5 w-5 text-emerald-600" />
                 Funding Approval
               </CardTitle>
             </CardHeader>
             <CardContent className="p-6">
                <FundingApprovalClient
                  handleApproveFunding={async () => { 'use server'; await approveFunding(req.funding[0].id); }}
                  handleRejectFunding={async (fd) => { 'use server'; await rejectFunding(req.funding[0].id, String(fd.get('reason') || '')); }}
                  amount={Number(req.funding[0].amountMinor ?? 0) / 100}
                />
             </CardContent>
          </Card>
        )}

        {/* Purchase Processing Actions */}
        {/* {isProcurement && funding?.status === 'APPROVED' && requisition.status !== 'PURCHASED' && (
           <Card className="border-0 shadow-lg ring-1 ring-gray-900/5">
             <CardContent className="flex flex-col items-center justify-center space-y-6 p-10 text-center">
               <div className="rounded-full bg-blue-50 p-4 ring-1 ring-blue-500/10">
                  <ShoppingBagIcon className="h-10 w-10 text-orange-600" />
               </div>
               <div className="max-w-md space-y-2">
                 <h3 className="text-xl font-bold text-gray-900">Purchase Materials</h3>
                 <p className="text-sm text-gray-500">
                   Review items and mark them as purchased. Once all items are processed, you can close this requisition.
                 </p>
               </div>
               <form
                  action={async () => {
                    'use server';
                    await markAsPurchased(requisitionId);
                  }}
                >
                  {(() => {
                     const allPurchased = requisition.items.every(it => {
                       const bought = purchasedByItem.get(it.id)?.qty ?? 0;
                       return bought >= (it.qtyRequested ?? it.qty ?? 0);
                     });
                     const somePurchased = requisition.items.some(it => {
                       const bought = purchasedByItem.get(it.id)?.qty ?? 0;
                       return bought > 0;
                     });

                     let label = 'Purchase Materials';
                     let colorClass = 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200';

                     if (allPurchased) {
                       label = 'Complete & Close';
                       colorClass = 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200';
                     } else if (somePurchased) {
                       label = 'Purchase Remaining';
                       colorClass = 'bg-orange-600 hover:bg-orange-700 shadow-orange-200';
                     }

                     return (
                      <SubmitButton
                        loadingText={allPurchased ? 'Closing...' : 'Processing...'}
                        className={`rounded-xl px-8 py-3 text-white font-semibold shadow-lg transition-all active:scale-95 ${colorClass}`}
                      >
                        {label}
                      </SubmitButton>
                     );
                  })()}
                </form>
             </CardContent>
           </Card>
        )} */}

        {/* Top-up Status */}
        {activeTopUp && (
           <Card className="border-amber-200 bg-amber-50/50 shadow-sm">
             <CardContent className="flex items-start gap-4 p-6">
                <div className="rounded-lg bg-amber-100 p-2 text-amber-600 ring-1 ring-amber-600/10">
                   <ExclamationTriangleIcon className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-bold text-amber-900">Top-up in progress</h3>
                  <div className="mt-2 space-y-1 text-sm text-amber-800">
                    <p>Status: <span className="font-semibold">{activeTopUp.status}</span></p>
                    <p>Amount: <span className="font-semibold"><Money value={Number(activeTopUp.amountMinor) / 100} /></span></p>
                    <p>Requested: {new Date(activeTopUp.requestedAt!).toLocaleString()}</p>
                  </div>
                </div>
             </CardContent>
           </Card>
        )}

        {/* Staging & Purchases Section */}
        {showStagePurchases && (
            <Card className="border-0 shadow-md ring-1 ring-gray-900/5">
              <CardHeader className="border-b border-gray-100 bg-gradient-to-r from-gray-50 via-white to-gray-50 py-8 text-center">
                 <div className="flex flex-col items-center justify-center gap-2">
                    <div className="rounded-full bg-indigo-50 p-3 ring-1 ring-indigo-500/10">
                      <ShoppingBagIcon className="h-8 w-8 text-indigo-600" />
                    </div>
                    <h2 className="text-3xl font-black uppercase tracking-tight text-gray-900 sm:text-4xl">
                       Purchase Order
                     </h2>
                  </div>
               </CardHeader>
              
              <CardContent className="space-y-8 p-6">
                {/* Staged Items List */}
                {(() => {
                  const pendingPurchases = requisition.purchases.filter(p => !p.purchaseOrderId);
                  if (pendingPurchases.length > 0) {
                   return (
                     <div className="overflow-hidden rounded-xl border border-amber-200 bg-amber-50 shadow-sm">
                       <div className="flex items-center justify-between border-b border-amber-200 bg-amber-100/50 px-4 py-3">
                         <h4 className="flex items-center gap-2 font-semibold text-amber-900">
                            <ClockIcon className="h-4 w-4" />
                            Items ({pendingPurchases.length})
                         </h4>
                       </div>
                       <div className="overflow-x-auto">
                         <table className="w-full text-sm text-left">
                           <thead className="bg-amber-50/50 text-amber-900/70">
                             <tr>
                               <th className="py-2 pl-4 font-medium">Item Name</th>
                               <th className="py-2 text-right font-medium">Qty</th>
                               <th className="py-2 px-4 font-medium">Vendor</th>
                               <th className="py-2 font-medium">Ref</th>
                               <th className="py-2 text-right font-medium">Unit Price</th>
                               <th className="py-2 text-right pr-4 font-medium">Total</th>
                               <th className="py-2 text-center w-10"></th>
                             </tr>
                           </thead>
                           <tbody className="divide-y divide-amber-200/50">
                             {pendingPurchases.map(p => {
                               const unitPrice = p.qty > 0 ? (Number(p.priceMinor) / 100) / p.qty : 0;
                               const itemDesc = requisition.items.find(i => i.id === p.requisitionItemId)?.description ?? 'Unknown Item';
                               return (
                                 <tr key={p.id} className="transition-colors hover:bg-amber-100/30">
                                   <td className="py-2 pl-4 font-medium text-amber-900">{itemDesc}</td>
                                   <td className="py-2 text-right text-amber-800">{p.qty}</td>
                                   <td className="py-2 px-4 text-amber-800">{p.vendor}</td>
                                   <td className="py-2 text-amber-800">{p.taxInvoiceNo}</td>
                                   <td className="py-2 text-right text-amber-800"><Money value={unitPrice} /></td>
                                   <td className="py-2 pr-4 text-right font-bold text-amber-900"><Money value={Number(p.priceMinor) / 100} /></td>
                                   <td className="py-2 text-center">
                                     <form action={deleteStagedPurchase.bind(null, p.id)}>
                                       <button className="text-amber-400 hover:text-red-600 transition-colors p-1">
                                          <TrashIcon className="h-4 w-4" />
                                       </button>
                                     </form>
                                   </td>
                                 </tr>
                               );
                             })}
                           </tbody>
                         </table>
                       </div>
                       <div className="bg-amber-100/50 p-2">
                          <form action={createPartialPOFromPurchases.bind(null, requisitionId)}>
                            <SubmitButton className="w-full rounded-lg bg-amber-600 px-4 py-3 text-sm font-bold text-white shadow-sm hover:bg-amber-700 uppercase tracking-wide">
                              Purchase
                            </SubmitButton>
                          </form>
                       </div>
                     </div>
                   );
                  }
                  return null;
                })()}

                {/* All Purchases Table */}
                {(() => {
                  const itemsToPurchase = requisition.items.filter(it => {
                    if (it.reviewRequested) return false;
                    const bought = purchasedByItem.get(it.id) ?? { qty: 0, totalMinor: 0n };
                    const remaining = Math.max(0, Number(it.qtyRequested ?? 0) - bought.qty);
                    return remaining > 0;
                  });

                  if (itemsToPurchase.length === 0) return null;

                  return (
                    <div>
                      <div className="overflow-hidden rounded-lg border border-gray-200 shadow-sm">
                        <table className="min-w-full divide-y divide-gray-200 text-sm">
                          <thead className="bg-gray-50/50">
                            <tr>
                              <th className="px-4 py-3 text-left font-medium text-gray-500">Item</th>
                              <th className="px-4 py-3 text-right font-medium text-gray-500">Req. Qty</th>
                              <th className="px-4 py-3 text-right font-medium text-gray-500">Purchased</th>
                              <th className="px-4 py-3 text-right font-medium text-gray-500">Remaining</th>
                              <th className="w-[40%] px-4 py-3 text-left font-medium text-gray-500">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200 bg-white">
                            {itemsToPurchase.map((it) => {
                              const bought = purchasedByItem.get(it.id) ?? { qty: 0, totalMinor: 0n };
                              const remaining = Math.max(0, Number(it.qtyRequested ?? 0) - bought.qty);

                              return (
                                <tr key={it.id} className="transition-colors hover:bg-gray-50">
                                  <td className="align-top px-4 py-3">
                                    <div className="font-medium text-gray-900">{it.description}</div>
                                    <div className="text-xs text-gray-500">{it.unit ?? '-'}</div>
                                    <div className="mt-1 text-xs text-gray-400">
                                      Est: <Money value={Number(it.amountMinor) / 100} />
                                    </div>
                                  </td>
                                  <td className="align-top px-4 py-3 text-right text-gray-700">{Number(it.qtyRequested ?? 0)}</td>
                                  <td className="align-top px-4 py-3 text-right text-gray-700">{bought.qty}</td>
                                  <td className="align-top px-4 py-3 text-right font-medium text-gray-900">{remaining}</td>
                                  <td className="align-top px-4 py-3">
                                      <PurchaseItemForm
                                        requisitionId={requisition.id}
                                        itemId={it.id}
                                        description={it.description}
                                        remainingQty={remaining}
                                        approvedUnitPrice={(() => {
                                            // STRICT LOGIC: "We already passed the stage where we used the quotation"
                                            // 1. If an explicit requested price exists (from Funding Request or Review), USE IT.
                                            if (it.requestedUnitPriceMinor && it.requestedUnitPriceMinor > 0n) {
                                                return Number(it.requestedUnitPriceMinor) / 100;
                                            }
    
                                            // 2. Fallback: Derive from Committed Amount / Qty 
                                            // (This amount might have come from the Quote initially, but it is now the "Requisitioned Amount")
                                            if (Number(it.amountMinor ?? 0) > 0 && Number(it.qtyRequested ?? it.qty ?? 0) > 0) {
                                                return (Number(it.amountMinor) / 100) / Number(it.qtyRequested ?? it.qty);
                                            }
    
                                            // 3. Last Resort: Estimate (if exists)
                                            if (it.estPriceMinor) {
                                                return Number(it.estPriceMinor) / 100;
                                            }
    
                                            // 4. Quotation: User explicitly said NOT to fallback to quote here if it differs.
                                            // However, if amountMinor was 0, maybe we simply have no data?
                                            // Returning 0 is safer than returning a wrong high price that blocks the form.
                                            return 0;
                                        })()}
                                        createPurchaseAction={createPurchase}
                                      />
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          )}
      
          </div> 
        </div>  
      </main>    
    </div>
  );
}