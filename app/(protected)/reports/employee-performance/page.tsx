import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeftIcon,
  UserGroupIcon
} from '@heroicons/react/24/outline';
import PrintHeader from '@/components/PrintHeader';
import PrintButton from '@/components/PrintButton';
// Import the shared view component. Note: Ideally this should be in /components, but reusing for speed.
import EmployeePerformanceView, { EmployeeStat } from '../../projects/[projectId]/reports/employee-performance/EmployeePerformanceView';

export default async function GlobalEmployeePerformancePage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  // Authorization Check
  const allowedRoles = ['ADMIN', 'MANAGING_DIRECTOR', 'PROJECT_OPERATIONS_OFFICER', 'ACCOUNTING_CLERK', 'ACCOUNTING_OFFICER', 'ACCOUNTS'];
  if (!allowedRoles.includes(user.role)) {
      return redirect('/reports'); // Or 403
  }

  // Define Filter: POO sees only assigned projects, others see all.
  const projectWhere = user.role === 'PROJECT_OPERATIONS_OFFICER' 
      ? { assignedToId: user.id } 
      : {};

  // Fetch Schedules from matching projects
  const schedules = await prisma.schedule.findMany({
    where: {
        project: projectWhere
    },
    include: {
      items: {
        include: {
          assignees: {
            select: {
              id: true,
              givenName: true,
              surname: true,
              role: true,
            },
          },
          reports: {
             select: {
                id: true,
                reporterId: true,
                reportedForDate: true
             }
          }
        },
      },
      project: {
          select: {
              name: true,
              quote: {
                  select: {
                      customer: {
                          select: {
                              displayName: true
                          }
                      }
                  }
              }
          }
      }
    },
  });

  // Aggregate Stats Globally
  let employees: EmployeeStat[] = [];
  const employeeStats = new Map<string, EmployeeStat>();

  schedules.forEach(schedule => {
      schedule.items.forEach(item => {
           // Track Assignees
           item.assignees.forEach(assignee => {
               const name = [assignee.givenName, assignee.surname].filter(Boolean).join(' ') || 'Unknown';
               if (!employeeStats.has(assignee.id)) {
                   employeeStats.set(assignee.id, {
                       id: assignee.id,
                       name,
                       role: assignee.role,
                       tasksAssigned: 0,
                       tasksCompleted: 0,
                       reportsSubmitted: 0,
                       lastActive: null
                   });
               }
               const stats = employeeStats.get(assignee.id)!;
               stats.tasksAssigned++;
               if (item.status === 'DONE') {
                   stats.tasksCompleted++;
               }
           });

           // Track Reporters
           item.reports.forEach(report => {
                if (employeeStats.has(report.reporterId)) {
                    const stats = employeeStats.get(report.reporterId)!;
                    stats.reportsSubmitted++;
                    const reportDate = new Date(report.reportedForDate);
                    if (!stats.lastActive || reportDate.toISOString() > stats.lastActive!) {
                        stats.lastActive = reportDate.toISOString();
                    }
                }
           });
      });
  });

  employees = Array.from(employeeStats.values()).sort((a, b) => b.tasksAssigned - a.tasksAssigned);

  return (
    <div className="p-6 space-y-8 max-w-[1400px] mx-auto bg-gray-50 min-h-screen">
      <PrintHeader />
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200 pb-6">
        <div>
           <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center rounded-md bg-teal-100 px-2 py-1 text-xs font-medium text-teal-700 ring-1 ring-inset ring-teal-700/10">
                Global Report
              </span>
           </div>
           <h1 className="text-3xl font-bold tracking-tight text-gray-900">
              Global Employee Performance
           </h1>
           <p className="text-gray-500 mt-2">
               {user.role === 'PROJECT_OPERATIONS_OFFICER' 
                  ? 'Performance metrics across your assigned projects.'
                  : 'Organization-wide performance metrics across all projects.'}
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

      {employees.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border border-gray-200 border-dashed">
              <UserGroupIcon className="mx-auto h-12 w-12 text-gray-300" />
              <h3 className="mt-2 text-sm font-semibold text-gray-900">No Data Found</h3>
              <p className="mt-1 text-sm text-gray-500">No active schedules or employees found in the selecting projects.</p>
          </div>
      ) : (
        <EmployeePerformanceView employees={employees} />
      )}
    </div>
  );
}
