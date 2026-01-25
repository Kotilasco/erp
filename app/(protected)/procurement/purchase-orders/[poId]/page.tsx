import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { placeOrder, receiveGoods } from '../actions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import SubmitButton from '@/components/SubmitButton';
import Link from 'next/link';
import Money from '@/components/Money';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
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
      <div className="mx-auto w-full max-w-5xl space-y-6 print:max-w-none">
        
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
              title="Purchase Order"
              recipientLabel="Vendor"
              recipientIdLabel="Vendor Ref"
              recipientId={po.supplierId || po.vendor}
            />

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
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                        <label htmlFor="receivedAt" className="block text-sm font-medium text-gray-700">Received Date</label>
                        <input type="datetime-local" name="receivedAt" id="receivedAt" defaultValue={new Date().toISOString().slice(0, 16)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm" />
                        </div>
                        <div>
                        <label htmlFor="note" className="block text-sm font-medium text-gray-700">Note</label>
                        <input type="text" name="note" id="note" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm" />
                        </div>
                    </div>

                    <div className="border-t border-gray-200 pt-4">
                        <h3 className="text-sm font-medium text-gray-900 mb-4">Items to Receive</h3>
                        <div className="space-y-6">
                        {po.items.map((item) => (
                            <div key={item.id} className="grid grid-cols-1 gap-4 sm:grid-cols-6 bg-gray-50 p-4 rounded-lg">
                            <div className="sm:col-span-6 font-medium text-sm text-gray-900">{item.description} (Ordered: {item.qty} {item.unit})</div>
                            
                            <div className="sm:col-span-1">
                                <label className="block text-xs font-medium text-gray-500">Qty Delivered</label>
                                <input type="number" step="any" name={`delivered-${item.id}`} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm" placeholder="0" />
                            </div>
                            
                            <div className="sm:col-span-2">
                                <label className="block text-xs font-medium text-gray-500">Vendor Name</label>
                                <input type="text" name={`vendor-${item.id}`} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm" required />
                            </div>

                            <div className="sm:col-span-1">
                                <label className="block text-xs font-medium text-gray-500">Receipt #</label>
                                <input type="text" name={`receipt-${item.id}`} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm" required />
                            </div>

                            <div className="sm:col-span-1">
                                <label className="block text-xs font-medium text-gray-500">Vendor Phone</label>
                                <input type="text" name={`phone-${item.id}`} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm" />
                            </div>

                            <div className="sm:col-span-1">
                                <label className="block text-xs font-medium text-gray-500">Unit Price</label>
                                <input type="number" step="0.01" name={`price-${item.id}`} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm" />
                            </div>
                            </div>
                        ))}
                        </div>
                    </div>

                    <div className="flex justify-end pt-4">
                        <SubmitButton className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-emerald-700 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2">
                        Submit Delivery
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
