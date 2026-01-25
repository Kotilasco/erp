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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  ArrowLeftIcon, 
  ShoppingCartIcon, 
  DocumentTextIcon, 
  CalendarIcon, 
  CheckCircleIcon,
  UserIcon,
  TagIcon,
  CurrencyDollarIcon
} from '@heroicons/react/24/outline';
import { format } from 'date-fns';

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
    <div className="min-h-screen bg-slate-50/50 pb-20 font-sans">
      <div className="mx-auto max-w-5xl px-6 pt-6 mb-4 no-print">
         <Link href={`/projects/${projectId}/requisitions`} className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
              <path fillRule="evenodd" d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z" clipRule="evenodd" />
            </svg>
            Back to Requisitions
         </Link>
      </div>

      <main className="mx-auto max-w-5xl px-6 lg:px-8">
        <div className="space-y-6">
          <div className="md:flex md:items-center md:justify-between">
            <div className="min-w-0 flex-1">
              <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:truncate sm:text-3xl sm:tracking-tight">
                {req.project?.name}
              </h2>
              <div className="mt-1 flex flex-col sm:mt-0 sm:flex-row sm:flex-wrap sm:space-x-6">
                 <div className="mt-2 flex items-center text-sm text-gray-500">
                    Requisition #{req.id.slice(0, 8)}
                 </div>
                 {req.submittedBy && (
                    <div className="mt-2 flex items-center text-sm text-gray-500">
                        Submitted by {req.submittedBy.name}
                    </div>
                 )}
              </div>
            </div>
            <div className="mt-4 flex md:ml-4 md:mt-0">
                 <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border ${
                  req.status === 'DRAFT' ? 'bg-gray-100 text-gray-800 border-gray-200' :
                  req.status === 'SUBMITTED' ? 'bg-blue-100 text-blue-800 border-blue-200' :
                  req.status === 'APPROVED' ? 'bg-green-100 text-green-800 border-green-200' :
                  'bg-gray-100 text-gray-800 border-gray-200'
                }`}>
                  {req.status}
                </span>
            </div>
          </div>

          <div className="bg-white shadow-sm ring-1 ring-gray-900/5 sm:rounded-xl overflow-hidden p-6">
            <div className="space-y-6">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Description</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 w-24">Unit</th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500 w-24">Qty</th>
                    {showEstPrice && <th scope="col" className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500 w-32">Est. Price</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {groupedItemEntries.map(([section, items]) => (
                    <React.Fragment key={section}>
                      <tr className="bg-gray-50/50">
                        <td colSpan={showEstPrice ? 4 : 3} className="px-6 py-2 text-xs font-bold text-gray-600 uppercase tracking-wider border-b border-gray-100">
                          {section}
                        </td>
                      </tr>
                      {items.map((it) => (
                        <tr key={it.id} className="group hover:bg-orange-50/30 transition-colors">
                          <td className="px-6 py-4 text-sm text-gray-700 font-medium group-hover:text-gray-900">
                            {it.description}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500">
                            {it.unit ?? '-'}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900 text-right font-mono font-medium">
                            {Number(it.qtyRequested ?? 0)}
                          </td>
                          {showEstPrice && (
                            <td className="px-6 py-4 text-sm text-gray-900 text-right font-mono">
                              <Money value={fromMinor(BigInt(it.amountMinor ?? 0))} />
                            </td>
                          )}
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}
                  {req.items.length === 0 && (
                    <tr>
                      <td colSpan={showEstPrice ? 4 : 3} className="px-6 py-12 text-center text-gray-500">
                        No items in this requisition.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {req.status === 'DRAFT' && (
              <div className="mt-8 rounded-xl bg-gray-50 border border-gray-200 p-6 no-print">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                  <div className="flex gap-4">
                    <div className="p-3 bg-white rounded-xl text-blue-600 shadow-sm ring-1 ring-blue-100">
                      <CheckCircleIcon className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">Ready to Submit?</h3>
                      <p className="text-sm text-gray-600 mt-1 max-w-md">
                        Review the items above. Once submitted, this requisition will be sent to Procurement for processing.
                      </p>
                    </div>
                  </div>
                  {canSubmit ? (
                    <form action={submitRequisitionToProcurement.bind(null, requisitionId)} className="w-full sm:w-auto">
                      <SubmitButton
                        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-lg bg-orange-600 px-6 py-3 text-sm font-bold text-white shadow-md transition-all hover:bg-orange-700 hover:shadow-lg hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2"
                        loadingText="Submitting..."
                      >
                        Submit Requisition
                      </SubmitButton>
                    </form>
                  ) : (
                    <div className="px-4 py-2 bg-white/60 rounded-lg text-sm text-blue-800 font-medium border border-blue-200 shadow-sm backdrop-blur-sm">
                      Waiting for Project Manager approval
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
    </div>
  );
}
