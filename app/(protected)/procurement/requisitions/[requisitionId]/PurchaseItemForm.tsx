

'use client';

import { useState } from 'react';
import QuantityInput from '@/components/QuantityInput';
import { requestItemReview } from './actions'; 

interface Props {
  requisitionId: string;
  itemId: string;
  description: string;
  remainingQty: number;
  approvedUnitPrice: number; // Major units (e.g. 10.50)
  createPurchaseAction: (data: any) => Promise<any>; // Simple type for the passed server action
}

export default function PurchaseItemForm({
  requisitionId,
  itemId,
  remainingQty,
  approvedUnitPrice,
  createPurchaseAction
}: Props) {
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [formData, setFormData] = useState<FormData | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [enteredPrice, setEnteredPrice] = useState(0);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    const unitPrice = Number(fd.get('unitPrice') || 0);
    setEnteredPrice(unitPrice);

    // Initial check: if price is higher than approved, prompt user
    if (approvedUnitPrice > 0 && unitPrice > approvedUnitPrice) {
      setFormData(fd);
      setShowReviewModal(true);
      return;
    }

    // Otherwise proceed with normal creation
    await submitPurchase(fd);
  };

  const submitPurchase = async (fd: FormData) => {
    setIsPending(true);
    try {
        await createPurchaseAction({
            requisitionId,
            requisitionItemId: itemId,
            vendor: String(fd.get('vendor') || ''),
            taxInvoiceNo: String(fd.get('taxInvoiceNo') || ''), // Mapped to Quotation Number
            vendorPhone: String(fd.get('vendorPhone') || ''),
            qty: Number(fd.get('qty') || 0),
            unitPrice: Number(fd.get('unitPrice') || 0),
            date: String(fd.get('date')),
            invoiceUrl: null,
        });
        // Reset form or handle success? 
        // Typically the action revalidates and the item might disappear from "remaining > 0" list if fully bought
    } catch (e) {
        console.error(e);
        alert('Failed to stage item');
    } finally {
        setIsPending(false);
    }
  };

  const handleRequestReview = async () => {
    if (!formData) return;
    setIsPending(true);
    try {
        const unitPrice = Number(formData.get('unitPrice'));
        await requestItemReview(requisitionId, itemId, unitPrice);
        setShowReviewModal(false);
        setFormData(null);
    } catch (e) {
        console.error(e);
        alert('Failed to request review');
    } finally {
        setIsPending(false);
    }
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <>
    <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      <input
        name="vendor"
        placeholder="Vendor"
        className="rounded-md border border-gray-300 bg-gray-50/50 px-2 py-1.5 text-sm focus:border-indigo-500 focus:ring-indigo-500"
        required
      />
      <input
        name="vendorPhone"
        placeholder="Phone (opt)"
        className="rounded-md border border-gray-300 bg-gray-50/50 px-2 py-1.5 text-sm focus:border-indigo-500 focus:ring-indigo-500"
      />
      <input
        name="taxInvoiceNo"
        placeholder="Quotation Number" 
        className="rounded-md border border-gray-300 bg-gray-50/50 px-2 py-1.5 text-sm focus:border-indigo-500 focus:ring-indigo-500"
        required
      />
      <QuantityInput
        name="qty"
        max={remainingQty}
        className="rounded-md border border-gray-300 bg-gray-50/50 px-2 py-1.5 text-sm focus:border-indigo-500 focus:ring-indigo-500"
      />
      <input
        name="unitPrice"
        type="number"
        step="0.01"
        min="0"
        placeholder="Unit Price"
        className="rounded-md border border-gray-300 bg-gray-50/50 px-2 py-1.5 text-sm focus:border-indigo-500 focus:ring-indigo-500"
        required
      />
      <input
        name="date"
        type="date"
        readOnly
        className="rounded-md border border-gray-300 bg-gray-100 px-2 py-1.5 text-sm text-gray-500 cursor-not-allowed"
        defaultValue={today}
      />
      <div className="mt-1 col-span-1 sm:col-span-2">
        <button 
            type="submit" 
            disabled={isPending}
            className="w-full rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50"
        >
          {isPending ? 'Processing...' : 'Stage for PO'}
        </button>
      </div>
    </form>

    {showReviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-md overflow-hidden rounded-xl bg-white shadow-2xl ring-1 ring-gray-900/5">
                <div className="p-6">
                    <h3 className="text-lg font-semibold leading-6 text-gray-900">Price Exceeds Approved Amount</h3>
                    <div className="mt-2">
                        <p className="text-sm text-gray-500">
                            The entered unit price (<span className="font-semibold text-gray-900">${enteredPrice.toFixed(2)}</span>) is higher than the approved amount (<span className="font-semibold text-gray-900">${approvedUnitPrice.toFixed(2)}</span>).
                        </p>
                        <p className="mt-3 text-sm text-gray-500">
                            Do you want to request a review for this item? This will <strong className="text-gray-900">remove it from the current purchase list</strong> and send it to Senior Procurement for approval with the new price.
                        </p>
                    </div>
                </div>
                <div className="bg-gray-50 px-6 py-4 flex flex-row-reverse gap-2">
                    <button
                        type="button"
                        onClick={handleRequestReview}
                        disabled={isPending}
                        className="inline-flex w-full justify-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 sm:w-auto"
                    >
                        {isPending ? 'Sending...' : 'Request Review'}
                    </button>
                    <button
                        type="button"
                        onClick={() => setShowReviewModal(false)}
                        className="inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:w-auto"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    )}
    </>
  );
}
