import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import {
  updateDispatchItems,
  submitDispatch,
  markItemUsedOut,
} from '@/app/(protected)/projects/actions';
import { returnItemsToInventory } from '@/app/(protected)/projects/actions';
import LoadingButton from '@/components/LoadingButton';
import { revalidatePath } from 'next/cache';
import { markItemHandedOut } from '../action';
import { redirect } from 'next/navigation';
import ApproveDispatchButton from '@/components/ApproveDispatchButton';
import Link from 'next/link';
import { ArrowLeftIcon, CalendarIcon, UserIcon, CheckIcon, ShieldCheckIcon, TrashIcon, DocumentTextIcon } from '@heroicons/react/24/outline';
import { cn } from '@/lib/utils';

export const runtime = 'nodejs';

export default async function DispatchDetail({
  params,
}: {
  params: Promise<{ dispatchId: string }>;
}) {
  const me = await getCurrentUser();
  if (!me) return <div className="p-6">Auth required.</div>;
  const role = (me as any).role as string | undefined;

  const { dispatchId } = await params;
  const dispatch = await prisma.dispatch.findUnique({
    where: { id: dispatchId },
    include: { 
        project: { 
            select: { 
                id: true, 
                name: true,
                projectNumber: true,
                quote: { include: { customer: true } }
            } 
        }, 
        items: { orderBy: { id: 'asc' } },
        createdBy: { select: { name: true } }
    },
  });
  
  if (!dispatch) return <div className="p-6">Not found.</div>;

  const canEdit = (role === 'PROJECT_OPERATIONS_OFFICER' || role === 'ADMIN') && dispatch.status === 'DRAFT';
  const canApprove =
    (role === 'PROJECT_OPERATIONS_OFFICER' || role === 'ADMIN') && dispatch.status === 'SUBMITTED';
  const isSecurity = role === 'SECURITY' || role === 'ADMIN';
  const isDriver = role === 'DRIVER' || role === 'ADMIN';
  const canReturn = (role === 'PROJECT_OPERATIONS_OFFICER' || role === 'PROCUREMENT' || role === 'SENIOR_PROCUREMENT' || role === 'ADMIN') && dispatch.status === 'DELIVERED';

  // ---------- server actions ----------
  
  // Save table edits (PM)
  const saveAction = async (fd: FormData) => {
    'use server';
    const updates: { id: string; qty: number }[] = [];
    // re-fetch items to iterate stable list
    const fresh = await prisma.dispatch.findUnique({
      where: { id: dispatchId },
      include: { items: true },
    });
    if (!fresh) throw new Error('Dispatch not found.');
    for (const it of fresh.items) {
      const raw = fd.get(`qty-${it.id}`);
      if (raw == null || raw === '') continue;
      const qty = Number(raw);
      if (!(qty >= 0)) throw new Error('Invalid qty');
      updates.push({ id: it.id, qty });
    }
    if (updates.length) {
      await updateDispatchItems(dispatchId, updates);
    }
    revalidatePath(`/dispatches/${dispatchId}`);
  };

  // Submit for Security (PM)
  const submitAction = async (fd: FormData) => {
    'use server';
    // persist any current edits first
    await saveAction(fd);
    await submitDispatch(dispatchId);
    revalidatePath(`/dispatches/${dispatchId}`);
  };

  // DRIVER: acknowledge received for a single line
  const acknowledgeReceived = async (fd: FormData) => {
    'use server';
    const me = await getCurrentUser();
    if (!me) throw new Error('Auth required');
    const role = (me as any).role as string | undefined;
    if (!(role === 'DRIVER' || role === 'ADMIN')) throw new Error('Forbidden');

    const itemId = String(fd.get('itemId') ?? '');
    if (!itemId) throw new Error('Missing itemId');

    const item = await prisma.dispatchItem.findUnique({
      where: { id: itemId },
      select: { dispatchId: true, handedOutAt: true },
    });
    if (!item) throw new Error('Item not found');
    if (!item.handedOutAt) throw new Error('Item not yet handed out');

    await prisma.dispatchItem.update({
      where: { id: itemId },
      data: {
        receivedAt: new Date(),
        receivedById: me.id!,
      },
    });

    // If ALL items received, mark dispatch DELIVERED
    const remaining = await prisma.dispatchItem.count({
      where: { dispatchId, receivedAt: null },
    });
    if (remaining === 0) {
      await prisma.dispatch.update({
        where: { id: dispatchId },
        data: { status: 'DELIVERED' },
      });
    }

    revalidatePath(`/dispatches/${dispatchId}`);
  };

  const returnAction = async (fd: FormData) => {
    'use server';
    
    // fetch fresh dispatch items
    const fresh = await prisma.dispatch.findUnique({
      where: { id: dispatchId },
      include: { items: true },
    });
    if (!fresh) throw new Error('Dispatch not found');

    type ReturnRow = {
      dispatchItemId: string;
      inventoryItemId: string | null;
      description: string;
      unit: string | null;
      qty: number;
      note?: string | null;
      usedOut?: boolean;
    };

    const rows: ReturnRow[] = [];

    for (const it of fresh.items) {
      const raw = fd.get(`return-${it.id}`);
      const usedOut = !!fd.get(`usedout-${it.id}`);
      const note = String(fd.get(`note-${it.id}`) || '');
      const qty = raw ? Number(raw) : 0;

      rows.push({
        dispatchItemId: it.id,
        inventoryItemId: it.inventoryItemId ?? null,
        description: it.description,
        unit: it.unit ?? null,
        qty,
        note: note || null,
        usedOut,
      });
    }

    // partition rows: returns vs used-out-only
    const toReturn = rows.filter((r) => r.qty > 0);
    const toUsedOut = rows
      .filter((r) => r.usedOut)
      .map((r) => ({
        dispatchItemId: r.dispatchItemId,
        qty: r.qty,
        inventoryItemId: r.inventoryItemId,
      }));

    // 1) apply actual returns (if any)
    if (toReturn.length > 0) {
      await returnItemsToInventory(
        dispatchId,
        fresh.projectId ?? null,
        toReturn.map((r) => ({
          dispatchItemId: r.dispatchItemId,
          inventoryItemId: r.inventoryItemId,
          description: r.description,
          unit: r.unit,
          qty: r.qty,
          note: r.note ?? null,
        })),
        null
      );
    }

    // 2) handle used-out marks
    const refreshed = await prisma.dispatch.findUnique({
      where: { id: dispatchId },
      include: { items: true },
    });
    if (!refreshed) throw new Error('Dispatch not found after return');

    for (const u of toUsedOut) {
      const it = refreshed.items.find((x) => x.id === u.dispatchItemId);
      if (!it) continue;
      const alreadyHanded = Number(it.handedOutQty ?? 0);
      const alreadyReturned = Number(it.returnedQty ?? 0);
      const alreadyUsed = Number(it.usedOutQty ?? 0);
      const available = Math.max(0, alreadyHanded - alreadyReturned - alreadyUsed);

      const markQty = u.qty > 0 ? Math.max(0, available - u.qty) : available;
      if (markQty > 0) {
        await markItemUsedOut(u.dispatchItemId, markQty);
      }
    }

    revalidatePath(`/dispatches/${dispatchId}`);
    revalidatePath('/dispatches');
    return redirect(`/projects/${dispatch.project.id}/dispatches/${dispatchId}`);
  };

  // ---------- end actions ----------

  return (
    <div className="space-y-6 max-w-7xl mx-auto pt-6">
      {/* Header Section */}
      <div className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200 pb-4">
          <h1 className="flex items-center text-3xl font-bold tracking-tight text-gray-900">
            <span className="text-black font-semibold text-xl tracking-wide mr-2">Project Name:</span>
            <span className="text-xl font-bold text-gray-900">{dispatch.project.quote?.customer?.displayName || dispatch.project.name}</span>
          </h1>
          
           <Link href={`/projects/${dispatch.project.id}/dispatches`} className="inline-flex items-center gap-2 rounded-md bg-orange-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-orange-700 transition-colors">
              <ArrowLeftIcon className="h-4 w-4" />
              Back to Dispatches
           </Link>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 dark:bg-gray-800 dark:border-gray-700">
             <div className="flex items-start gap-4 mb-8 border-b border-gray-100 pb-6">
                <div className="p-3 bg-blue-50 rounded-full">
                    <DocumentTextIcon className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Dispatch Details</h2>
                    <p className="text-sm text-gray-500 mt-1">View and manage dispatch information</p>
                </div>
             </div>

             <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
                <div>
                    <div className="flex items-center gap-4">
                        <span className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Dispatch #</span>
                        <span className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                            {dispatch.dispatchNumber || dispatch.id.slice(0, 8).toUpperCase()}
                        </span>
                        <span className={cn(
                            "inline-flex items-center rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide",
                            dispatch.status === 'APPROVED' ? "bg-green-100 text-green-800" :
                            dispatch.status === 'SUBMITTED' ? "bg-blue-100 text-blue-800" :
                            dispatch.status === 'DELIVERED' ? "bg-purple-100 text-purple-800" :
                            "bg-gray-100 text-gray-800"
                        )}>
                            {dispatch.status}
                        </span>
                    </div>
                    <div className="mt-4 flex items-center gap-6 text-sm text-gray-500 dark:text-gray-400">
                        <div className="flex items-center gap-2">
                            <CalendarIcon className="h-5 w-5 text-gray-400" />
                            <span className="font-medium">Created:</span>
                            {new Date(dispatch.createdAt).toLocaleDateString()}
                        </div>
                        <div className="flex items-center gap-2">
                             <UserIcon className="h-5 w-5 text-gray-400" />
                             <span className="font-medium">By:</span>
                             {dispatch.createdBy?.name || 'Unknown'}
                        </div>
                    </div>
                </div>
                
                <div className="flex gap-2">
                     {/* Action Buttons Placeholder */}
                </div>
             </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden dark:border-gray-700 dark:bg-gray-800">
         <div className="px-8 py-6 border-b border-gray-100 dark:border-gray-700 bg-white">
            <div className="flex items-center gap-3">
                 <div className="h-6 w-1.5 bg-blue-600 rounded-full"></div>
                 <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wide">Dispatch Items</h3>
            </div>
         </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Description</th>
                <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Qty</th>
                <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Unit</th>
                <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Handed Out</th>
                <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Received</th>
                <th className="px-6 py-3 text-center text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-800">
              {dispatch.items.map((it) => (
                <tr key={it.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-gray-100">{it.description}</td>
                  <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">
                    {/* <— points to the bottom form */}
                    {canEdit ? (
                      <input
                        name={`qty-${it.id}`}
                        form="editForm"
                        type="number"
                        min={0}
                        step="0.01"
                        defaultValue={Number(it.qty)}
                        className="w-28 rounded-md border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-orange-500 focus:bg-white focus:ring-orange-500 transition-all"
                      />
                    ) : (
                      <span className="font-mono">{Number(it.qty)}</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">{it.unit ?? '-'}</td>
                  <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                    {it.handedOutAt ? new Date(it.handedOutAt).toLocaleString() : '—'}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                    {it.receivedAt ? new Date(it.receivedAt).toLocaleString() : '—'}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex justify-center gap-2">
                      {isSecurity &&
                        (dispatch.status === 'APPROVED' || dispatch.status === 'IN_TRANSIT') &&
                        !it.handedOutAt && (
                          <form action={markItemHandedOut}>
                            <input type="hidden" name="itemId" value={it.id} />
                            <input type="hidden" name="qty" value={it.qty} />
                            <LoadingButton
                              type="submit"
                              className="inline-flex items-center rounded border border-transparent bg-indigo-600 px-2.5 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                              loadingText="Handing out..."
                            >
                              Mark Handed Out
                            </LoadingButton>
                          </form>
                        )}
                      {isDriver &&
                        (dispatch.status === 'IN_TRANSIT' ||
                          dispatch.status === 'APPROVED' ||
                          dispatch.status === 'DELIVERED') &&
                        it.handedOutAt &&
                        !it.receivedAt && (
                          <form action={acknowledgeReceived}>
                            <input type="hidden" name="itemId" value={it.id} />
                            <button className="inline-flex items-center rounded border border-transparent bg-green-600 px-2.5 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2">
                              Acknowledge Received
                            </button>
                          </form>
                        )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 pt-4">
         <div className="flex gap-3">
            {canApprove && dispatch.status === 'SUBMITTED' && (
                <ApproveDispatchButton dispatchId={dispatch.id} />
            )}
         </div>

         {canEdit && (
            <div className="flex flex-wrap gap-3">
                <form id="editForm" action={saveAction} className="flex gap-2">
                    <LoadingButton 
                        type="submit"
                        className="inline-flex flex-col items-center justify-center gap-1 rounded-md border border-transparent bg-green-600 px-6 py-3 text-sm font-medium text-white shadow-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
                    >
                        <CheckIcon className="h-4 w-4" />
                        Save Changes
                    </LoadingButton>
                    <LoadingButton
                        formAction={submitAction}
                        className="inline-flex flex-col items-center justify-center gap-1 rounded-md border border-transparent bg-blue-600 px-6 py-3 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                    >
                        <ShieldCheckIcon className="h-4 w-4" />
                        Submit for Security
                    </LoadingButton>
                </form>
                
                <form action={async () => {
                    'use server';
                    const { deleteDispatch } = await import('@/app/(protected)/projects/actions');
                    await deleteDispatch(dispatchId);
                }}>
                     <LoadingButton 
                        type="submit" 
                        className="inline-flex flex-col items-center justify-center gap-1 rounded-md border border-transparent bg-red-600 px-6 py-3 text-sm font-medium text-white shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                        loadingText="Deleting..."
                     >
                        <TrashIcon className="h-4 w-4" />
                        Delete Draft
                     </LoadingButton>
                </form>
            </div>
          )}
      </div>

      {canReturn && (
        <div className="mt-8 rounded-xl border border-gray-200 bg-white shadow-sm p-6 dark:border-gray-700 dark:bg-gray-800">
          <form action={returnAction}>
            <div className="border-b border-gray-200 pb-4 mb-4">
                 <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Return / Mark Used Out</h3>
                 <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Enter quantities to return to inventory or mark as used out (consumed).
                 </p>
            </div>

            <div className="space-y-4">
                <div className="grid grid-cols-12 gap-4 border-b border-gray-100 pb-2 text-xs font-semibold uppercase text-gray-500">
                    <div className="col-span-4">Item</div>
                    <div className="col-span-2">Return Qty</div>
                    <div className="col-span-2">Mark Used</div>
                    <div className="col-span-4">Note</div>
                </div>
                
                {dispatch.items
                .filter((it) => Number(it.qty) > 0)
                .map((it) => (
                    <div key={it.id} className="grid grid-cols-12 gap-4 items-center py-2 border-b border-gray-50 last:border-0">
                        <div className="col-span-4">
                            <div className="text-sm font-medium text-gray-900">{it.description}</div>
                            <div className="text-xs text-gray-500">
                                Dispatched: {Number(it.qty)} {it.unit ?? ''}
                            </div>
                        </div>

                        <div className="col-span-2">
                            <input
                                name={`return-${it.id}`}
                                type="number"
                                min="0"
                                step="0.01"
                                placeholder="0"
                                className="w-full rounded border-gray-300 shadow-sm focus:border-orange-500 focus:ring-orange-500 text-sm"
                            />
                        </div>

                        <div className="col-span-2 flex items-center justify-center">
                            <input
                                name={`usedout-${it.id}`}
                                type="checkbox"
                                className="h-4 w-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                            />
                        </div>

                        <div className="col-span-4">
                            <input
                                name={`note-${it.id}`}
                                type="text"
                                placeholder="Reason / Note"
                                className="w-full rounded border-gray-300 shadow-sm focus:border-orange-500 focus:ring-orange-500 text-sm"
                            />
                        </div>
                    </div>
                ))}
            </div>
            
            <div className="mt-6 flex justify-end">
                 <LoadingButton 
                    type="submit"
                    className="rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                 >
                    Process Return / Used Out
                 </LoadingButton>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
