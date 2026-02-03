import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { placeOrder, receiveGoods } from '../actions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import SubmitButton from '@/components/SubmitButton';
import Link from 'next/link';
import Money from '@/components/Money';
import { ArrowLeftIcon, PaperAirplaneIcon } from '@heroicons/react/24/outline';
import PurchaseOrderHeader from '@/components/PurchaseOrderHeader';
import PrintButton from '@/components/PrintButton';

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
      items: { include: { quoteLine: { include: { product: true } } } }, 
      requisition: { 
        include: { 
          project: { 
            include: { 
              quote: { 
                include: { customer: true } 
              } 
            } 
          } 
        } 
      },
      project: {
        include: {
          quote: {
            include: { customer: true }
          }
        }
      },
      goodsReceivedNotes: { include: { items: true }, orderBy: { createdAt: 'desc' } },
      purchases: true, 
      createdBy: { select: { name: true, email: true } },
      decidedBy: { select: { name: true, email: true } },
    },
  });
  if (!po) return <div className="p-6">PO not found.</div>;

  const isProcurement = me.role === 'PROCUREMENT' || me.role === 'SENIOR_PROCUREMENT' || me.role === 'ADMIN';
  const isAccounts = me.role === 'SALES_ACCOUNTS' || (me.role as string).startsWith('ACCOUNT') || me.role === 'ADMIN';
  const isSecurity = me.role === 'SECURITY' || me.role === 'ADMIN';
  const isSecurityUser = me.role === 'SECURITY';

  const receivedByItem = new Map<string, number>();
  po.goodsReceivedNotes.forEach((grn) => {
    grn.items.forEach((grnItem) => {
      if (grnItem.poItemId) {
        const current = receivedByItem.get(grnItem.poItemId) ?? 0;
        const used = grn.status === 'PENDING' ? grnItem.qtyDelivered : grnItem.qtyAccepted;
        receivedByItem.set(grnItem.poItemId, current + used);
      }
    });
  });

  const isPOFullyReceived = po.items.every((item) => {
    const used = receivedByItem.get(item.id) ?? 0;
    return used >= item.qty;
  });

  const project = po.requisition?.project || po.project;
  const customer = project?.quote?.customer;
  const displayCustomer = customer || { displayName: 'Unknown Customer', city: '', email: '', phone: '' };

  const vendorName = po.vendor || 'Unknown Vendor';
  const vendorPhone = po.purchases?.[0]?.vendorPhone || '';
  const vendorDisplay = {
    displayName: vendorName,
    phone: vendorPhone,
    email: '', 
    city: '',
    addressJson: null
  };

  return (
    <div className="min-h-screen bg-gray-50/50 px-4 py-8 print:bg-white print:p-0">
      <div className="mx-auto w-full max-w-[90rem] space-y-6 print:max-w-none">
        
        {/* Navigation and Toolbar */}
        <div className="flex items-center justify-between print:hidden">
            <Link
              href="/procurement/purchase-orders"
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm transition-all hover:bg-gray-50 hover:text-gray-900"
            >
              <ArrowLeftIcon className="h-4 w-4" />
              Back to POs
            </Link>
            <div className="flex items-center gap-3">
               <POStatusBadge status={po.status} />
               <PrintButton />
            </div>
        </div>

        {/* Main PO Document */}
        <div className="bg-white p-8 shadow-sm rounded-xl border border-gray-200 print:shadow-none print:border-none print:p-0">
            <PurchaseOrderHeader 
              customer={vendorDisplay}
              project={project}
              requisition={{
                id: po.id,
                createdAt: po.createdAt,
                submittedBy: po.createdBy
              }}
              title={isSecurityUser ? "Goods Delivery Note" : "Purchase Order"}
              recipientLabel="Vendor"
              recipientIdLabel="Vendor Ref"
              recipientId={po.supplierId || po.vendor}
            />

            {isSecurityUser && po.goodsReceivedNotes.length > 0 && (
              <div className="mt-8">
                <h2 className="text-lg font-bold text-gray-900 mb-4 uppercase border-b pb-2">Goods Delivery Note</h2>
                
                <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="rounded-lg border border-gray-200 p-4">
                    <div className="grid grid-cols-2 border-b border-gray-200">
                      <div className="p-2 bg-gray-50 text-xs font-bold uppercase tracking-wider text-gray-600 border-r border-gray-200">Supplier</div>
                      <div className="p-2 bg-gray-50 text-xs font-bold uppercase tracking-wider text-gray-600">Contact</div>
                    </div>
                    <div className="grid grid-cols-2">
                      <div className="p-2 text-sm text-gray-900">{po.goodsReceivedNotes[0].vendorName || vendorName}</div>
                      <div className="p-2 text-sm text-gray-900">{po.goodsReceivedNotes[0].vendorPhone || vendorPhone || 'N/A'}</div>
                    </div>
                  </div>
                  <div className="rounded-lg border border-gray-200 p-4">
                    <div className="grid grid-cols-2 border-b border-gray-200">
                      <div className="p-2 bg-gray-50 text-xs font-bold uppercase tracking-wider text-gray-600 border-r border-gray-200">Receipt</div>
                      <div className="p-2 bg-gray-50 text-xs font-bold uppercase tracking-wider text-gray-600">Received Date</div>
                    </div>
                    <div className="grid grid-cols-2">
                      <div className="p-2 text-sm text-gray-900">{po.goodsReceivedNotes[0].receiptNumber || 'N/A'}</div>
                      <div className="p-2 text-sm text-gray-900">{po.goodsReceivedNotes[0].receivedAt ? new Date(po.goodsReceivedNotes[0].receivedAt).toLocaleString() : 'N/A'}</div>
                    </div>
                  </div>
                </div>

                <table className="min-w-full divide-y divide-gray-300">
                  <thead>
                    <tr>
                      <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-0">Item</th>
                      <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Unit</th>
                      <th scope="col" className="px-3 py-3.5 text-right text-sm font-semibold text-gray-900">Qty Delivered</th>
                      <th scope="col" className="px-3 py-3.5 text-right text-sm font-semibold text-gray-900">Unit Price</th>
                      <th scope="col" className="px-3 py-3.5 text-right text-sm font-semibold text-gray-900">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {po.goodsReceivedNotes[0].items.map((gi) => {
                      const unitPriceMinor = gi.priceMinor ?? 0n;
                      const amountMinor = BigInt(Math.round(Number(unitPriceMinor) * gi.qtyDelivered));
                      return (
                        <tr key={gi.id}>
                          <td className="py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-0">{gi.description}</td>
                          <td className="px-3 py-4 text-left text-sm text-gray-500">{gi.unit || ''}</td>
                          <td className="px-3 py-4 text-right text-sm text-gray-500">{gi.qtyDelivered}</td>
                          <td className="px-3 py-4 text-right text-sm text-gray-500"><Money amount={unitPriceMinor} /></td>
                          <td className="px-3 py-4 text-right text-sm text-gray-900 font-semibold"><Money amount={amountMinor} /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr>
                      <th scope="row" colSpan={4} className="hidden pl-4 pr-3 pt-6 text-right text-sm font-semibold text-gray-900 sm:table-cell sm:pl-0">
                        Total
                      </th>
                      <td className="pl-3 pr-4 pt-6 text-right text-sm font-semibold text-gray-900 sm:pr-0">
                        <Money amount={po.goodsReceivedNotes[0].items.reduce((sum, gi) => sum + BigInt(Math.round(Number(gi.priceMinor ?? 0n) * gi.qtyDelivered)), 0n)} />
                      </td>
                    </tr>
                  </tfoot>
                </table>

                {po.goodsReceivedNotes[0].note && (
                  <div className="mt-6 border-t pt-4">
                    <h3 className="text-sm font-semibold text-gray-900">Delivery Note:</h3>
                    <p className="mt-1 text-sm text-gray-600 whitespace-pre-wrap">{po.goodsReceivedNotes[0].note}</p>
                  </div>
                )}
              </div>
            )}

            {!isSecurityUser && (
            <div className="mt-8">
              <h2 className="text-lg font-bold text-gray-900 mb-4 uppercase border-b pb-2">Order Items</h2>
              <table className="min-w-full divide-y divide-gray-300">
                <thead>
                  <tr>
                    <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-0">
                      Description
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-right text-sm font-semibold text-gray-900">
                      Qty
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-right text-sm font-semibold text-gray-900">
                      Unit Price
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-right text-sm font-semibold text-gray-900">
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {po.items.map((item) => (
                    <tr key={item.id}>
                      <td className="py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-0">
                        {item.description}
                        {item.quoteLine?.product?.sku && (
                          <span className="block font-normal text-gray-500 text-xs">SKU: {item.quoteLine.product.sku}</span>
                        )}
                      </td>
                      <td className="px-3 py-4 text-right text-sm text-gray-500">
                        {item.qty} {item.unit}
                      </td>
                      <td className="px-3 py-4 text-right text-sm text-gray-500">
                        <Money amount={item.unitPriceMinor} />
                      </td>
                      <td className="px-3 py-4 text-right text-sm text-gray-500">
                        <Money amount={item.totalMinor} />
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <th scope="row" colSpan={3} className="hidden pl-4 pr-3 pt-6 text-right text-sm font-semibold text-gray-900 sm:table-cell sm:pl-0">
                      Total
                    </th>
                    <td className="pl-3 pr-4 pt-6 text-right text-sm font-semibold text-gray-900 sm:pr-0">
                      <Money amount={po.totalMinor > 0n ? po.totalMinor : po.requestedMinor} />
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
            )}

            {po.note && (
                <div className="mt-8 border-t pt-4">
                    <h3 className="text-sm font-semibold text-gray-900">Notes:</h3>
                    <p className="mt-1 text-sm text-gray-600 whitespace-pre-wrap">{po.note}</p>
                </div>
            )}
        </div>

        {/* Action Cards (Hidden in Print) */}
        <div className="space-y-6 print:hidden">
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
                    {/* Submit Button */}
                    <div className="flex justify-end pt-6 border-t border-gray-100">
                        <SubmitButton className="inline-flex items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-green-700 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2">
                            <PaperAirplaneIcon className="h-5 w-5" />
                            Submit Order
                        </SubmitButton>
                    </div>
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
                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                        <div>
                        <label htmlFor="receivedAt" className="block text-base font-semibold text-gray-700 mb-1">Received Date</label>
                        <input type="datetime-local" name="receivedAt" id="receivedAt" defaultValue={new Date().toISOString().slice(0, 16)} className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 text-base py-3 px-4" />
                        </div>
                        <div>
                        <label htmlFor="note" className="block text-base font-semibold text-gray-700 mb-1">Note</label>
                        <input type="text" name="note" id="note" className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 text-base py-3 px-4" />
                        </div>
                    </div>

                    <div className="border-t border-gray-200 pt-4">
                        <h3 className="text-sm font-medium text-gray-900 mb-4">Items to Receive</h3>
                        
                        {isSecurityUser ? (
                          <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
                            <table className="min-w-full divide-y divide-gray-300">
                              <thead className="bg-gray-50">
                                <tr>
                                  <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">Item</th>
                                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Supplier</th>
                                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Contact</th>
                                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Quantity</th>
                                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Price</th>
                                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Receipt</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-200 bg-white">
                                {po.items.map((item) => (
                                  <tr key={item.id}>
                                    <td className="py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">
                                      {item.description}
                                      <div className="mt-1 text-xs text-gray-500">Ordered: {item.qty} {item.unit}</div>
                                    </td>
                                    <td className="px-3 py-4 text-sm text-gray-500 align-top space-y-3">
                                      <input type="text" name={`vendor-${item.id}`} className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 text-base py-2.5 px-3" placeholder="Vendor Name *" required />
                                    </td>
                                    <td className="px-3 py-4 text-sm text-gray-500 align-top space-y-3">
                                      <input type="text" name={`phone-${item.id}`} className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 text-base py-2.5 px-3" placeholder="Phone" />
                                    </td>
                                    <td className="px-3 py-4 text-sm text-gray-500 align-top">
                                      <input type="number" step="any" name={`delivered-${item.id}`} className="block w-32 rounded-lg border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 text-base py-2.5 px-3" placeholder="0" />
                                    </td>
                                    <td className="px-3 py-4 text-sm text-gray-500 align-top">
                                      <div className="relative rounded-lg shadow-sm">
                                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                                          <span className="text-gray-500 sm:text-base">$</span>
                                        </div>
                                        <input type="number" step="0.01" name={`price-${item.id}`} className="block w-full rounded-lg border-gray-300 pl-8 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 text-base py-2.5 px-3" placeholder="Price" />
                                      </div>
                                    </td>
                                    <td className="px-3 py-4 text-sm text-gray-500 align-top space-y-3">
                                      <input type="text" name={`receipt-${item.id}`} className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 text-base py-2.5 px-3" placeholder="Receipt # *" required />
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                        <div className="space-y-6">
                        {po.items.map((item) => (
                            <div key={item.id} className="grid grid-cols-1 gap-4 sm:grid-cols-6 bg-gray-50 p-4 rounded-lg">
                            <div className="sm:col-span-6 font-medium text-sm text-gray-900">{item.description} (Ordered: {item.qty} {item.unit})</div>
                            
                            <div className="sm:col-span-1">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Qty Delivered</label>
                                <input type="number" step="any" name={`delivered-${item.id}`} className="block w-full rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 text-base py-2 px-3" placeholder="0" />
                            </div>
                            
                            <div className="sm:col-span-2">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Vendor Name</label>
                                <input type="text" name={`vendor-${item.id}`} className="block w-full rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 text-base py-2 px-3" required />
                            </div>

                            <div className="sm:col-span-1">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Receipt #</label>
                                <input type="text" name={`receipt-${item.id}`} className="block w-full rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 text-base py-2 px-3" required />
                            </div>

                            <div className="sm:col-span-1">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Vendor Phone</label>
                                <input type="text" name={`phone-${item.id}`} className="block w-full rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 text-base py-2 px-3" />
                            </div>

                            <div className="sm:col-span-1">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Unit Price</label>
                                <input type="number" step="0.01" name={`price-${item.id}`} className="block w-full rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 text-base py-2 px-3" />
                            </div>
                            </div>
                        ))}
                        </div>
                        )}
                    </div>

                    <div className="pt-4">
                        <SubmitButton className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-3 text-base font-semibold text-white shadow-sm transition-all hover:bg-emerald-700 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2">
                        Goods Received
                        </SubmitButton>
                    </div>
                  </form>
                </CardContent>
              </Card>
            )}
        </div>
      </div>
    </div>
  );
}
