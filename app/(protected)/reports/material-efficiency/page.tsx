import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeftIcon,
  ScaleIcon
} from '@heroicons/react/24/outline';
import PrintHeader from '@/components/PrintHeader';
import PrintButton from '@/components/PrintButton';
import Money from '@/components/Money';

export default async function GlobalMaterialEfficiencyPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const allowedRoles = ['ADMIN', 'MANAGING_DIRECTOR', 'PROJECT_OPERATIONS_OFFICER', 'ACCOUNTING_CLERK', 'ACCOUNTING_OFFICER', 'ACCOUNTS'];
  if (!allowedRoles.includes(user.role)) return redirect('/reports');

  // Filter Logic
  const projectWhere = user.role === 'PROJECT_OPERATIONS_OFFICER' 
      ? { assignedToId: user.id } 
      : {};

  const requisitions = await prisma.procurementRequisition.findMany({
    where: {
        project: projectWhere
    },
    include: {
      items: {
          select: {
              qtyRequested: true,
              amountMinor: true
          }
      },
      submittedBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      project: { select: { name: true } }
    },
  });

  type UserStat = {
      id: string;
      name: string;
      reqCount: number;
      totalItems: number;
      totalValueMinor: bigint;
  };

  const userStats = new Map<string, UserStat>();

  requisitions.forEach(req => {
      const u = req.submittedBy;
      const userId = u?.id || 'unknown';
      const userName = u?.name || u?.email || 'Unknown User';

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
      if (a.totalValueMinor > b.totalValueMinor) return -1;
      if (a.totalValueMinor < b.totalValueMinor) return 1;
      return 0;
  });

  const topSpender = rankedUsers.length > 0 ? rankedUsers[0] : null;

  return (
    <div className="p-6 space-y-8 max-w-[1400px] mx-auto bg-gray-50 min-h-screen">
      <PrintHeader />
      
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200 pb-6">
        <div>
           <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center rounded-md bg-orange-100 px-2 py-1 text-xs font-medium text-orange-700 ring-1 ring-inset ring-orange-700/10">
                Global Report
              </span>
           </div>
           <h1 className="text-3xl font-bold tracking-tight text-gray-900">
              Material Efficiency (Global)
           </h1>
           <p className="text-gray-500 mt-2">
             {user.role === 'PROJECT_OPERATIONS_OFFICER' 
                  ? 'Requisition analysis across your assigned projects.'
                  : 'Organization-wide requisition analysis across all projects.'}
           </p>
        </div>
        <div className="flex items-center gap-3">
            <Link
              href={`/reports`}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 hover:text-gray-900 transition-all"
            >
              <ArrowLeftIcon className="h-4 w-4" />
              Reports Center
            </Link>
            <PrintButton />
        </div>
      </div>

       {/* Top Spender Card */}
       {topSpender && (
          <div className="bg-white rounded-xl border border-orange-200 bg-orange-50/30 p-6 flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                  <div className="h-16 w-16 rounded-full bg-orange-100 flex items-center justify-center text-orange-600">
                      <ScaleIcon className="h-8 w-8" />
                  </div>
                  <div>
                      <h3 className="text-lg font-semibold text-gray-900">Top Spender (Global)</h3>
                      <p className="text-gray-500">Employee with highest requisition value</p>
                  </div>
              </div>
              <div className="text-right">
                  <div className="text-2xl font-bold text-gray-900">{topSpender.name}</div>
                  <div className="text-orange-600 font-medium font-mono text-lg">
                      <Money amount={topSpender.totalValueMinor} />
                  </div>
                  <div className="text-xs text-gray-500 mt-1">{topSpender.reqCount} requisitions</div>
              </div>
          </div>
      )}

      {rankedUsers.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border border-gray-200 border-dashed">
              <ScaleIcon className="mx-auto h-12 w-12 text-gray-300" />
              <h3 className="mt-2 text-sm font-semibold text-gray-900">No Data</h3>
              <p className="mt-1 text-sm text-gray-500">No requisitions found.</p>
          </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                    <tr>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Employee</th>
                        <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Requisitions</th>
                        <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total Items</th>
                        <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total Value</th>
                        <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Avg Value / Req</th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {rankedUsers.map((stat, idx) => (
                        <tr key={stat.id} className="hover:bg-gray-50 transition-colors">
                             <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center gap-3">
                                    <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold ${idx === 0 ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-600'}`}>
                                        {idx + 1}
                                    </div>
                                    <span className="font-medium text-gray-900">{stat.name}</span>
                                </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-500">
                                {stat.reqCount}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-500">
                                {stat.totalItems}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-gray-900">
                                <Money amount={stat.totalValueMinor} />
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-500">
                                <Money amount={stat.totalValueMinor / BigInt(stat.reqCount || 1)} />
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
      )}
    </div>
  );
}
