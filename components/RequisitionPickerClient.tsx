'use client';

import React, { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import ClearableNumberInput from './ClearableNumberInput';

type LineRow = {
  id: string;
  qtyOrdered: number;
  description: string;
  unit?: string | null;
  purchased: number;
  remaining: number;
  alreadyRequested: number;
  category: string;
  approvedExtra: number;
};

type ExtraRequestRow = {
  id: string;
  qty: number;
  reason?: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  requiresAdmin: boolean;
  requestedByName: string;
  requestedByRole?: string | null;
  decidedByName?: string | null;
  decidedAt?: string | null;
  createdAt: string;
};

type Props = {
  clientGrouped: Record<string, LineRow[]>;
  initiallySelected?: { quoteLineId: string; qty: number }[];
  projectId: string;
  currentRole?: string | null;
  requestsByLine: Record<string, ExtraRequestRow[]>;
};

type ExtraModalState =
  | { mode: 'request'; line: LineRow }
  | { mode: 'review'; line: LineRow; request: ExtraRequestRow };

const REQUEST_ROLES = new Set(['PROJECT_OPERATIONS_OFFICER', 'PROJECT_COORDINATOR', 'ADMIN']);
const REVIEW_ROLES = new Set(['PROJECT_COORDINATOR', 'ADMIN']);

export default function RequisitionPickerClient({
  clientGrouped,
  initiallySelected = [],
  projectId,
  currentRole,
  requestsByLine,
}: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [qtys, setQtys] = useState<Record<string, number>>({});
  const [catSelectAll, setCatSelectAll] = useState<Record<string, boolean>>({});
  const [extraModal, setExtraModal] = useState<ExtraModalState | null>(null);
  const [modalDraft, setModalDraft] = useState<{ qty: string; reason: string }>({ qty: '', reason: '' });
  const [modalError, setModalError] = useState<string | null>(null);
  const [isSaving, startTransition] = useTransition();

  const categories = useMemo(() => Object.keys(clientGrouped), [clientGrouped]);
  const flat = useMemo(() => categories.flatMap((cat) => clientGrouped[cat] || []), [categories, clientGrouped]);
  const idxToId = useMemo(() => flat.map((l) => l.id), [flat]);

  useEffect(() => {
    const initialSelected = new Set(initiallySelected.map((row) => row.quoteLineId));
    const sel: Record<string, boolean> = {};
    const q: Record<string, number> = {};
    const catAll: Record<string, boolean> = {};
    for (const [cat, lines] of Object.entries(clientGrouped)) {
      catAll[cat] = false;
      for (const ln of lines) {
        const defaultQty = ln.remaining > 0 ? ln.remaining : 0;
        const isInit = initialSelected.has(ln.id);
        sel[ln.id] = selected[ln.id] ?? isInit;
        q[ln.id] =
          ln.id in qtys
            ? qtys[ln.id]
            : isInit
              ? Math.max(0, initiallySelected.find((row) => row.quoteLineId === ln.id)?.qty ?? defaultQty)
              : defaultQty;
      }
    }
    setSelected(sel);
    setQtys(q);
    setCatSelectAll(catAll);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientGrouped]);

  const syncCategoryState = (id: string, updated: Record<string, boolean>) => {
    for (const [cat, lines] of Object.entries(clientGrouped)) {
      if (lines.some((l) => l.id === id)) {
        const all = lines.every((ln) => updated[ln.id]);
        setCatSelectAll((prev) => ({ ...prev, [cat]: all }));
        break;
      }
    }
  };

  const toggleLine = (id: string) => {
    setSelected((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      syncCategoryState(id, next);
      return next;
    });
  };

  const onQtyChange = (id: string, raw: string, max: number) => {
    let n = Number(raw);
    if (!Number.isFinite(n)) n = 0;
    n = Math.ceil(n);
    if (n < 0) n = 0;
    if (n > max) n = max;
    setQtys((prev) => ({ ...prev, [id]: n }));
    setSelected((prev) => {
      const next = { ...prev, [id]: n > 0 };
      syncCategoryState(id, next);
      return next;
    });
  };

  const toggleCategory = (cat: string) => {
    const lines = clientGrouped[cat] ?? [];
    const newVal = !catSelectAll[cat];
    setCatSelectAll((prev) => ({ ...prev, [cat]: newVal }));
    setSelected((prev) => {
      const next = { ...prev };
      for (const ln of lines) next[ln.id] = newVal;
      return next;
    });
    setQtys((prev) => {
      const next = { ...prev };
      for (const ln of lines) {
        if (newVal) {
          const fallback = next[ln.id];
          const numericRaw = Number(fallback);
          const numeric = Number.isFinite(numericRaw) ? numericRaw : ln.remaining;
          next[ln.id] = Math.min(ln.remaining, Math.max(0, numeric));
        } else {
          next[ln.id] = 0;
        }
      }
      return next;
    });
  };

  const canRequestMore = REQUEST_ROLES.has(currentRole ?? '');

  const openNewRequestModal = (line: LineRow) => {
    setModalDraft({ qty: '', reason: '' });
    setModalError(null);
    setExtraModal({ mode: 'request', line });
  };

  const openReviewModal = (line: LineRow, request: ExtraRequestRow) => {
    setModalError(null);
    setExtraModal({ mode: 'review', line, request });
  };

  const submitExtraRequest = () => {
    if (!extraModal || extraModal.mode !== 'request') return;
    const qty = Number(modalDraft.qty);
    if (!Number.isFinite(qty) || qty <= 0) {
      setModalError('Enter a quantity greater than zero.');
      return;
    }
    startTransition(async () => {
      try {
        const res = await fetch(
          `/api/projects/${projectId}/quote-lines/${extraModal.line.id}/extra-request`,
          {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ qty, reason: modalDraft.reason }),
          },
        );
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          setModalError(data?.error ?? 'Failed to request more');
          return;
        }
        setExtraModal(null);
        router.refresh();
      } catch (err: any) {
        setModalError(err?.message ?? 'Failed to request more');
      }
    });
  };

  const decideExtraRequest = (approve: boolean) => {
    if (!extraModal || extraModal.mode !== 'review') return;
    startTransition(async () => {
      try {
        const res = await fetch(`/api/quote-line-extra/${extraModal.request.id}`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ approve }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          setModalError(data?.error ?? 'Failed to update request');
          return;
        }
        setExtraModal(null);
        router.refresh();
      } catch (err: any) {
        setModalError(err?.message ?? 'Failed to update request');
      }
    });
  };

  const closeModal = () => {
    setExtraModal(null);
    setModalError(null);
  };

  return (
    <div className="space-y-8">
      {categories.map((cat) => (
        <section key={cat} className="space-y-4">
          <div className="flex items-center justify-between rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-900/5">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <span className="inline-block h-2 w-2 rounded-full bg-indigo-500"></span>
              {cat}
            </h2>
            <label className="group inline-flex cursor-pointer items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600"
                checked={Boolean(catSelectAll[cat])}
                onChange={() => toggleCategory(cat)}
              />
              <span>Select All</span>
            </label>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(clientGrouped[cat] || []).map((ln) => {
              const idx = idxToId.indexOf(ln.id);
              const namePrefix = `pick-${idx}`;
              const isSelected = Boolean(selected[ln.id]);
              const currentQty = qtys[ln.id] ?? 0;
              const lineRequests = requestsByLine[ln.id] ?? [];
              const pendingRequest = lineRequests.find((req) => req.status === 'PENDING');
              const approvedSum = lineRequests
                .filter((req) => req.status === 'APPROVED')
                .reduce((sum, req) => sum + req.qty, 0);
              const latestApproval = lineRequests.find((req) => req.status === 'APPROVED');
              const canReviewPending =
                pendingRequest &&
                (pendingRequest.requiresAdmin
                  ? currentRole === 'ADMIN'
                  : REVIEW_ROLES.has(currentRole ?? ''));

              const canShowRequestButton =
                canRequestMore && ln.remaining <= 0 && !pendingRequest;
              const safeMax = Math.max(0, ln.remaining);
              const progressPercent = Math.min(100, Math.round(((ln.alreadyRequested + ln.purchased) / (ln.qtyOrdered + ln.approvedExtra)) * 100)) || 0;

              return (
                <div 
                  key={ln.id} 
                  className={`group relative flex flex-col justify-between overflow-hidden rounded-2xl bg-white shadow-sm ring-1 transition-all hover:shadow-md ${isSelected ? 'ring-2 ring-indigo-600 shadow-indigo-100' : 'ring-gray-900/5'}`}
                >
                  <div className="p-5">
                    {/* Header: Checkbox + Name */}
                    <div className="flex items-start gap-3">
                      <div className="flex h-6 items-center">
                        <input
                          name={`${namePrefix}-include`}
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleLine(ln.id)}
                          className="h-5 w-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <label className="cursor-pointer text-base font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors" onClick={() => toggleLine(ln.id)}>
                          {ln.description}
                        </label>
                        <p className="mt-1 text-xs text-gray-500 font-mono">
                           Total: <span className="font-medium text-gray-700">{ln.qtyOrdered + ln.approvedExtra} {ln.unit}</span>
                        </p>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="mt-4">
                         <div className="flex justify-between text-xs mb-1.5">
                            <span className="text-gray-500">Filled</span>
                            <span className="font-medium text-gray-700">{progressPercent}%</span>
                         </div>
                         <div className="h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
                            <div className="h-full bg-indigo-500 transition-all duration-500" style={{ width: `${progressPercent}%` }}></div>
                         </div>
                    </div>

                    {/* Stats Grid */}
                    <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                        <div className="rounded-md bg-gray-50 p-2 text-center text-gray-600">
                             <div className="font-medium text-gray-900">{ln.alreadyRequested + ln.purchased}</div>
                             <div className="text-[10px] uppercase tracking-wider opacity-70">Used</div>
                        </div>
                        <div className={isSelected ? "rounded-md bg-indigo-50 p-2 text-center text-indigo-700 ring-1 ring-inset ring-indigo-700/10" : "rounded-md bg-gray-50 p-2 text-center text-gray-600"}>
                             <div className="font-medium">{ln.remaining}</div>
                             <div className="text-[10px] uppercase tracking-wider opacity-70">Remaining</div>
                        </div>
                    </div>

                    {/* Pending Requests Alert */}
                    {pendingRequest && (
                      <div className="mt-3 rounded-md bg-amber-50 p-2 text-xs text-amber-800 ring-1 ring-inset ring-amber-600/20">
                          <span className="font-bold">Pending:</span> +{pendingRequest.qty} req by {pendingRequest.requestedByName}
                      </div>
                    )}
                     
                    {/* Input Area */}
                    <div className={`mt-5 transition-all duration-300 ${isSelected ? 'opacity-100' : 'opacity-40 grayscale group-hover:opacity-100 group-hover:grayscale-0'}`}>
                         <div className="relative">
                            <input type="hidden" name={`${namePrefix}-quoteLineId`} value={ln.id} />
                            <ClearableNumberInput
                                name={`${namePrefix}-qty`}
                                type="text"
                                min={0}
                                max={safeMax}
                                step="1"
                                placeholder="Qty"
                                value={Number.isFinite(currentQty) ? Math.ceil(currentQty) : ''}
                                onChange={(e) => onQtyChange(ln.id, e.currentTarget.value, safeMax)}
                                className="block w-full rounded-lg border-0 py-2.5 pl-3 pr-10 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6 disabled:bg-gray-50"
                                allowEmpty
                            />
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                                <span className="text-gray-500 sm:text-sm">{ln.unit}</span>
                            </div>
                         </div>
                    </div>
                  </div>

                  {/* Actions Footer */}
                  {(canShowRequestButton || pendingRequest) && (
                      <div className="bg-gray-50 px-4 py-3 border-t border-gray-100 flex items-center justify-between gap-2">
                        {canShowRequestButton && (
                            <button
                            type="button"
                            className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:underline"
                            onClick={() => openNewRequestModal(ln)}
                            >
                            Request Extra
                            </button>
                        )}
                        {pendingRequest && (
                             canReviewPending ? (
                                <button
                                type="button"
                                className="w-full rounded bg-indigo-600 px-2 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                                onClick={() => openReviewModal(ln, pendingRequest)}
                                >
                                Review Request
                                </button>
                            ) : (
                                <span className="text-[10px] font-medium text-amber-600 uppercase tracking-wide">
                                    Awaiting Approval
                                </span>
                            )
                        )}
                      </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ))}

      {extraModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60 p-4 backdrop-blur-sm transition-opacity">
          <div className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 shadow-2xl transition-all">
            <h3 className="text-lg font-bold text-gray-900">
              {extraModal.mode === 'request' ? 'Request Additional Quantity' : 'Review Quantity Request'}
            </h3>
            <p className="mt-1 text-sm text-gray-500">{extraModal.line.description}</p>
            
            {extraModal.mode === 'request' ? (
              <div className="mt-6 space-y-4">
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-gray-700">Quantity Needed</span>
                  <ClearableNumberInput
                    allowEmpty
                    className="block w-full rounded-lg border-0 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                    value={modalDraft.qty}
                    onChange={(e) => {
                      const value = e.currentTarget.value;
                      setModalDraft((prev) => ({ ...prev, qty: value }));
                    }}
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-gray-700">Reason for Request</span>
                  <textarea
                    className="block w-full rounded-lg border-0 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                    rows={3}
                    placeholder="Why is more needed?"
                    value={modalDraft.reason}
                    onChange={(e) => {
                      const value = e.currentTarget.value;
                      setModalDraft((prev) => ({ ...prev, reason: value }));
                    }}
                  />
                </label>
                <div className="rounded-md bg-blue-50 p-3 text-xs text-blue-700">
                  Note: Requests are subject to approval by the project manager or admin.
                </div>
              </div>
            ) : (
              <div className="mt-6 space-y-4 rounded-xl bg-gray-50 p-4 text-sm">
                <div className="flex justify-between border-b border-gray-200 pb-2">
                   <span className="text-gray-500">Requested Quantity</span>
                   <span className="font-semibold text-gray-900">+{extraModal.request.qty} {extraModal.line.unit ?? ''}</span>
                </div>
                <div className="flex justify-between border-b border-gray-200 pb-2">
                   <span className="text-gray-500">Requested By</span>
                   <span className="font-medium text-gray-900">{extraModal.request.requestedByName}</span>
                </div>
                {extraModal.request.reason && (
                    <div className="pt-1">
                        <span className="block text-xs text-gray-500 mb-1">Reason provided:</span>
<<<<<<< HEAD
                        <p className="text-gray-800 italic">&quot;{extraModal.request.reason}&quot;</p>
=======
                        <p className="text-gray-800 italic">"{extraModal.request.reason}"</p>
>>>>>>> 6ceb169f31dd33949aef05a222ac753c3611dd87
                    </div>
                )}
              </div>
            )}

            {modalError && (
                 <div className="mt-4 rounded-md bg-rose-50 p-3 text-sm text-rose-600 ring-1 ring-inset ring-rose-200">
                    {modalError}
                 </div>
            )}
            
            <div className="mt-8 flex items-center justify-end gap-3">
              <button 
                type="button" 
                className="rounded-lg px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100 transition-colors" 
                onClick={closeModal}
              >
                Cancel
              </button>
              {extraModal.mode === 'request' ? (
                <button
                  type="button"
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={submitExtraRequest}
                  disabled={isSaving}
                >
                  {isSaving ? 'Submitting...' : 'Submit Request'}
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-rose-600 shadow-sm hover:bg-rose-50 disabled:opacity-50"
                    onClick={() => decideExtraRequest(false)}
                    disabled={isSaving}
                  >
                    Reject
                  </button>
                  <button
                    type="button"
                    className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:opacity-50"
                    onClick={() => decideExtraRequest(true)}
                    disabled={isSaving}
                  >
                    Approve
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
