// app/(protected)/dispatches/[dispatchId]/receipt/page.tsx  (Server Component)
import PrintButton from '@/components/PrintButton';
import { markDispatchSent, markDispatchReceived } from './actions';

import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export default async function ReceiptPage({ params }: { params: Promise<{ dispatchId: string }> }) {
  const { dispatchId } = await params;
  const user = await getCurrentUser();
  
  const dispatch = await prisma.dispatch.findUnique({
    where: { id: dispatchId },
  });

  if (!dispatch || !user) return <div>Not found</div>;

  return (
    <div className="space-y-6 p-6">
      <header className="flex items-center justify-between bg-white p-6 rounded-lg shadow-sm border">
        <div>
           <h1 className="text-2xl font-bold text-gray-900">Dispatch Receipt #{(dispatch as any).dispatchNumber || dispatchId.slice(0,8)}</h1>
           <p className="text-gray-500">Status: {dispatch.status}</p>
        </div>
        <div className="flex gap-2">
          <PrintButton />
        </div>
      </header>

      {/* … your receipt table placeholder … */}
      <div className="bg-white p-6 rounded-lg shadow-sm border min-h-[200px] flex items-center justify-center text-gray-400">
        Receipt Details Here
      </div>

      <div className="flex flex-wrap gap-4 mt-8">
        {/* Security Action: Mark Sent (Gate Pass) */}


        {/* Driver/Recipient Action: Mark Received */}
        {(user.role === 'DRIVER' || user.role === 'ADMIN') && dispatch.status === 'DISPATCHED' && !dispatch.driverSignedAt && (
            <form action={markDispatchReceived.bind(null, dispatchId)}>
            <button
                type="submit"
                className="flex items-center gap-3 rounded-xl bg-emerald-600 px-8 py-4 text-lg font-bold text-white shadow-lg transition-all hover:bg-emerald-700 hover:shadow-xl hover:-translate-y-1"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Confirm Delivery (Mark Received)
            </button>
            </form>
        )}
      </div>
    </div>
  );
}
