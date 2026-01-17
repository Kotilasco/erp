// app/(protected)/projects/[projectId]/reports/schedule-reliability/page.tsx
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeftIcon,
  CalendarDaysIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationCircleIcon
} from '@heroicons/react/24/outline';
import PrintHeader from '@/components/PrintHeader';
import PrintButton from '@/components/PrintButton';

export default async function ScheduleReliabilityPage({
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

  // Fetch Schedule with Items and Assignees
  // We need to calculate availability and overdue tasks
  const schedule = await prisma.schedule.findUnique({
    where: { projectId },
    include: {
      items: {
          include: {
              assignees: true
          }
      }
    }
  });

  const now = new Date();

  // Aggregate Stats per Employee
  const employeeStats = new Map<string, {
      id: string;
      name: string;
      role: string;
      totalAssigned: number;
      completedOnTime: number; // Placeholder: Just counting done for now
      completedLate: number;   // Not tracked yet
      activeOverdue: number;
      activeOnTrack: number;
  }>();

  if (schedule) {
    schedule.items.forEach(item => {
        const isDone = item.status === 'DONE';
        const isOverdue = !isDone && item.plannedEnd && new Date(item.plannedEnd) < now;
        
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
                 stats.completedOnTime++; // Assuming done is good for now
             } else if (isOverdue) {
                 stats.activeOverdue++;
             } else {
                 stats.activeOnTrack++;
             }
        });
    });
  }

  const reliabilityRanked = Array.from(employeeStats.values()).sort((a, b) => b.completedOnTime - a.completedOnTime);

  return (
    <div className="p-6 space-y-8 max-w-[1400px] mx-auto bg-gray-50 min-h-screen">
      <PrintHeader />
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200 pb-6">
        <div>
           <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center rounded-md bg-rose-100 px-2 py-1 text-xs font-medium text-rose-700 ring-1 ring-inset ring-rose-700/10">
                Performance Metrics
              </span>
           </div>
           <h1 className="text-3xl font-bold tracking-tight text-gray-900">
              Schedule Reliability
           </h1>
           <p className="text-gray-500 mt-2">
              Task completion and deadline adherence analysis for 
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

      {reliabilityRanked.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border border-gray-200 border-dashed">
              <CalendarDaysIcon className="mx-auto h-12 w-12 text-gray-300" />
              <h3 className="mt-2 text-sm font-semibold text-gray-900">No Employees Assigned</h3>
              <p className="mt-1 text-sm text-gray-500">Assign employees to tasks to establish reliability metrics.</p>
          </div>
      ) : (
        <div className="space-y-6">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Employee</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                            <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total Tasks</th>
                            <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Completed</th>
                            <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider text-rose-600">Active Overdue</th>
                            <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider text-emerald-600">On Track</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider pl-8">Status</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {reliabilityRanked.map((emp) => {
                            return (
                                <tr key={emp.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center">
                                            <div className="h-8 w-8 rounded-full bg-rose-100 flex items-center justify-center text-rose-700 font-bold text-xs ring-2 ring-white">
                                                {emp.name.charAt(0)}
                                            </div>
                                            <div className="ml-4">
                                                <div className="text-sm font-medium text-gray-900">{emp.name}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-800">
                                            {emp.role.replace(/_/g, ' ')}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-500">
                                        {emp.totalAssigned}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-gray-900">
                                        {emp.completedOnTime}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-bold text-rose-600">
                                        {emp.activeOverdue > 0 ? (
                                            <div className="flex items-center justify-end gap-1">
                                                <ExclamationCircleIcon className="h-4 w-4" />
                                                {emp.activeOverdue}
                                            </div>
                                        ) : '-'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-emerald-600">
                                        {emp.activeOnTrack}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 pl-8">
                                        {emp.activeOverdue > 0 ? (
                                            <span className="inline-flex items-center rounded-md bg-rose-50 px-2 py-1 text-xs font-medium text-rose-700 ring-1 ring-inset ring-rose-600/20">
                                                Attention Needed
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center rounded-md bg-green-50 px-2 py-1 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20">
                                                Reliable
                                            </span>
                                        )}
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
