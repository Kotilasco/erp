import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import PrintHeader from '@/components/PrintHeader';
import Money from '@/components/Money';
import { CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline';
import { approveTopup, rejectTopup } from './actions';

export default async function ApprovalsPage() {
    const user = await getCurrentUser();
    if (!user) redirect('/login');

    const allowedRoles = ['SENIOR_PROCUREMENT', 'ADMIN', 'MANAGING_DIRECTOR', 'GENERAL_MANAGER'];
    if (!allowedRoles.includes(user.role as string)) return <div className="p-8">Access Denied</div>;

    // Fetch Pending Quantity Increases (Topups)
    const [topups, reviewReqs] = await Promise.all([
        prisma.requisitionItemTopup.findMany({
            where: {
                decidedAt: null,
                requestedById: { not: user.id } // Conflict of Interest Safety
            },
            include: {
                requisitionItem: {
                    include: {
                        requisition: {
                            include: { project: true }
                        }
                    }
                },
                requestedBy: true
            }
        }),
        prisma.procurementRequisition.findMany({
            where: {
                OR: [
                    {
                        status: 'SUBMITTED',
                        note: { contains: 'Review request from Req' },
                    },
                    {
                        status: 'AWAITING_APPROVAL'
                    }
                ],
                submittedById: { not: user.id }
            },
            include: {
                project: true,
                items: true,
                submittedBy: true
            }
        })
    ]);

    return (
        <div className="min-h-screen bg-slate-50 p-6 md:p-8 space-y-6 max-w-[1200px] mx-auto">
             <div className="flex justify-between items-center bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                 <div>
                    <h1 className="text-2xl font-bold text-gray-900">Pending Approvals</h1>
                    <p className="text-gray-500">Review quantity top-up requests from Procurement.</p>
                 </div>
                 <Link href="/dashboard" className="text-sm font-medium text-indigo-600 hover:text-indigo-500">
                    Back to Dashboard
                 </Link>
             </div>

             {/* Review Requisitions Section */}
             {reviewReqs.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm border border-orange-200 overflow-hidden">
                    <div className="bg-orange-50 px-6 py-4 border-b border-orange-100 flex justify-between items-center">
                        <h2 className="font-bold text-orange-900 flex items-center gap-2">
                            <span className="bg-orange-200 text-orange-800 text-xs px-2 py-1 rounded-full">{reviewReqs.length}</span>
                            Price Review Requisitions
                        </h2>
                    </div>
                    <ul className="divide-y divide-orange-100">
                        {reviewReqs.map((req) => (
                            <li key={req.id} className="p-6 hover:bg-orange-50/30 transition-colors">
                                <div className="flex flex-col md:flex-row gap-6 justify-between items-center">
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <span className="font-semibold text-gray-900">
                                                {req.project.projectNumber}
                                            </span>
                                            <span className="text-sm text-gray-600">
                                                Requisition #{req.id.slice(-6).toUpperCase()}
                                            </span>
                                        </div>
                                        <div className="text-sm text-gray-500">
                                            Note: {req.note}
                                        </div>
                                        <div className="text-xs text-gray-400">
                                            Submitted by {req.submittedBy?.name || 'Unknown'} • {req.items.length} items
                                        </div>
                                    </div>
                                    <div>
                                        <Link 
                                            href={`/procurement/requisitions/${req.id}`}
                                            className="inline-flex items-center px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 shadow-sm"
                                        >
                                            Review Details
                                        </Link>
                                    </div>
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>
             )}

             <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="bg-gray-50 px-6 py-4 border-b border-gray-100">
                    <h2 className="font-bold text-gray-900">Quantity Top-Ups</h2>
                </div>
                {topups.length === 0 ? (
                    <div className="p-12 text-center text-gray-500">
                        No pending approvals found.
                    </div>
                ) : (
                    <ul className="divide-y divide-gray-100">
                        {topups.map((t) => (
                            <li key={t.id} className="p-6 hover:bg-gray-50 transition-colors">
                                <div className="flex flex-col md:flex-row gap-6 justify-between items-start md:items-center">
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <span className="font-semibold text-gray-900">
                                                {t.requisitionItem.description}
                                            </span>
                                            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 border border-gray-200">
                                                {t.requisitionItem.requisition.project.projectNumber}
                                            </span>
                                        </div>
                                        <div className="text-sm text-gray-500">
                                            Req #{t.requisitionItem.requisitionId.slice(-6).toUpperCase()} • Requested by <span className="font-medium text-gray-700">{t.requestedBy?.name || 'Unknown'}</span>
                                        </div>
                                        <div className="text-sm text-gray-500 mt-1">
                                            Reason: <span className="italic">"{t.reason}"</span>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-6">
                                        <div className="text-right">
                                            <div className="text-xs uppercase tracking-wide text-gray-400 font-semibold">Extra Qty</div>
                                            <div className="font-bold text-gray-900 text-lg">
                                                +{t.qtyRequested} {t.requisitionItem.unit}
                                            </div>
                                        </div>

                                        <div className="flex gap-2">
                                            <form action={approveTopup}>
                                                <input type="hidden" name="topupId" value={t.id} />
                                                <button className="p-2 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-200 transition-colors" title="Approve">
                                                    <CheckCircleIcon className="h-6 w-6" />
                                                </button>
                                            </form>
                                            <form action={rejectTopup}>
                                                <input type="hidden" name="topupId" value={t.id} />
                                                <button className="p-2 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200 transition-colors" title="Reject">
                                                    <XCircleIcon className="h-6 w-6" />
                                                </button>
                                            </form>
                                        </div>
                                    </div>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
             </div>
        </div>
    );
}
