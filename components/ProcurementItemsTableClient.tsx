'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import clsx from 'clsx';
import ClearableNumberInput from './ClearableNumberInput';

type Topup = {
  id: string;
  qtyRequested: number;
  reason?: string | null;
  approved: boolean;
  createdAt: string;
};

type TopupRow = {
  id: string;
  qtyRequested: number;
  approved: boolean;
  reason?: string | null;
  createdAt: string;
};

export type ProcurementItemRow = {
  id: string;
  description: string;
  unit?: string | null;
  quotedQty: number;
  requestedQty: number;
  extraQty: number;
  totalRequestedQty: number;
  quotedTotalMajor: number;
  requestedTotalMajor: number;
  quotedUnitMajor: number;
  requestedUnitMajor: number;
  stagedUnitMajor: number;
  reviewRequested: boolean;
  reviewApproved: boolean;
  reviewRejectionReason?: string | null;
  topups: TopupRow[];
};

export type ProcurementItemGroup = {
  section: string;
  items: ProcurementItemRow[];
};

export type ProcurementTablePermissions = {
  canRequestTopUp: boolean;
  canApproveTopUp: boolean;
  canToggleReview: boolean;
  canApproveReview: boolean;
  canEditUnitPrice: boolean;
};

type Actions = {
  requestTopUpForItem: (id: string, qty: number, note?: string | null) => Promise<any>;
  approveTopUpRequest: (id: string, approve?: boolean) => Promise<any>;
  requestItemReview: (id: string, flag: boolean) => Promise<any>;
  approveItemReview: (id: string) => Promise<any>;
  rejectItemReview: (id: string, reason: string) => Promise<any>;
  updateRequisitionItemUnitPrice: (id: string, unitPriceMajor: number) => Promise<any>;
};

export default function ProcurementItemsTableClient({
  grouped,
  permissions,
  currency,
  actions,
  showTopUps = true,
  showVariance = true,
  unitPriceFormIds = [],
  showReviewControls = true,
  reviewFlagFormIds = [],
  readOnly = false,
  hideFinancials = false,
}: {
  grouped: ProcurementItemGroup[];
  permissions: ProcurementTablePermissions;
  currency: string;
  actions: Actions;
  showTopUps?: boolean;
  showVariance?: boolean;
  unitPriceFormIds?: string[];
  showReviewControls?: boolean;
  reviewFlagFormIds?: string[];
  readOnly?: boolean;
  hideFinancials?: boolean;
}) {
  const router = useRouter();
  const [unitPriceInputs, setUnitPriceInputs] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    grouped.forEach((group) =>
      group.items.forEach((item) => {
        if (item.reviewRequested) {
          init[item.id] = item.stagedUnitMajor > 0 ? item.stagedUnitMajor.toString() : '';
        } else {
          const req = Number(item.requestedUnitMajor);
          const quoted = Number(item.quotedUnitMajor);
          const isDefault = Math.abs(req - quoted) < 0.01;
          init[item.id] = (req > 0 && !isDefault) ? req.toString() : '';
        }
      })
    );
    return init;
  });
  const [topUpInputs, setTopUpInputs] = useState<Record<string, string>>({});
  const [topUpNotes, setTopUpNotes] = useState<Record<string, string>>({});
  const [reviewFlags, setReviewFlags] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    grouped.forEach((g) =>
      g.items.forEach((it) => {
        init[it.id] = Boolean(it.reviewRequested);
      }),
    );
    if (typeof window !== 'undefined') {
      const detail = Object.values(init).some(Boolean);
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('review-flags-change', { detail }));
      }, 0);
    }
    return init;
  });
  const [recentRejected, setRecentRejected] = useState<Record<string, boolean>>({});
  const [status, setStatus] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState<{ itemId: string } | null>(null);
  const [rejectionModal, setRejectionModal] = useState<{ itemId: string; description: string } | null>(null);
  const [rejectionReasonInput, setRejectionReasonInput] = useState('');
  const [isPending, startTransition] = useTransition();

  const formatter = useMemo(
    () =>
      new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: currency || 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    [currency]
  );

  useEffect(() => {
    const next: Record<string, string> = {};
    grouped.forEach((group) =>
      group.items.forEach((item) => {
        if (item.reviewRequested) {
          next[item.id] = item.stagedUnitMajor > 0 ? item.stagedUnitMajor.toString() : '';
        } else {
          const req = Number(item.requestedUnitMajor);
          const quoted = Number(item.quotedUnitMajor);
          const isDefault = Math.abs(req - quoted) < 0.01;
          next[item.id] = (req > 0 && !isDefault) ? req.toString() : '';
        }
      })
    );
    setUnitPriceInputs(next);

    const rf: Record<string, boolean> = {};
    grouped.forEach((group) =>
      group.items.forEach((item) => {
        rf[item.id] = Boolean(item.reviewRequested);
      })
    );
    setReviewFlags(rf);
    if (typeof window !== 'undefined') {
      const detail = Object.values(rf).some(Boolean);
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('review-flags-change', { detail }));
      }, 0);
    }
  }, [grouped]);

  const totalCalculated = useMemo(() => {
    let total = 0;
    grouped.forEach((group) =>
      group.items.forEach((item) => {
        const qty = Number(item.requestedQty ?? item.quotedQty ?? 0);
        const unit = Number(unitPriceInputs[item.id] ?? '0');
        if (Number.isFinite(unit) && unit > 0) {
          total += qty * unit;
        }
      })
    );
    return total;
  }, [grouped, unitPriceInputs]);

  const handleUnitPriceBlur = (item: ProcurementItemRow) => {
    const raw = unitPriceInputs[item.id] ?? '';
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed < 0) {
      setUnitPriceInputs((prev) => ({ ...prev, [item.id]: '0' }));
      return;
    }
    if (!reviewFlags[item.id] && item.quotedUnitMajor > 0 && parsed > item.quotedUnitMajor) {
      setUnitPriceInputs((prev) => ({ ...prev, [item.id]: '0' }));
      setModalOpen({ itemId: item.id });
      return;
    }
    if (!permissions.canEditUnitPrice || readOnly) return;
  };

  const handleTopUpRequest = (itemId: string) => {
    const qty = Number(topUpInputs[itemId] ?? 0);
    if (!Number.isFinite(qty) || qty <= 0) {
      setStatus('Top-up quantity must be greater than zero');
      return;
    }
    const note = topUpNotes[itemId] ?? '';
    setStatus(null);
    startTransition(() => {
      actions
        .requestTopUpForItem(itemId, qty, note)
        .then(() => {
          setTopUpInputs((prev) => ({ ...prev, [itemId]: '' }));
          setTopUpNotes((prev) => ({ ...prev, [itemId]: '' }));
          router.refresh();
        })
        .catch((err) => setStatus(err?.message + ' Failed to request top-up'));
    });
  };

  const handleApproveTopup = (topupId: string, approve: boolean) => {
    startTransition(() => {
      actions
        .approveTopUpRequest(topupId, approve)
        .then(() => router.refresh())
        .catch((err) => setStatus(err?.message + ' Failed to update top-up'));
    });
  };

  const handleToggleReview = (item: ProcurementItemRow, flag: boolean) => {
    if (!flag) {
      const current = Number(unitPriceInputs[item.id] ?? 0);
      if (item.quotedUnitMajor > 0 && current > item.quotedUnitMajor) {
        setUnitPriceInputs((prev) => ({ ...prev, [item.id]: '0' }));
      }
    }

    setReviewFlags((prev) => {
      const next = { ...prev, [item.id]: flag };
      if (typeof window !== 'undefined') {
        const detail = Object.values(next).some(Boolean);
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('review-flags-change', { detail }));
        }, 0);
      }
      return next;
    });

    startTransition(() => {
      actions
        .requestItemReview(item.id, flag)
        .then(() => {
             // success - do nothing, keep local state
        })
        .catch((err) => setStatus(err?.message ?? 'Failed to update review flag'));
    });
  };

  const handleApproveReview = (itemId: string) => {
    startTransition(() => {
      actions
        .approveItemReview(itemId)
        .then(() => router.refresh())
        .catch((err) => setStatus(err?.message + ' Failed to approve review'));
    });
  };

  const handleRejectReview = (item: ProcurementItemRow) => {
    setRejectionModal({ itemId: item.id, description: item.description });
    setRejectionReasonInput('');
  };

  const confirmRejection = () => {
      if (!rejectionModal) return;
      const { itemId } = rejectionModal;
      const reason = rejectionReasonInput.trim();

      if (!reason) {
          setStatus('Reason is required to reject');
          return;
      }

      // Optimistic updates
      const item = grouped.flatMap(g => g.items).find(i => i.id === itemId);
      if (item) {
          const resetTo = item.quotedUnitMajor > 0 ? item.quotedUnitMajor.toString() : '';
          setReviewFlags((prev) => ({ ...prev, [itemId]: false }));
          setRecentRejected((prev) => ({ ...prev, [itemId]: true }));
          setUnitPriceInputs((prev) => ({ ...prev, [itemId]: resetTo }));
      }

      setRejectionModal(null);
      
      startTransition(() => {
        actions
          .rejectItemReview(itemId, reason)
          .then(() => router.refresh())
          .catch((err) => setStatus(err?.message + ' Failed to reject review'));
      });
  }

  return (
    <div className="space-y-6">
      {status && (
        <div className="rounded border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-700">
          {status}
        </div>
      )}
      {!hideFinancials && (
        <div className="rounded border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-700">
          Current total: <span className="font-semibold">{formatter.format(totalCalculated)}</span>
        </div>
      )}
      {grouped.map((group) => {
        if (group.items.length === 0) return null;
        return (
        <div key={group.section} className="space-y-4">
           <div className="flex items-center justify-between px-1">
            <h4 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <span className="w-1 h-6 bg-orange-500 rounded-full"></span>
              {group.section}
            </h4>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden dark:border-gray-700 dark:bg-gray-800">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50/80 backdrop-blur-sm dark:bg-gray-900/50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Item</th>
                  <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Unit</th>
                  <th className="px-6 py-4 text-right text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Quoted Qty</th>
                  <th className="px-6 py-4 text-right text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Requested</th>
                  {showVariance && <th className="px-6 py-4 text-right text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Variance</th>}
                  {!hideFinancials && <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Unit Price</th>}
                  {showTopUps && <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Top-up</th>}
                  {!hideFinancials && (showReviewControls || Object.values(reviewFlags).some(Boolean)) && (
                    <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Review</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-800">
                {group.items.map((item) => {
                  const enteredUnit = Number(unitPriceInputs[item.id] ?? '0');
                  const variance = item.quotedUnitMajor - enteredUnit;
                  const varianceClass =
                    variance >= 0 ? 'text-emerald-600' : 'text-rose-600';
                  
                  const showReviewColumn = !hideFinancials && (showReviewControls || Object.values(reviewFlags).some(Boolean));

                  return (
                    <tr key={item.id} className="group hover:bg-orange-50/30 transition-colors dark:hover:bg-gray-700/50 border-b last:border-b-0 align-top">
                      <td className="px-6 py-4">
                        <div className="font-medium text-gray-900">{item.description}</div>
                        {item.topups.length > 0 && (
                          <div className="mt-1 text-xs text-gray-500">
                            Top-ups:{' '}
                            {item.topups.map((top) => (
                              <span key={top.id} className="mr-2 inline-flex flex-col">
                                <span>
                                  +{top.qtyRequested}{' '}
                                  <span
                                    className={top.approved ? 'text-emerald-600' : 'text-amber-600'}
                                  >
                                    {top.approved ? 'approved' : 'pending'}
                                  </span>
                                </span>
                                <span
                                  className={top.approved ? 'text-emerald-600' : 'text-amber-600'}
                                >
                                  {top.reason ? `note: ${top.reason}` : ''}
                                </span>
                              </span>
                            ))}
                          </div>
                        )}
                        {/* Display Rejection Reason if present and not currently under review (or if we want to show history) */}
                        {!item.reviewRequested && item.reviewRejectionReason && (
                             <div className="mt-2 text-xs text-rose-700 bg-rose-50 p-2 rounded border border-rose-200">
                                <strong>Rejection Reason:</strong> {item.reviewRejectionReason}
                             </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{item.unit ?? '-'}</td>
                      <td className="px-6 py-4 text-right text-sm text-gray-600">{item.quotedQty.toLocaleString()}</td>
                      <td className="px-6 py-4 text-right text-sm font-medium text-gray-900">
                        <div>{item.requestedQty.toLocaleString()}</div>
                        {item.extraQty > 0 && (
                          <div className="text-xs text-amber-600">+{item.extraQty} pending</div>
                        )}
                      </td>
                      {showVariance && (
                        <td className={`px-6 py-4 text-right font-semibold text-sm ${varianceClass}`}>
                          {formatter.format(variance)}
                        </td>
                      )}
                      {!hideFinancials && (
                        <td className="px-6 py-4">
                          {!readOnly || (reviewFlags[item.id] && !item.reviewRequested) || (!!item.reviewRejectionReason && !item.reviewRequested) ? (
                            <ClearableNumberInput
                              id={`visible-unitPrice-${item.id}`}
                              type="text"
                              value={unitPriceInputs[item.id] ?? ''}
                              placeholder="0"
                              onChange={(e) => {
                                const nextVal = e?.currentTarget?.value ?? '';
                                setUnitPriceInputs((prev) => ({ ...prev, [item.id]: nextVal }));
                              }}
                              onBlur={() => handleUnitPriceBlur(item)}
                              disabled={
                                reviewFlags[item.id] 
                                    ? !permissions.canToggleReview 
                                    : !permissions.canEditUnitPrice
                              }
                                className={clsx(
                                  "w-24 text-right rounded-md border-gray-300 shadow-sm focus:border-orange-500 focus:ring-orange-500 sm:text-sm"
                                )}
                            />
                          ) : (
                            <span className="font-medium text-gray-900">
                              {formatter.format(Number(unitPriceInputs[item.id] ?? 0))}
                            </span>
                          )}
                          {unitPriceFormIds.map((formId) => (
                            <input
                              key={`${item.id}-${formId}`}
                              type="hidden"
                              form={formId}
                              name={`unitPrice-${item.id}`}
                              value={unitPriceInputs[item.id] ?? ''}
                            />
                          ))}
                          {reviewFlagFormIds.map((formId) => (
                            <input
                              key={`review-${item.id}-${formId}`}
                              type="hidden"
                              form={formId}
                              name={`reviewFlag-${item.id}`}
                              value={reviewFlags[item.id] ? '1' : '0'}
                            />
                          ))}
                        </td>
                      )}
                      {showTopUps && (
                        <td className="px-6 py-4">
                          {permissions.canRequestTopUp ? (
                            <div className="space-y-2">
                              <ClearableNumberInput
                                type="text"
                                placeholder="Qty"
                                value={topUpInputs[item.id] ?? ''}
                                onChange={(e) =>
                                  setTopUpInputs((prev) => ({
                                    ...prev,
                                    [item.id]: e.currentTarget.value,
                                  }))
                                }
                                className="w-24 rounded-md border-gray-300 shadow-sm focus:border-orange-500 focus:ring-orange-500 sm:text-sm"
                                disabled={readOnly}
                              />
                              <input
                                type="text"
                                placeholder="Reason"
                                value={topUpNotes[item.id] ?? ''}
                                onChange={(e) =>
                                  setTopUpNotes((prev) => ({
                                    ...prev,
                                    [item.id]: e.currentTarget.value,
                                  }))
                                }
                                className="w-full rounded-md border-gray-300 px-2 py-1 text-xs focus:border-orange-500 focus:ring-orange-500 sm:text-sm"
                                disabled={readOnly}
                              />
                              <button
                                type="button"
                                onClick={() => handleTopUpRequest(item.id)}
                                className="rounded bg-orange-600 px-3 py-1 text-xs font-medium text-white shadow-sm hover:bg-orange-50 disabled:opacity-60"
                                disabled={isPending || readOnly}
                              >
                                Request more
                              </button>
                            </div>
                          ) : (
                            <div className="text-xs text-gray-500">Top-up requests disabled</div>
                          )}
                          {permissions.canApproveTopUp &&
                            item.topups
                              .filter((t) => !t.approved)
                              .map((t) => (
                                <div key={t.id} className="mt-2 text-xs text-gray-600">
                                  Pending {t.qtyRequested}{' '}
                                  <button
                                    type="button"
                                    className="text-emerald-600 hover:underline disabled:opacity-50"
                                    disabled={isPending}
                                    onClick={() => handleApproveTopup(t.id, true)}
                                  >
                                    Approve
                                  </button>
                                </div>
                              ))}
                        </td>
                      )}
                      {showReviewColumn && (
                        <td className="px-6 py-4">
                          {showReviewControls && (
                            <label className="flex items-center gap-2 text-sm text-gray-800">
                              <input
                                type="checkbox"
                                checked={reviewFlags[item.id] ?? false}
                                disabled={!permissions.canToggleReview || isPending || readOnly}
                                onChange={(e) => handleToggleReview(item, e.target.checked)}
                                className="h-4 w-4 rounded border-gray-300 text-orange-600 focus:ring-orange-600"
                              />
                              <span className={reviewFlags[item.id] ? 'text-rose-600' : ''}>
                                Request review
                              </span>
                            </label>
                          )}
                          {reviewFlags[item.id] &&
                            !item.reviewApproved &&
                            permissions.canApproveReview && (
                              <div className="mt-2 flex gap-2">
                                <button
                                  type="button"
                                  className="rounded border border-emerald-500 px-2 py-1 text-xs text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                                  disabled={isPending}
                                  onClick={() => handleApproveReview(item.id)}
                                >
                                  Approve item
                                </button>
                                <button
                                  type="button"
                                  className="rounded border border-rose-500 px-2 py-1 text-xs text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                                  disabled={isPending}
                                  onClick={() => handleRejectReview(item)}
                                >
                                  Reject
                                </button>
                              </div>
                            )}
                          {item.reviewApproved && (
                            <div className="mt-1 text-xs font-medium text-emerald-600">Approved</div>
                          )}
                          {!item.reviewApproved && recentRejected[item.id] && (
                            <div className="mt-1 text-xs font-medium text-rose-600">Rejected</div>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        </div>
        );
      })}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded bg-white p-4 shadow-lg">
            <h3 className="text-lg font-semibold text-gray-900">Unit price requires review</h3>
            <p className="mt-2 text-sm text-gray-600">
              The unit price entered exceeds the quoted price. Flag the item for review before using
              a higher value.
            </p>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                className="rounded bg-barmlo-blue px-4 py-1.5 text-sm text-white"
                onClick={() => setModalOpen(null)}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {rejectionModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
              <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl transform transition-all">
                  <h3 className="text-xl font-bold text-gray-900 mb-2">Reject Review Request</h3>
                  <p className="text-sm text-gray-600 mb-4">
                      Please provide a reason for rejecting the review for <strong>{rejectionModal.description}</strong>.
                      This will be visible to the Procurement Officer.
                  </p>
                  
                  <textarea
                      className="w-full rounded-lg border-gray-300 shadow-sm focus:border-rose-500 focus:ring-rose-500 sm:text-sm min-h-[100px]"
                      placeholder="Enter rejection reason..."
                      value={rejectionReasonInput}
                      onChange={(e) => setRejectionReasonInput(e.target.value)}
                  />

                  <div className="mt-6 flex justify-end gap-3">
                      <button
                          type="button"
                          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                          onClick={() => setRejectionModal(null)}
                          disabled={isPending}
                      >
                          Cancel
                      </button>
                      <button
                          type="button"
                          className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-rose-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-rose-500 disabled:opacity-60"
                          onClick={confirmRejection}
                          disabled={isPending || !rejectionReasonInput.trim()}
                      >
                          {isPending ? 'Rejecting...' : 'Confirm Rejection'}
                      </button>
                  </div>
              </div>
          </div>
      )}

    </div>
  );
}
