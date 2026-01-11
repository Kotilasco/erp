// app/(protected)/projects/[projectId]/requisitions/[requisitionId]/page.tsx
import { prisma } from '@/lib/db';
import React from 'react';
import { fromMinor } from '@/helpers/money';
import Money from '@/components/Money';
import { getCurrentUser } from '@/lib/auth';
import { notFound, redirect } from 'next/navigation';
import { submitRequisitionToProcurement } from '@/app/(protected)/projects/actions';
import Link from 'next/link';
import SubmitButton from '@/components/SubmitButton';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ArrowLeftIcon, ShoppingCartIcon, DocumentTextIcon, UserIcon, CalendarIcon, CheckCircleIcon } from '@heroicons/react/24/outline';

export default async function ProjectRequisitionDetailPage({
  params,
}: {
  params: Promise<{ projectId: string; requisitionId: string }>;
}) {
  const { projectId, requisitionId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const req = await prisma.procurementRequisition.findUnique({
    where: { id: requisitionId },
    include: {
      items: {
        include: {
          quoteLine: { select: { metaJson: true } },
        },
      },
      project: { include: { quote: { select: { number: true, customer: { select: { displayName: true } } } } } },
      submittedBy: { select: { name: true } },
    },
  });

  if (!req) return notFound();
  if (req.projectId !== projectId) return notFound();

  const grandMinor = req.items.reduce((acc, it) => acc + BigInt(it.amountMinor ?? 0), 0n);
  const grand = fromMinor(grandMinor);

  const getItemSection = (item: (typeof req.items)[number]) => {
    const rawMeta = item.quoteLine?.metaJson;
    if (typeof rawMeta === 'string' && rawMeta.trim().length > 0) {
      try {
        const parsed = JSON.parse(rawMeta) as { section?: string; category?: string };
        const fromMeta =
          (typeof parsed?.section === 'string' && parsed.section.trim().length > 0
            ? parsed.section
            : typeof parsed?.category === 'string' && parsed.category.trim().length > 0
              ? parsed.category
              : null) ?? null;
        if (fromMeta) return fromMeta.trim();
      } catch {
        // ignore malformed meta JSON
      }
    }
    return 'Uncategorized';
  };

  const groupedItemEntries = (() => {
    const buckets = new Map<string, (typeof req.items)[number][]>();
    for (const item of req.items) {
      const section = getItemSection(item);
      const bucket = buckets.get(section);
      if (bucket) {
        bucket.push(item);
      } else {
        buckets.set(section, [item]);
      }
    }
    return Array.from(buckets.entries());
  })();

  const canSubmit = req.status === 'DRAFT' && ['PROJECT_OPERATIONS_OFFICER', 'PROJECT_COORDINATOR', 'ADMIN', 'MANAGING_DIRECTOR', 'GENERAL_MANAGER'].includes(user.role as string);
  const showEstPrice = user.role !== 'PROJECT_OPERATIONS_OFFICER';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b border-gray-200 pb-6">
        <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg dark:bg-orange-900/30">
                <ShoppingCartIcon className="h-8 w-8 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
                <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">Requisition Details</h1>
                <div className="flex items-center gap-2 mt-1 text-sm text-gray-500">
                    <span className="font-mono font-medium text-gray-700">#{req.id.slice(0, 8)}</span>
                    <span>•</span>
                    <span>{req.project?.quote?.customer?.displayName || 'Unknown Client'}</span>
                </div>
            </div>
        </div>
        <div className="flex gap-3">
          <Link
            href={`/projects/${projectId}/requisitions`}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-bold text-gray-700 shadow-sm border border-gray-300 transition-all hover:bg-orange-50 hover:text-orange-700 hover:border-orange-200 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2"
          >
            <ArrowLeftIcon className="h-4 w-4 stroke-2" />
            Back to Requisitions
          </Link>
          {req.status === 'SUBMITTED' && (
            <Link
              href={`/procurement/requisitions/${requisitionId}`}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-orange-600 px-4 py-2.5 text-sm font-bold text-white shadow-md transition-all hover:bg-orange-700 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2"
            >
              View in Procurement
            </Link>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content (Items) */}
        <div className="lg:col-span-2 space-y-6">
            <Card className="border-gray-200 shadow-sm overflow-hidden">
                <CardHeader className="bg-gray-50/50 border-b border-gray-100 pb-4">
                    <CardTitle className="text-lg flex items-center gap-2">
                        <DocumentTextIcon className="h-5 w-5 text-gray-500" />
                        Requisition Items
                    </CardTitle>
                </CardHeader>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50/50">
                            <tr>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-500">Item Description</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-500">Unit</th>
                                <th scope="col" className="px-6 py-3 text-right text-xs font-bold uppercase tracking-wider text-gray-500">Qty</th>
                                {showEstPrice && <th scope="col" className="px-6 py-3 text-right text-xs font-bold uppercase tracking-wider text-gray-500">Est. Price</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 bg-white">
                            {groupedItemEntries.map(([section, items]) => (
                                <React.Fragment key={section}>
                                    <tr className="bg-gray-50/30">
                                        <td colSpan={showEstPrice ? 4 : 3} className="px-6 py-2 text-xs font-bold text-gray-500 uppercase tracking-wider">
                                            {section}
                                        </td>
                                    </tr>
                                    {items.map((it) => (
                                        <tr key={it.id} className="hover:bg-orange-50/30 transition-colors group">
                                            <td className="px-6 py-3 text-sm text-gray-700 font-medium">{it.description}</td>
                                            <td className="px-6 py-3 text-sm text-gray-500">{it.unit ?? '-'}</td>
                                            <td className="px-6 py-3 text-sm text-gray-900 text-right font-mono">{Number(it.qtyRequested ?? 0)}</td>
                                            {showEstPrice && (
                                                <td className="px-6 py-3 text-sm text-gray-900 text-right font-mono">
                                                    <Money value={fromMinor(BigInt(it.amountMinor ?? 0))} />
                                                </td>
                                            )}
                                        </tr>
                                    ))}
                                </React.Fragment>
                            ))}
                        </tbody>
                        {showEstPrice && (
                            <tfoot className="bg-gray-50">
                                <tr>
                                    <td colSpan={3} className="px-6 py-4 text-sm font-bold text-gray-900 text-right">Total Estimated Cost</td>
                                    <td className="px-6 py-4 text-sm font-bold text-gray-900 text-right">
                                        <Money value={grand} />
                                    </td>
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            </Card>

            {req.status === 'DRAFT' && (
                <div className="rounded-xl bg-blue-50 border border-blue-100 p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex gap-4">
                        <div className="p-2 bg-blue-100 rounded-lg text-blue-600">
                             <CheckCircleIcon className="h-6 w-6" />
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-blue-900">Ready to Submit?</h3>
                            <p className="text-sm text-blue-700 mt-1">
                                Review the items above. Once submitted, this requisition will be sent to Procurement for processing.
                            </p>
                        </div>
                    </div>
                    {canSubmit ? (
                        <form action={submitRequisitionToProcurement.bind(null, requisitionId)}>
                            <SubmitButton
                                className="inline-flex items-center justify-center gap-2 rounded-lg bg-orange-600 px-6 py-3 text-sm font-bold text-white shadow-md transition-all hover:bg-orange-700 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2"
                                loadingText="Submitting..."
                            >
                                Submit Requisition
                            </SubmitButton>
                        </form>
                    ) : (
                        <div className="px-4 py-2 bg-white/50 rounded-lg text-sm text-blue-800 font-medium border border-blue-200">
                            Waiting for Project Manager approval
                        </div>
                    )}
                </div>
            )}
        </div>

        {/* Sidebar Info */}
        <div className="space-y-6">
            <Card className="border-gray-200 shadow-sm">
                <CardHeader className="pb-3">
                    <CardTitle className="text-base font-bold">Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div>
                        <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Status</div>
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide ring-1 ring-inset ${
                          req.status === 'APPROVED' ? 'bg-green-50 text-green-700 ring-green-600/20' :
                          req.status === 'REJECTED' ? 'bg-red-50 text-red-700 ring-red-600/20' :
                          req.status === 'SUBMITTED' ? 'bg-blue-50 text-blue-700 ring-blue-600/20' :
                          'bg-gray-100 text-gray-600 ring-gray-500/10'
                        }`}>
                          {req.status}
                        </span>
                    </div>

                    <div>
                         <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                            <UserIcon className="h-3 w-3" /> Created By
                         </div>
                         <div className="text-sm font-medium text-gray-900">{req.submittedBy?.name || 'Unknown'}</div>
                    </div>

                    <div>
                         <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                            <CalendarIcon className="h-3 w-3" /> Date
                         </div>
                         <div className="text-sm font-medium text-gray-900">
                            {new Date(req.createdAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                         </div>
                    </div>

                    <div className="pt-4 border-t border-gray-100">
                        <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Project</div>
                        <div className="text-sm font-semibold text-gray-900">{req.project?.projectNumber || 'No Number'}</div>
                    </div>
                </CardContent>
            </Card>
        </div>
      </div>
    </div>
  );
}
