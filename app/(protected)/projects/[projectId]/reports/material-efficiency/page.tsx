// app/(protected)/projects/[projectId]/reports/material-efficiency/page.tsx
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeftIcon,
  ScaleIcon,
  CurrencyDollarIcon,
  ShoppingCartIcon
} from '@heroicons/react/24/outline';
import PrintHeader from '@/components/PrintHeader';
import PrintButton from '@/components/PrintButton';
import Money from '@/components/Money';

export default async function MaterialEfficiencyPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      name: true,
      quote: {
        select: {
           customer: { select: { displayName: true } }
        }
      }
    }
  });

  if (!project) return notFound();

  // Fetch Requisitions with Items and SubmittedBy
  const requisitions = await prisma.procurementRequisition.findMany({
    where: { projectId },
    include: {
      submittedBy: {
        select: {
          id: true,
          name: true,
          email: true
        }
      },
      items: true
    }
  });

  // Aggregate Stats per User
  const userStats = new Map<string, {
      id: string;
      name: string;
      reqCount: number;
      totalItems: number;
      totalValueMinor: bigint;
  }>();

  requisitions.forEach(req => {
      const user = req.submittedBy;
      const userId = user?.id || 'unknown';
      const userName = user?.name || user?.email || 'Unknown User';

      if (!userStats.has(userId)) {
          userStats.set(userId, {
              id: userId,
              name: userName,
              reqCount: 0,
              totalItems: 0,
              totalValueMinor: BigInt(0)
          });
      }

      const stats = userStats.get(userId)!;
      stats.reqCount++;
      
      let reqValue = BigInt(0);
      let reqItems = 0;

      req.items.forEach(item => {
          reqValue += item.amountMinor;
          reqItems += (item.qtyRequested || 0);
      });

      stats.totalValueMinor += reqValue;
      stats.totalItems += reqItems;
  });

  const rankedUsers = Array.from(userStats.values()).sort((a, b) => {
      // Sort by Value Descending
      if (a.totalValueMinor > b.totalValueMinor) return -1;
      if (a.totalValueMinor < b.totalValueMinor) return 1;
      return 0;
  });

  return (
    <div className="p-6 space-y-8 max-w-[1400px] mx-auto bg-gray-50 min-h-screen">
      <PrintHeader />
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200 pb-6">
        <div>
           <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center rounded-md bg-orange-100 px-2 py-1 text-xs font-medium text-orange-700 ring-1 ring-inset ring-orange-700/10">
                Performance Metrics
              </span>
           </div>
           <h1 className="text-3xl font-bold tracking-tight text-gray-900">
              Material Efficiency
           </h1>
           <p className="text-gray-500 mt-2">
              Requisition spending analysis by employee for 
              <span className="font-semibold text-gray-900 ml-1">{project.quote?.customer?.displayName || project.name}</span>.
           </p>
        </div>
        <div className="flex items-center gap-3">
            <Link
              href={`/projects/${projectId}/reports`}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 hover:text-gray-900 transition-all"
            >
              <ArrowLeftIcon className="h-4 w-4" />
              Back to Reports
            </Link>
            <PrintButton />
        </div>
      </div>

      {rankedUsers.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border border-gray-200 border-dashed">
              <ScaleIcon className="mx-auto h-12 w-12 text-gray-300" />
              <h3 className="mt-2 text-sm font-semibold text-gray-900">No Requisitions Found</h3>
              <p className="mt-1 text-sm text-gray-500">No material requisitions have been submitted for this project yet.</p>
          </div>
      ) : (
        <div className="space-y-6">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Requester</th>
                            <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Requisitions Submitted</th>
                            <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total Items Requested</th>
                            <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total Spend (Est.)</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider pl-8">Indicator</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {rankedUsers.map((user, idx) => {
                            return (
                                <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center">
                                            <div className="h-8 w-8 rounded-full bg-orange-100 flex items-center justify-center text-orange-700 font-bold text-xs ring-2 ring-white">
                                                {user.name.charAt(0)}
                                            </div>
                                            <div className="ml-4">
                                                <div className="text-sm font-medium text-gray-900">{user.name}</div>
                                                {idx === 0 && (
                                                    <span className="inline-flex items-center rounded-md bg-orange-50 px-1.5 py-0.5 text-xs font-medium text-orange-700 ring-1 ring-inset ring-orange-600/20 mt-0.5">
                                                        Top Spender
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-500">
                                        <div className="flex items-center justify-end gap-1">
                                            <ShoppingCartIcon className="h-4 w-4 text-gray-400" />
                                            {user.reqCount}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-500">
                                        {user.totalItems.toFixed(2)} units
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-semibold text-gray-900">
                                        <Money minor={user.totalValueMinor} />
                                    </td>
                                     <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 pl-8">
                                        {idx === 0 ? (
                                            <span className="text-orange-600 flex items-center gap-1 text-xs">
                                                <CurrencyDollarIcon className="h-4 w-4" />
                                                High Usage
                                            </span>
                                        ) : (
                                            <span className="text-gray-400 text-xs">Normal</span>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 text-sm text-blue-700">
                <strong>Note:</strong> High values indicate the primary requester for materials. Cross-reference with completed tasks to determine efficiency.
            </div>
        </div>
      )}
    </div>
  );
}
