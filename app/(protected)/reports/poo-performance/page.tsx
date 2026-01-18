import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getBulkPnL, PnLSummary } from '@/lib/profit-loss';
import { toMinor } from '@/helpers/money';
import Money from '@/components/Money';
import PrintHeader from '@/components/PrintHeader';
import PrintButton from '@/components/PrintButton';

export const dynamic = 'force-dynamic';

export default async function PooPerformancePage() {
    const user = await getCurrentUser();
    if (!user) redirect('/login');

    const allowedRoles = ['ADMIN', 'MANAGING_DIRECTOR', 'PROJECT_COORDINATOR', 'GENERAL_MANAGER'];
    if (!allowedRoles.includes(user.role as string)) {
        return <div className="p-8 text-center text-red-600">Access Denied.</div>;
    }

    // 1. Fetch Users logic
    // We want Users who have the role PROJECT_OPERATIONS_OFFICER
    const poos = await prisma.user.findMany({
        where: { role: 'PROJECT_OPERATIONS_OFFICER' },
        select: { id: true, name: true, email: true }
    });

    if (poos.length === 0) {
        return <div className="p-8">No Project Operations Officers found.</div>;
    }

    // 2. Compute stats for each POO
    const stats = await Promise.all(poos.map(async (poo) => {
        // Find "Running" projects for this POO.
        // Running = Not Archived, Not Draft? Usually 'active' or valid status.
        // Assuming status 'IN_PROGRESS' or similar, or just not ARCHIVED/COMPLETED if those exist.
        // Based on other files, active projects usually exclude Cancelled/Lost.
        // Let's grab all that are assigned.
        
        // We will filter by the assignedToId field on Project (verified in schema relation name: ProjectAssignedTo)
        const where = {
            assignedToId: poo.id,
            status: { notIn: ['ARCHIVED', 'LOST', 'CANCELLED'] } // Only active/running
        };

        const { summary } = await getBulkPnL(where);
        const projectCount = await prisma.project.count({ where });

        return {
            ...poo,
            projectCount,
            summary
        };
    }));

    // Sort by Net Profit (descending)
    stats.sort((a, b) => Number(b.summary.netProfitLossMinor - a.summary.netProfitLossMinor));

    return (
        <div className="min-h-screen bg-slate-50 p-6 md:p-8 space-y-6 max-w-[1600px] mx-auto">
             <div className="flex justify-between items-center mb-6">
                 <div>
                    <h1 className="text-2xl font-bold text-gray-900">POO Performance Comparison</h1>
                    <p className="text-gray-500">Comparing financial performance of active projects assigned to each officer.</p>
                 </div>
                 <div className="flex gap-2">
                     <PrintButton />
                 </div>
             </div>

             <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-200">
                        <tr>
                            <th className="px-6 py-4">Officer Name</th>
                            <th className="px-6 py-4 text-center">Active Projects</th>
                            <th className="px-6 py-4 text-right">Contract Value</th>
                            <th className="px-6 py-4 text-right">Planning Var.</th>
                            <th className="px-6 py-4 text-right">Procurement Var.</th>
                            <th className="px-6 py-4 text-right">Usage Var.</th>
                            <th className="px-6 py-4 text-right font-bold text-gray-900">Net P&L</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {stats.map((s) => (
                            <tr key={s.id} className="hover:bg-gray-50">
                                <td className="px-6 py-4 font-medium text-gray-900">
                                    <div>{s.name}</div>
                                    <div className="text-xs text-gray-400 font-normal">{s.email}</div>
                                </td>
                                <td className="px-6 py-4 text-center">
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                        {s.projectCount}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-right text-gray-600">
                                    <Money minor={s.summary.contractValueMinor} />
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <VarianceCell value={s.summary.planningVarianceMinor} />
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <VarianceCell value={s.summary.procurementVarianceMinor} />
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <VarianceCell value={s.summary.usageVarianceMinor} />
                                </td>
                                <td className="px-6 py-4 text-right font-bold text-lg">
                                    <VarianceCell value={s.summary.netProfitLossMinor} />
                                </td>
                            </tr>
                        ))}
                        
                        {stats.length === 0 && (
                             <tr>
                                 <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                                     No data available.
                                 </td>
                             </tr>
                        )}
                    </tbody>
                </table>
             </div>
        </div>
    );
}

function VarianceCell({ value }: { value: bigint }) {
    const isPos = value >= 0;
    const isZero = value === 0n;
    if (isZero) return <span className="text-gray-400">-</span>;
    
    return (
        <span className={isPos ? 'text-emerald-600' : 'text-rose-600'}>
            {isPos ? '+' : ''}<Money minor={value} />
        </span>
    );
}
