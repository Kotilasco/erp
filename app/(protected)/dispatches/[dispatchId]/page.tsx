// app/(protected)/dispatches/[dispatchId]/page.tsx
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { updateDispatchItems, submitDispatch, markDispatchItemHandedOut } from '@/app/(protected)/projects/actions';
import { deleteDispatch } from '@/app/(protected)/dispatches/action';
import LoadingButton from '@/components/LoadingButton';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import clsx from 'clsx';
import { 
  ArrowLeftIcon, 
  CalendarIcon, 
  TruckIcon, 
  UserIcon, 
  MapPinIcon,
  DocumentCheckIcon
} from '@heroicons/react/24/outline';
import MarkHandedOutButton from '@/components/MarkHandedOutButton';
import DriverAcknowledgeButton from '@/components/DriverAcknowledgeButton';
import AssignDriverForm from '@/components/AssignDriverForm';
import { getDrivers } from '@/app/(protected)/dispatches/driver-actions';
import DispatchAcknowledgment from '@/components/dispatch-acknowledgment';

const STATUS_BADGE: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
  PENDING: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  SUBMITTED: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  APPROVED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  REJECTED: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
  DISPATCHED: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  OUT_FOR_DELIVERY: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
  DELIVERED: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  RECEIVED: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
};

export default async function DispatchDetail({ params }: { params: Promise<{ dispatchId: string }> }) {
  const me = await getCurrentUser();
  if (!me) {
    redirect('/login');
  }
  //if (!me) return <div className="p-6">Auth required.</div>;
  const role = (me as any).role as string | undefined;
  // TODO: Remove this debug after verifying
  // console.log('DispatchDetail Role:', role, 'IsSecurity:', (role === 'SECURITY' || role === 'ADMIN'));
  const { dispatchId } = await params;

  const dispatch = await prisma.dispatch.findUnique({
    where: { id: dispatchId },
    include: {
      project: { select: { id: true, projectNumber: true, quote: { select: { customer: { select: { displayName: true } } } } } },
      items: { orderBy: { id: 'asc' }, include: { inventoryItem: true } },
      createdBy: { select: { name: true, email: true } },
    },
  });
  if (!dispatch) return <div className="p-6 text-gray-500">Dispatch not found.</div>;

  const canEdit = (role === 'PROJECT_OPERATIONS_OFFICER' || role === 'ADMIN') && dispatch.status === 'DRAFT';
  const isSecurity = role === 'SECURITY' || role === 'ADMIN';

  const saveAction = async (fd: FormData) => {
    'use server';
    const updates: { id: string; qty: number; selected: boolean }[] = [];
    for (const it of dispatch.items) {
      const qtyRaw = fd.get(`qty-${it.id}`);
      const selRaw = fd.get(`sel-${it.id}`);
      const qty = qtyRaw != null ? Number(qtyRaw) : Number(it.qty);
      const selected = selRaw === 'on';
      updates.push({ id: it.id, qty, selected });
    }
    await updateDispatchItems(dispatch.id, updates);
  };

  const submitAction = async (fd: FormData) => {
    'use server';
    const updates: { id: string; qty: number; selected: boolean }[] = [];
    for (const it of dispatch.items) {
      const qtyRaw = fd.get(`qty-${it.id}`);
      const selRaw = fd.get(`sel-${it.id}`);
      const qty = qtyRaw != null ? Number(qtyRaw) : Number(it.qty);
      const selected = selRaw === 'on';
      updates.push({ id: it.id, qty, selected });
    }
    await updateDispatchItems(dispatch.id, updates);
    await submitDispatch(dispatch.id);
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header with Breadcrumb-like nav */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
               <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                 Project Name: <span className="text-gray-700 dark:text-gray-200">{dispatch.project?.quote?.customer?.displayName || dispatch.project?.projectNumber || 'Unknown'}</span>
               </h1>
               <span
                 className={clsx(
                   'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide',
                   STATUS_BADGE[dispatch.status] || 'bg-gray-100 text-gray-800'
                 )}
               >
                 {dispatch.status.replace(/_/g, ' ')}
               </span>
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
               Dispatch <span className="font-mono">#{dispatch.id.slice(0, 8)}</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-4 text-sm text-gray-600 dark:text-gray-400">
               <div className="flex items-center gap-1">
                 <UserIcon className="h-4 w-4 text-gray-400" />
                 <span>Requested by: <span className="font-medium text-gray-900 dark:text-white">{dispatch.createdBy?.name || dispatch.createdBy?.email}</span></span>
               </div>
               <div className="flex items-center gap-1">
                 <CalendarIcon className="h-4 w-4 text-gray-400" />
                 <span>Date: {new Date(dispatch.createdAt).toLocaleDateString()}</span>
               </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/dispatches" className="inline-flex items-center gap-2 rounded-md bg-green-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-green-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600 transition-colors w-fit">
                <ArrowLeftIcon className="h-5 w-5" />
                Back to Dispatches
            </Link>
          </div>
        </div>
      </div>

      {canEdit ? (
        <div className="space-y-6">
          <form id="dispatch-form" action={saveAction} className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800 p-4">
             <TableContent dispatch={dispatch} canEdit={true} isSecurity={isSecurity} />
          </form>
          
          <div className="flex gap-3 justify-end items-center">
             <form action={async () => {
                'use server';
                await deleteDispatch(dispatch.id);
             }}>
                <LoadingButton type="submit" className="bg-rose-600 text-white hover:bg-rose-700 border-transparent shadow-sm">
                  Delete Draft
                </LoadingButton>
             </form>

             <div className="flex gap-3">
              <LoadingButton form="dispatch-form" type="submit" className="bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700">
                  Save Draft
              </LoadingButton>
              <LoadingButton form="dispatch-form" formAction={submitAction} className="bg-emerald-600 text-white hover:bg-emerald-700 border-transparent shadow-sm">
                  <DocumentCheckIcon className="h-4 w-4 mr-2" />
                  Submit to Security
              </LoadingButton>
             </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800 p-4">
             <TableContent dispatch={dispatch} canEdit={false} isSecurity={isSecurity} />
          </div>
          




          {/* Replaced DriverAcknowledgeButton with unified DispatchAcknowledgment */}
          <div className="mt-6">
             <DispatchAcknowledgment 
                dispatch={dispatch} 
                userId={me.id!} 
                userRole={role ?? ''} 
             />
          </div>
        </div>
      )}
    </div>
  );
}

async function TableContent({ dispatch, canEdit, isSecurity }: { dispatch: any, canEdit: boolean, isSecurity: boolean }) {
  let drivers: any[] = [];
  
  const showAssign = isSecurity && 
    dispatch.status === 'DISPATCHED';

  if (showAssign) {
      try { drivers = await getDrivers(); } catch (e) {}
  }
  
  return (
    <div className="space-y-6">
        <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900/50">
                <tr>
                <th scope="col" className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Include</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Description</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Qty</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Unit</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Handed Out</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Received</th>
                <th scope="col" className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Actions</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-800">
                {dispatch.items.map((it: any) => (
                <tr key={it.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                    {canEdit ? (
                        <input type="checkbox" name={`sel-${it.id}`} defaultChecked={it.selected ?? true} className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                    ) : it.selected ? (
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold">✓</span>
                    ) : (
                        <span className="text-gray-400">—</span>
                    )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                    <div className="font-medium">{it.description}</div>
                    {it.inventoryItem && (
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Inv: {it.inventoryItem.name}</div>
                    )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                    {canEdit ? (
                        <input name={`qty-${it.id}`} type="number" min={0} step="0.01" defaultValue={Number(it.qty)} className="w-24 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm py-1" />
                    ) : (
                        <span className="font-medium">{Number(it.qty)}</span>
                    )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{it.unit ?? '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{it.handedOutAt ? new Date(it.handedOutAt).toLocaleString() : '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{it.receivedAt ? new Date(it.receivedAt).toLocaleString() : '—'}</td>
                    <td className="px-4 py-3 text-center">
                    {!canEdit && isSecurity && dispatch.status !== 'DRAFT' && !it.handedOutAt && (
                        <div className="flex justify-center">
                           <MarkHandedOutButton dispatchItemId={it.id} />
                        </div>
                    )}
                    </td>
                </tr>
                ))}
            </tbody>
            </table>
        </div>
        
        {showAssign && (
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 dark:bg-amber-900/20 dark:border-amber-800">
                <h3 className="text-sm font-bold text-amber-800 dark:text-amber-300 mb-4 flex items-center gap-2">
                    <TruckIcon className="h-5 w-5" />
                    Assign to Driver for Pickup
                </h3>
                <AssignDriverForm 
                    dispatchId={dispatch.id} 
                    drivers={drivers} 
                    currentDriverId={dispatch.assignedToDriverId}
                />
            </div>
        )}
    </div>
  );
}
