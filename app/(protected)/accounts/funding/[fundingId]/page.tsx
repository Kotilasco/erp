import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import Money from '@/components/Money';
import Link from 'next/link';
import clsx from 'clsx';
import { fromMinor } from '@/helpers/money';
import PurchaseOrderHeader from '@/components/PurchaseOrderHeader';
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

  const itemsWithTotals = req.items.map((item) => {
    const qty = item.qtyRequested ?? item.qty ?? 0;
    const unitPrice = item.requestedUnitPriceMinor ?? item.estPriceMinor ?? BigInt(0);
    // Calculate total: qty * unitPrice
    // Handle floating point math safely by converting properly
    const totalMinor = BigInt(Math.round(qty * Number(unitPrice)));
    return { 
      ...item, 
      displayQty: qty, 
      displayUnitPrice: unitPrice, 
      calculatedTotalMinor: totalMinor 
    };
  });

  const grandTotalMinor = itemsWithTotals.reduce((acc, item) => acc + item.calculatedTotalMinor, BigInt(0));

  return (
    <div className="space-y-6 p-6 mx-auto max-w-7xl">
      <div className="flex items-center justify-end no-print">
        <Link href="/accounts" className="text-sm text-indigo-600 hover:underline">
          &larr; Back to Accounts
        </Link>
      </div>

      <div className="mb-6">
        <PurchaseOrderHeader
          customer={proj.quote?.customer ?? {}}
          project={proj}
          requisition={req}
          title="Funding Request"
        />
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
              {itemsWithTotals.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900">{item.description}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{item.displayQty}</td>
                  <td className="px-4 py-3 text-left text-gray-500">{item.unit ?? '-'}</td>
                  <td className="px-4 py-3 text-right text-gray-700 font-mono">
                    <Money minor={item.displayUnitPrice} />
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900 font-mono">
                    <Money minor={item.calculatedTotalMinor} />
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-50 font-semibold border-t border-gray-200">
              <tr>
                <td colSpan={4} className="px-4 py-3 text-right text-gray-700">Total Requested:</td>
                <td className="px-4 py-3 text-right text-lg text-indigo-700 font-bold font-mono">
                  <Money minor={grandTotalMinor} />
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
