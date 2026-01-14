'use client';

import { useTransition, useState } from 'react';
import clsx from 'clsx';

import { updateLineItem } from '@/app/(protected)/quotes/[quoteId]/actions';

export default function LineRateEditor({
  quoteId,
  lineId,
  defaultRate,
  defaultQuantity,
  className,
  isNegotiationPending = false,
}: {
  quoteId: string;
  lineId: string;
  defaultRate: number;
  defaultQuantity: number;
  className?: string;
  isNegotiationPending?: boolean;
}) {
  const [rate, setRate] = useState<string>(defaultRate.toFixed(2));
  const [qty, setQty] = useState<string>(defaultQuantity.toString());
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  
  // If negotiation is pending, we default to edit mode. Otherwise, it's view-only until clicked.
  const [isEditing, setIsEditing] = useState(isNegotiationPending);

  if (!isEditing) {
    return (
      <div className={clsx('flex items-center justify-end gap-2', className)}>
        <span className="text-gray-900 dark:text-white font-medium">
          {Number(rate).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
        <button
          type="button"
          onClick={() => setIsEditing(true)}
          className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800"
          title="Edit Item"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
            <path d="m2.695 14.762-1.262 3.155a.5.5 0 0 0 .65.65l3.155-1.262a4 4 0 0 0 1.343-.886L17.5 5.501a2.121 2.121 0 0 0-3-3L3.58 13.419a4 4 0 0 0-.885 1.343Z" />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <div className={clsx('flex flex-col items-end gap-1', className)}>
      <form
        action={(fd: FormData) => {
          const rawRate = fd.get('rate');
          const rawQty = fd.get('quantity');
          const rateVal = typeof rawRate === 'string' ? Number(rawRate) : Number(rawRate ?? 0);
          const qtyVal = typeof rawQty === 'string' ? Number(rawQty) : Number(rawQty ?? 0);

          if (!Number.isFinite(rateVal) || rateVal < 0) {
            setError('Enter a valid rate');
            setFeedback(null);
            return;
          }
          if (!Number.isFinite(qtyVal) || qtyVal <= 0) {
            setError('Enter a valid quantity');
            setFeedback(null);
            return;
          }

          startTransition(() => {
            setError(null);
            setFeedback(null);
            updateLineItem(quoteId, lineId, rateVal, qtyVal)
              .then((result) => {
                if (!result?.ok) {
                  setError(result?.error ?? 'Unable to update item');
                  return;
                }
                setRate(rateVal.toFixed(2));
                setQty(qtyVal.toString());
                setFeedback('Item updated');
                // Optional: close editing on success if it wasn't a pending item? 
                // Leaving it open for now as they might want to adjust again.
                // But for non-pending items, maybe close?
                if (!isNegotiationPending) {
                   setIsEditing(false);
                }
              })
              .catch((err) => {
                setError(err instanceof Error ? err.message : 'Unable to update item');
              });
          });
        }}
        className="flex items-center justify-end gap-2"
      >
        <div className="flex flex-col">
          <label className="text-[10px] text-gray-500 uppercase font-bold text-left px-1">Qty</label>
          <input
            name="quantity"
            type="number"
            step="1"
            min="1"
            value={qty}
            onChange={(e) => {
              setQty(e.target.value);
              setError(null);
              setFeedback(null);
            }}
            className="w-16 rounded border border-gray-300 px-2 py-1 text-right shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-60 text-xs"
            disabled={isPending}
          />
        </div>
        <div className="flex flex-col">
          <label className="text-[10px] text-gray-500 uppercase font-bold text-left px-1">Rate</label>
          <input
            name="rate"
            type="number"
            step="0.01"
            min="0"
            inputMode="decimal"
            value={rate}
            onChange={(e) => {
              setRate(e.target.value);
              setError(null);
              setFeedback(null);
            }}
            className="w-24 rounded border border-gray-300 px-2 py-1 text-right shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-60 text-xs"
            disabled={isPending}
          />
        </div>
        <div className="flex flex-col gap-1">
            <button
            type="submit"
            disabled={isPending}
            className="inline-flex items-center justify-center gap-1 rounded bg-barmlo-blue px-2 py-1 text-xs font-semibold text-white shadow-sm transition hover:bg-barmlo-blue/90 disabled:cursor-not-allowed disabled:opacity-60 h-[26px] mt-[16px]"
            >
            {isPending ? (
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/70 border-t-transparent" />
            ) : (
                'Save'
            )}
            </button>
             {!isNegotiationPending && (
                <button 
                    type="button" 
                    onClick={() => setIsEditing(false)}
                    className="text-[10px] text-gray-400 hover:text-gray-600 underline"
                >
                    Cancel
                </button>
            )}
        </div>
      </form>
      {error && <p className="text-[10px] text-red-600">{error}</p>}
      {feedback && !error && <p className="text-[10px] text-emerald-600">{feedback}</p>}
    </div>
  );
}
