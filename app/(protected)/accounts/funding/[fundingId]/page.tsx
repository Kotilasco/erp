import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import Money from '@/components/Money';
import Link from 'next/link';
import clsx from 'clsx';
import { fromMinor } from '@/helpers/money';
import FundingDecisionActions from './FundingDecisionActions';
import {
  BuildingOffice2Icon,
  BuildingOfficeIcon,
  ClockIcon,
  CurrencyDollarIcon,
  DocumentTextIcon,
  FolderIcon,
  HashtagIcon,
  InformationCircleIcon,
  UserIcon,
  UsersIcon,
  CubeIcon,
  BeakerIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';

export default async function FundingRequestDetailPage({
  params,
}: {
  params: Promise<{ fundingId: string }>;
}) {
  const { fundingId } = await params;
  const user = await getCurrentUser();
  if (!user) return <div className="p-6 text-sm text-gray-600">Authentication required.</div>;

  const role = user.role ?? 'UNKNOWN';
  const canApprove =
    role === 'ACCOUNTING_OFFICER' ||
    role === 'ADMIN' ||
    role === 'ACCOUNTS' ||
    role === 'ACCOUNTING_CLERK' ||
    role === 'MANAGING_DIRECTOR';

  const funding = await prisma.fundingRequest.findUnique({
    where: { id: fundingId },
    include: {
      requisition: {
        include: {
          project: { include: { quote: { include: { customer: true } } } },
          items: true,
        },
      },
      approvedBy: { select: { name: true, email: true } },
      submittedBy: { select: { name: true, email: true } },
      requestedBy: { select: { name: true, email: true } },
    },
  });

  if (!funding) return <div className="p-6">Funding request not found.</div>;

  const req = funding.requisition!;
  const proj = req.project!;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Funding Request Details</h1>
        <Link href="/accounts" className="text-sm text-indigo-600 hover:underline">
          &larr; Back to Accounts
        </Link>
      </div>

      <div className="grid gap-6">
        <section className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
            <InformationCircleIcon className="h-5 w-5 text-indigo-600" />
            Request Information
          </h2>
          <div className="grid gap-x-12 gap-y-6 md:grid-cols-2 text-sm">
            <div className="space-y-4">
              <div className="flex justify-between items-center border-b border-gray-50 pb-2">
                <span className="flex items-center gap-2 text-gray-500">
                  <FolderIcon className="h-4 w-4 text-gray-400" />
                  Project:
                </span>
                <Link href={`/projects/${proj.id}`} className="text-indigo-600 hover:underline font-semibold bg-indigo-50 px-2 py-0.5 rounded">
                  {proj.projectNumber || proj.quote?.number || proj.id}
                </Link>
              </div>
              <div className="flex justify-between items-center border-b border-gray-50 pb-2">
                <span className="flex items-center gap-2 text-gray-500">
                  <UsersIcon className="h-4 w-4 text-gray-400" />
                  Customer:
                </span>
                <span className="font-medium text-gray-900">{proj.quote?.customer?.displayName || '—'}</span>
              </div>
              <div className="flex justify-between items-center border-b border-gray-50 pb-2">
                <span className="flex items-center gap-2 text-gray-500">
                  <BuildingOfficeIcon className="h-4 w-4 text-gray-400" />
                  Office:
                </span>
                <span className="font-medium text-gray-900">{proj.office || '—'}</span>
              </div>
              <div className="flex justify-between items-center border-b border-gray-50 pb-2">
                <span className="flex items-center gap-2 text-gray-500">
                  <DocumentTextIcon className="h-4 w-4 text-gray-400" />
                  Requisition ID:
                </span>
                <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded text-gray-700">{req.id}</span>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-center border-b border-gray-50 pb-2">
                <span className="flex items-center gap-2 text-gray-500">
                  <HashtagIcon className="h-4 w-4 text-gray-400" />
                  Request ID:
                </span>
                <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded text-gray-700">{funding.id}</span>
              </div>
              <div className="flex justify-between items-center border-b border-gray-50 pb-2">
                <span className="flex items-center gap-2 text-gray-500">
                  <InformationCircleIcon className="h-4 w-4 text-gray-400" />
                  Status:
                </span>
                <span
                  className={clsx(
                    'rounded-full px-2.5 py-0.5 text-xs font-semibold flex items-center gap-1',
                    funding.status === 'APPROVED' && 'bg-emerald-100 text-emerald-700',
                    funding.status === 'REJECTED' && 'bg-rose-100 text-rose-700',
                    (funding.status === 'PENDING' || funding.status === 'REQUESTED') && 'bg-amber-100 text-amber-700'
                  )}
                >
                  {funding.status}
                </span>
              </div>
              <div className="flex justify-between items-center border-b border-gray-50 pb-2">
                <span className="flex items-center gap-2 text-gray-500">
                  <CurrencyDollarIcon className="h-4 w-4 text-gray-400" />
                  Amount Requested:
                </span>
                <span className="font-bold text-lg text-gray-900 bg-gray-50 px-2 rounded">
                  <Money minor={funding.amountMinor} />
                </span>
              </div>
              <div className="flex justify-between items-center border-b border-gray-50 pb-2">
                <span className="flex items-center gap-2 text-gray-500">
                  <UserIcon className="h-4 w-4 text-gray-400" />
                  Requested By:
                </span>
                <span className="font-medium text-gray-900">{funding.requestedBy?.name ?? funding.requestedBy?.email ?? funding.submittedBy?.name ?? funding.submittedBy?.email ?? '—'}</span>
              </div>
              <div className="flex justify-between items-center border-b border-gray-50 pb-2">
                <span className="flex items-center gap-2 text-gray-500">
                  <ClockIcon className="h-4 w-4 text-gray-400" />
                  Requested At:
                </span>
                <span className="font-medium text-gray-900">{new Date(funding.requestedAt).toLocaleString()}</span>
              </div>
            </div>
          </div>
        </section>
      </div>

      <section className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
          <CubeIcon className="h-5 w-5 text-indigo-600" />
          Requisition Items
        </h2>
        <div className="overflow-hidden rounded-lg border border-gray-200">
          <table className="min-w-full text-sm divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">
                  <div className="flex items-center gap-1">
                    <CubeIcon className="h-4 w-4" /> Description
                  </div>
                </th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600">
                  <div className="flex items-center justify-end gap-1">
                    <HashtagIcon className="h-4 w-4" /> Qty
                  </div>
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">
                  <div className="flex items-center gap-1">
                    <BeakerIcon className="h-4 w-4" /> Unit
                  </div>
                </th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600">
                  <div className="flex items-center justify-end gap-1">
                    <CurrencyDollarIcon className="h-4 w-4" /> Est. Price
                  </div>
                </th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600">
                  <div className="flex items-center justify-end gap-1">
                    <CurrencyDollarIcon className="h-4 w-4" /> Total
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {req.items.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900">{item.description}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{item.qtyRequested ?? item.qty}</td>
                  <td className="px-4 py-3 text-left text-gray-500">{item.unit ?? '-'}</td>
                  <td className="px-4 py-3 text-right text-gray-700 font-mono">
                    <Money minor={item.requestedUnitPriceMinor ?? item.estPriceMinor} />
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900 font-mono">
                    <Money minor={item.amountMinor} />
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-50 font-semibold border-t border-gray-200">
              <tr>
                <td colSpan={4} className="px-4 py-3 text-right text-gray-700">Total Requested:</td>
                <td className="px-4 py-3 text-right text-lg text-indigo-700 font-bold font-mono">
                  <Money minor={funding.amountMinor} />
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      {canApprove && (funding.status === 'PENDING' || funding.status === 'REQUESTED') && (
        <section className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
            <CheckCircleIcon className="h-5 w-5 text-indigo-600" />
            Actions
          </h2>
          <FundingDecisionActions fundingId={funding.id} />
        </section>
      )}
    </div>
  );
}
