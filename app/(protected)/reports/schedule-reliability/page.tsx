import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeftIcon,
  CalendarDaysIcon,
  ExclamationTriangleIcon,
  CheckBadgeIcon,
  ClockIcon
} from '@heroicons/react/24/outline';
import PrintHeader from '@/components/PrintHeader';
import PrintButton from '@/components/PrintButton';

export default async function GlobalScheduleReliabilityPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const allowedRoles = ['ADMIN', 'MANAGING_DIRECTOR', 'PROJECT_OPERATIONS_OFFICER', 'ACCOUNTING_CLERK', 'ACCOUNTING_OFFICER', 'ACCOUNTS'];
  if (!allowedRoles.includes(user.role)) return redirect('/reports');

  // Filter Logic
  const projectWhere = user.role === 'PROJECT_OPERATIONS_OFFICER' 
      ? { assignedToId: user.id } 
      : {};

  const schedules = await prisma.schedule.findMany({
    where: {
        project: projectWhere
    },
    include: {
        items: {
            include: {
                assignees: true
            }
        },
        project: { select: { name: true }}
    }
  });

  type EmpStats = {
      id: string;
      name: string;
      role: string;
      totalAssigned: number;
      completedOnTime: number;
      completedLate: number;
      activeOverdue: number;
      activeOnTrack: number;
  };

  const employeeStats = new Map<string, EmpStats>();
  const now = new Date();

  schedules.forEach(schedule => {
      schedule.items.forEach(item => {
           const isDone = item.status === 'DONE';
           const isOverdue = !isDone && item.plannedEnd && new Date(item.plannedEnd) < now;
           // Determine if completed late using updateAt as proxy for completion time
           // Note: This relies on updatedAt being the completion time, which is generally true for the last action.
           const wasLate = isDone && item.plannedEnd && new Date(item.updatedAt) > new Date(item.plannedEnd);
           
           item.assignees.forEach(emp => {
                const name = [emp.givenName, emp.surname].filter(Boolean).join(' ') || 'Unknown';
                if (!employeeStats.has(emp.id)) {
                    employeeStats.set(emp.id, {
                        id: emp.id,
                        name,
                        role: emp.role,
                        totalAssigned: 0,
                        completedOnTime: 0,
                        completedLate: 0,
                        activeOverdue: 0,
                        activeOnTrack: 0
                    });
                }
                const stats = employeeStats.get(emp.id)!;
                stats.totalAssigned++;

                if (isDone) {
                    if (wasLate) {
                        stats.completedLate++;
                    } else {
                        stats.completedOnTime++;
                    }
                } else if (isOverdue) {
                    stats.activeOverdue++;
                } else {
                    stats.activeOnTrack++;
                }
           });
      });
  });

  const reliabilityRanked = Array.from(employeeStats.values()).sort((a, b) => b.completedOnTime - a.completedOnTime);

  return (
    <div className="p-6 space-y-8 max-w-[1400px] mx-auto bg-gray-50 min-h-screen">
      <PrintHeader />
      
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200 pb-6">
        <div>
           <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center rounded-md bg-rose-100 px-2 py-1 text-xs font-medium text-rose-700 ring-1 ring-inset ring-rose-700/10">
                Global Report
              </span>
           </div>
           <h1 className="text-3xl font-bold tracking-tight text-gray-900">
              Schedule Reliability (Global)
           </h1>
           <p className="text-gray-500 mt-2">
             {user.role === 'PROJECT_OPERATIONS_OFFICER' 
                  ? 'Task completion tracking across your assigned projects.'
                  : 'Organization-wide task completion analysis across all projects.'}
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

      {reliabilityRanked.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border border-gray-200 border-dashed">
              <CalendarDaysIcon className="mx-auto h-12 w-12 text-gray-300" />
              <h3 className="mt-2 text-sm font-semibold text-gray-900">No Data Found</h3>
              <p className="mt-1 text-sm text-gray-500">No schedules or assigned employees found.</p>
          </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
             <div className="overflow-x-auto">
             <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                    <tr>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Employee</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                        <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Total Tasks</th>
                        <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">On Time</th>
                        <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Late Finish</th>
                        <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Active Overdue</th>
                        <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Reliability</th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {reliabilityRanked.map((stat, idx) => {
                        const hasOverdue = stat.activeOverdue > 0;
                        const hasLate = stat.completedLate > 0;
                        
                        // Calculate reliability score: (OnTime / (Total - ActiveOnTrack)) * 100? 
                        // Or just simple % of completed items?
                        // Let's keep simpler status column but specifically calculate 'Reliability'
                        const closed = stat.completedOnTime + stat.completedLate;
                        const reliability = closed > 0 ? Math.round((stat.completedOnTime / closed) * 100) : 100;

                        return (
                            <tr key={stat.id} className="hover:bg-gray-50 transition-colors">
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="flex items-center gap-3">
                                        <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 font-bold text-xs">
                                            {stat.name.charAt(0)}
                                        </div>
                                        <span className="font-medium text-gray-900">{stat.name}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-800">
                                        {stat.role.replace(/_/g, ' ')}
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-500">
                                    {stat.totalAssigned}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-emerald-600 font-bold">
                                    {stat.completedOnTime}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-amber-600 font-bold">
                                    {stat.completedLate > 0 ? stat.completedLate : '-'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-bold">
                                    <span className={stat.activeOverdue > 0 ? 'text-rose-600' : 'text-gray-400'}>
                                        {stat.activeOverdue > 0 ? stat.activeOverdue : '-'}
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-center">
                                     <div className="flex items-center justify-center gap-2">
                                        {reliability < 70 ? (
                                             <ExclamationTriangleIcon className="h-5 w-5 text-amber-500" title="Low Reliability" />
                                        ) : (
                                            <CheckBadgeIcon className="h-5 w-5 text-emerald-500" title="High Reliability" />
                                        )}
                                        <span className={`text-sm font-bold ${reliability < 70 ? 'text-amber-600' : 'text-emerald-700'}`}>
                                            {reliability}%
                                        </span>
                                        {hasOverdue && (
                                            <span className="inline-flex items-center rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-medium text-rose-700 border border-rose-100">
                                                Overdue
                                            </span>
                                        )}
                                     </div>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
             </table>
             </div>
        </div>
      )}
    </div>
  );
}
