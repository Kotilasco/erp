
// app/(protected)/procurement/purchase-orders/[poId]/page.tsx
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { placeOrder, receiveGoods } from '../actions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import VerifyPoGrnsForm from '../VerifyPoGrnsForm';
import SubmitButton from '@/components/SubmitButton';
import Link from 'next/link';
import Money from '@/components/Money';
import { ArrowLeftIcon, ClipboardDocumentListIcon, ShoppingBagIcon, UserIcon, PhoneIcon, DocumentTextIcon, TruckIcon } from '@heroicons/react/24/outline';

function POStatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    DRAFT: 'bg-gray-100 text-gray-800',
    SUBMITTED: 'bg-blue-100 text-blue-800',
    APPROVED: 'bg-emerald-100 text-emerald-800',
    REJECTED: 'bg-red-100 text-red-800',
    PURCHASED: 'bg-purple-100 text-purple-800',
    PARTIAL: 'bg-orange-100 text-orange-800',
    RECEIVED: 'bg-green-100 text-green-800',
    COMPLETE: 'bg-green-100 text-green-800',
  };
  return (
    <span className={`inline-flex items-center rounded px-2.5 py-0.5 text-xs font-medium ${colors[status] || 'bg-gray-100 text-gray-800'}`}>
      {status}
    </span>
  );
}

export default async function POPage(props: { params: Promise<{ poId: string }> }) {
  const params = await props.params;
  const { poId } = params;
  const me = await getCurrentUser();
  if (!me) return <div className="p-6">Auth required.</div>;

  const po = await prisma.purchaseOrder.findUnique({
    where: { id: poId },
    include: { 
      items: true, 
      requisition: { include: { project: true } },
      goodsReceivedNotes: { include: { items: true }, orderBy: { createdAt: 'desc' } },
      purchases: true, // Fetch staged items to correlate
      createdBy: { select: { name: true, email: true } },
      decidedBy: { select: { name: true, email: true } },
    },
  });
  if (!po) return <div className="p-6">PO not found.</div>;

  const isProcurement = me.role === 'PROCUREMENT' || me.role === 'SENIOR_PROCUREMENT' || me.role === 'ADMIN';
  const isAccounts = me.role === 'SALES_ACCOUNTS' || (me.role as string).startsWith('ACCOUNT') || me.role === 'ADMIN';
  const isSecurity = me.role === 'SECURITY' || me.role === 'ADMIN';

  // Calculate received quantities (Verified 'Accepted' + Pending 'Delivered')
  const receivedByItem = new Map<string, number>();
  po.goodsReceivedNotes.forEach((grn) => {
    grn.items.forEach((grnItem) => {
      if (grnItem.poItemId) {
        const current = receivedByItem.get(grnItem.poItemId) ?? 0;
        // If Pending, we count what was Delivered (occupying the slot)
        // If Verified, we count what was Accepted (rejected items are freed up)
        const used = grn.status === 'PENDING' ? grnItem.qtyDelivered : grnItem.qtyAccepted;
        receivedByItem.set(grnItem.poItemId, current + used);
      }
    });
  });

  const isPOFullyReceived = po.items.every((item) => {
    const used = receivedByItem.get(item.id) ?? 0;
    return used >= item.qty;
  });

  const pendingGrnItems =
    isAccounts
      ? po.goodsReceivedNotes
          .filter((g) => g.status === 'PENDING')
          .flatMap((grn) =>
            grn.items.map((item) => ({
              grnId: grn.id,
              grnItemId: item.id,
              description: item.description,
              qtyDelivered: item.qtyDelivered,
              priceMinor: item.priceMinor ? Number(item.priceMinor) : 0,
              varianceMinor: item.varianceMinor ? Number(item.varianceMinor) : 0,
              receiptNumber: grn.receiptNumber || 'N/A',
              vendorName: grn.vendorName || 'N/A',
              receivedAt: grn.receivedAt ? grn.receivedAt.toISOString() : '',
            })),
          )
      : [];

  const heading = isAccounts ? 'Goods Approvals' : isSecurity ? 'Goods Delivery Note' : 'Purchase Order';

  return (
    <div className="min-h-screen bg-gray-50/50 px-4 py-8">
      <div className="mx-auto w-full space-y-6">
        <Card className="mb-8 overflow-hidden rounded-2xl border-0 bg-white shadow-xl ring-1 ring-gray-900/5">
            <div className="border-b border-gray-100 bg-gradient-to-r from-gray-50 via-white to-gray-50 py-8 text-center">
                <div className="flex flex-col items-center justify-center gap-2">
                    <div className="rounded-full bg-indigo-50 p-3 ring-1 ring-indigo-500/10">
                        <ShoppingBagIcon className="h-8 w-8 text-indigo-600" />
                    </div>
                    <h1 className="text-3xl font-black uppercase tracking-tight text-gray-900 sm:text-4xl">
                        {heading}
                    </h1>
                    <div className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm text-gray-500">
                         <span className="font-mono font-bold text-indigo-600">#{po.id.slice(0, 8).toUpperCase()}</span>
                         <span className="text-gray-300">|</span>
                         <span className="font-medium text-gray-900">{po.vendor || 'Vendor Pending'}</span>
                         <span className="text-gray-300">|</span>
                         <span>
                            Project: <span className="font-medium text-gray-900">{po.requisition?.project?.projectNumber || po.requisition?.projectId?.slice(0, 8) || 'N/A'}</span>
                         </span>
                    </div>
                     <div className="mt-4">
                        <POStatusBadge status={po.status} />
                     </div>
                </div>
            </div>
             <div className="flex items-center justify-between bg-gray-50/50 px-6 py-3">
                <div className="text-sm text-gray-500">
                </div>
                 <div className="flex gap-3">
                    <Link
                      href="/procurement/purchase-orders"
                      className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm transition-all hover:bg-gray-50 hover:text-gray-900"
                    >
                      <ArrowLeftIcon className="h-4 w-4" />
                      Back to POs
                    </Link>
                 </div>
             </div>
        </Card>

        {isProcurement && po.status === 'APPROVED' && (
          <Card className="rounded-xl border border-gray-200 bg-white shadow-sm">
            <CardHeader className="border-b border-gray-200 bg-gray-50/60 px-6 py-4">
              <CardTitle className="text-sm font-semibold uppercase tracking-wide text-gray-800">
                Place Order
              </CardTitle>
              <CardDescription className="text-sm text-gray-500">
                Mark this PO as purchased after placing the order with the vendor.
              </CardDescription>
            </CardHeader>
            <CardContent className="px-6 py-4">
              <form
                action={async () => {
                  'use server';
                  await placeOrder(poId, me.id!);
                  revalidatePath(`/procurement/purchase-orders/${poId}`);
                }}
              >
                <SubmitButton className="inline-flex items-center justify-center gap-2 rounded-lg bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-orange-700 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2">
                  Place Order (Mark as PURCHASED)
                </SubmitButton>
              </form>
            </CardContent>
          </Card>
        )}

        {isSecurity && !isPOFullyReceived && (
          <Card className="rounded-2xl border border-emerald-200 bg-white shadow-md">
            <CardHeader className="flex flex-col gap-1 border-b border-emerald-100/60 bg-emerald-50/60 px-6 py-4">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-emerald-800">
                <span>Receive Goods</span>
              </CardTitle>
              <CardDescription className="text-sm text-emerald-700">
                Record the delivery of items. Verification will be done by Accounts.
              </CardDescription>
            </CardHeader>
            <CardContent className="px-6 py-6">
              <form
                action={async (fd) => {
                  'use server';

                  const rawItems = po.items
                    .map((item) => {
                      const qty = Number(fd.get(`delivered-${item.id}`) || 0);
                      return {
                        poItemId: item.id,
                        qtyDelivered: qty,
                        vendorName: String(fd.get(`vendor-${item.id}`) || '').trim(),
                        receiptNumber: String(fd.get(`receipt-${item.id}`) || '').trim(),
                        vendorPhone: String(fd.get(`phone-${item.id}`) || '').trim(),
                        unitPriceMajor: Number(fd.get(`price-${item.id}`) || 0),
                      };
                    })
                    .filter((i) => i.qtyDelivered > 0);

                  if (rawItems.length === 0) throw new Error('Enter at least one delivery quantity');

                  for (const item of rawItems) {
                    if (!item.vendorName) throw new Error('Vendor Name is required for all delivered items');
                    if (!item.receiptNumber) throw new Error('Receipt Number is required for all delivered items');
                  }

                  const details = {
                    receivedAt: String(fd.get('receivedAt') || new Date().toISOString()),
                    note: String(fd.get('note') || ''),
                  };

                  await receiveGoods(poId, rawItems, me.id!, details);
                  revalidatePath(`/procurement/purchase-orders/${poId}`);
                }}
                className="space-y-6"
              >
                <div className="grid grid-cols-1 gap-6 rounded-xl border border-emerald-100 bg-emerald-50/40 p-6 shadow-sm">
                  <div className="flex items-center gap-2 mb-2 border-b border-emerald-200 pb-2">
                     <TruckIcon className="h-5 w-5 text-emerald-700" />
                     <h3 className="text-lg font-bold text-emerald-800">Receive Goods</h3>
                  </div>
                  <div className="space-y-3 max-w-xs">
                    <label className="text-xs font-semibold uppercase tracking-wider text-emerald-900">
                      Date Received
                    </label>
                    <input
                      name="receivedAt"
                      type="date"
                      defaultValue={new Date().toISOString().split('T')[0]}
                      className="flex h-10 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-all hover:border-emerald-300 shadow-sm"
                      required
                    />
                  </div>
                </div>

                <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm ring-1 ring-gray-900/5">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="border-b bg-gray-50/80">
                        <tr>
                          <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-600 min-w-[200px]">
                            Item Description
                          </th>
                          <th className="px-4 py-4 text-right text-xs font-bold uppercase tracking-wider text-gray-600 w-[100px]">
                            Ordered
                          </th>
                          <th className="px-4 py-4 text-right text-xs font-bold uppercase tracking-wider text-gray-600 w-[100px]">
                            Used
                          </th>
                          <th className="px-4 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-600 min-w-[180px]">
                            <div className="flex items-center gap-1">
                                <UserIcon className="h-4 w-4" />
                                Supplier
                            </div>
                          </th>
                          <th className="px-4 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-600 min-w-[140px]">
                            <div className="flex items-center gap-1">
                                <PhoneIcon className="h-4 w-4" />
                                Contact
                            </div>
                          </th>
                          <th className="px-4 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-600 min-w-[140px]">
                            <div className="flex items-center gap-1">
                                <DocumentTextIcon className="h-4 w-4" />
                                # Purchase Order
                            </div>
                          </th>
                          <th className="px-4 py-4 text-right text-xs font-bold uppercase tracking-wider text-emerald-700 min-w-[120px]">
                            Qty In
                          </th>
                          <th className="px-4 py-4 text-right text-xs font-bold uppercase tracking-wider text-gray-600 min-w-[120px]">
                            Unit Price
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {po.items.map((item) => {
                          const used = receivedByItem.get(item.id) ?? 0;
                          const remaining = Math.max(0, item.qty - used);
                          const isComplete = remaining <= 0;

                          const staged = po.purchases.find(
                            (p) => p.requisitionItemId === item.requisitionItemId,
                          );

                          const prefillVendor = staged?.vendor ?? '';
                          const prefillPhone = staged?.vendorPhone ?? '';

                          return (
                            <tr
                              key={item.id}
                              className={`group transition-colors hover:bg-slate-50 ${isComplete ? 'bg-gray-50/50' : ''}`}
                            >
                              <td className="px-6 py-4">
                                <div className="font-medium text-gray-900">{item.description}</div>
                                {isComplete && (
                                  <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-1 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20">
                                    <ShoppingBagIcon className="h-3 w-3" />
                                    Order Complete
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-4 text-right text-gray-600 font-medium">
                                {item.qty} {item.unit ?? ''}
                              </td>
                              <td className="px-4 py-4 text-right text-gray-500">{used}</td>
                              <td className="px-4 py-4">
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <UserIcon className="h-4 w-4 text-gray-400" />
                                    </div>
                                    <input
                                      name={`vendor-${item.id}`}
                                      disabled={isComplete}
                                      readOnly
                                      defaultValue={!isComplete ? prefillVendor : ''}
                                      className="h-10 w-full rounded-lg border border-gray-200 bg-gray-50 pl-10 px-3 text-sm text-gray-600 cursor-not-allowed shadow-sm"
                                      placeholder={isComplete ? '-' : 'Supplier'}
                                    />
                                </div>
                              </td>
                              <td className="px-4 py-4">
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <PhoneIcon className="h-4 w-4 text-gray-400" />
                                    </div>
                                    <input
                                      name={`phone-${item.id}`}
                                      disabled={isComplete}
                                      readOnly
                                      defaultValue={!isComplete ? prefillPhone : ''}
                                      className="h-10 w-full rounded-lg border border-gray-200 bg-gray-50 pl-10 px-3 text-sm text-gray-600 cursor-not-allowed shadow-sm"
                                      placeholder={isComplete ? '-' : 'Phone'}
                                    />
                                </div>
                              </td>
                              <td className="px-4 py-4">
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <DocumentTextIcon className="h-4 w-4 text-gray-400" />
                                    </div>
                                    <input
                                      name={`receipt-${item.id}`}
                                      disabled={isComplete}
                                      readOnly
                                      defaultValue={po.id.slice(0, 8).toUpperCase()}
                                      className="h-10 w-full rounded-lg border border-gray-200 bg-gray-50 pl-10 px-3 text-sm text-gray-600 cursor-not-allowed shadow-sm"
                                    />
                                </div>
                              </td>
                              <td className="px-4 py-4 text-right">
                                <div className="relative">
                                  <input
                                    name={`delivered-${item.id}`}
                                    type="number"
                                    step="0.01"
                                    min={0}
                                    max={remaining > 0 ? remaining : undefined}
                                    placeholder={isComplete ? 'Done' : '0'}
                                    disabled={isComplete}
                                    className={`h-10 w-full rounded-lg border bg-white px-3 text-right text-sm font-medium outline-none transition-all focus:ring-2 disabled:bg-gray-50 disabled:text-gray-400 shadow-sm ${
                                      remaining > 0
                                        ? 'border-emerald-200 text-emerald-700 placeholder:text-emerald-200 focus:border-emerald-500 focus:ring-emerald-500'
                                        : 'border-gray-200 text-gray-400'
                                    }`}
                                  />
                                </div>
                              </td>
                              <td className="px-4 py-4 text-right">
                                <div className="relative">
                                  <span
                                    className={`absolute left-3 top-1/2 -translate-y-1/2 text-xs ${
                                      isComplete ? 'text-gray-300' : 'text-gray-400'
                                    }`}
                                  >
                                    $
                                  </span>
                                  <input
                                    name={`price-${item.id}`}
                                    type="number"
                                    step="0.01"
                                    placeholder="0.00"
                                    disabled={isComplete}
                                    className="h-10 w-full rounded-lg border border-gray-200 bg-white pl-6 pr-3 text-right text-sm outline-none transition-all focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 disabled:bg-gray-50 disabled:text-gray-400 shadow-sm"
                                  />
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="space-y-3 p-1">
                  <label className="text-xs font-semibold uppercase tracking-wider text-gray-700">
                    Delivery Notes (Optional)
                  </label>
                  <textarea
                    name="note"
                    placeholder="Any additional comments about the delivery condition, weather, etc..."
                    className="flex min-h-[80px] w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 transition-all"
                  />
                </div>
                <div className="pt-6">
                  <SubmitButton className="inline-flex h-16 w-full items-center justify-center rounded-xl bg-emerald-600 px-8 text-lg font-bold uppercase tracking-wide text-white shadow-xl shadow-emerald-900/20 transition-all hover:bg-emerald-700 hover:scale-[1.01] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 disabled:pointer-events-none disabled:opacity-50">
                    Receive
                  </SubmitButton>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {isSecurity && isPOFullyReceived && (
          <Card className="rounded-xl border border-green-200 bg-green-50/70">
            <CardHeader className="px-6 py-4">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-green-800">
                <span>✅ Order Complete</span>
              </CardTitle>
              <CardDescription className="mt-1 text-sm text-green-700">
                All items in this Purchase Order have been fully received and/or verified.
              </CardDescription>
            </CardHeader>
          </Card>
        )}

        {isAccounts && pendingGrnItems.length > 0 && (
          <div className="space-y-4">
            <VerifyPoGrnsForm poId={params.poId} verifierId={me.id!} items={pendingGrnItems} />
          </div>
        )}

        {!isAccounts && po.goodsReceivedNotes.length > 0 && (
          <Card className="rounded-xl border border-gray-200 bg-white shadow-sm">
            <CardHeader className="border-b bg-gray-50 px-4 py-3">
              <CardTitle className="text-sm font-semibold uppercase tracking-wide text-gray-700">
                Goods Received Notes
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="space-y-4">
                {po.goodsReceivedNotes.map((grn) => (
                  <div
                    key={grn.id}
                    className="rounded-lg border border-gray-200 bg-gray-50/50 p-4"
                  >
                    <div className="mb-2 flex items-start justify-between">
                      <div>
                        <div className="text-sm font-semibold text-gray-900">
                          GRN {grn.id.slice(0, 8)}
                        </div>
                        <div className="text-xs text-gray-500">
                          Received:{' '}
                          {grn.receivedAt
                            ? new Date(grn.receivedAt).toLocaleString()
                            : '-'}
                        </div>
                        <div className="mt-1 text-xs text-gray-500">
                          Vendor:{' '}
                          <span className="font-medium text-gray-700">
                            {grn.vendorName || 'N/A'}
                          </span>{' '}
                          • Phone:{' '}
                          <span className="font-medium text-gray-700">
                            {grn.vendorPhone || 'N/A'}
                          </span>{' '}
                          • Receipt:{' '}
                          <span className="font-medium text-gray-700">
                            {grn.receiptNumber || 'N/A'}
                          </span>
                        </div>
                      </div>
                      <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-emerald-800">
                        {grn.status}
                      </span>
                    </div>
                    {grn.note && (
                      <p className="mb-2 text-sm text-gray-600">{grn.note}</p>
                    )}
                    <div className="mt-2 overflow-hidden rounded-md border border-gray-200 bg-white">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-2 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                              Item
                            </th>
                            <th className="px-2 py-2 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
                              Delivered
                            </th>
                            <th className="px-2 py-2 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
                              Price
                            </th>
                            <th className="px-2 py-2 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
                              P&amp;L
                            </th>
                            <th className="px-2 py-2 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
                              Accepted
                            </th>
                            <th className="px-2 py-2 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
                              Rejected
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {grn.items.map((item) => (
                            <tr key={item.id} className="border-t">
                              <td className="px-2 py-1">{item.description}</td>
                              <td className="px-2 py-1 text-right">
                                {item.qtyDelivered}
                              </td>
                              <td className="px-2 py-1 text-right">
                                {item.priceMinor ? <Money minor={item.priceMinor} /> : '-'}
                              </td>
                              <td
                                className={`px-2 py-1 text-right font-medium ${
                                  item.varianceMinor &&
                                  Number(item.varianceMinor) < 0
                                    ? 'text-red-600'
                                    : 'text-green-600'
                                }`}
                              >
                                {item.varianceMinor ? (
                                  <Money minor={item.varianceMinor} />
                                ) : (
                                  '-'
                                )}
                              </td>
                              <td className="px-2 py-1 text-right">
                                {item.qtyAccepted}
                              </td>
                              <td className="px-2 py-1 text-right">
                                {item.qtyRejected}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
