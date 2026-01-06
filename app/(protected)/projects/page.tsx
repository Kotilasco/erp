import Link from 'next/link';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { assertRoles } from '@/lib/workflow';
import { redirect } from 'next/navigation';
import { WorkflowStatusBadge } from '@/components/ui/workflow-status-badge';

import { SearchInput } from '@/components/ui/search-input';
import PaymentsTableToolbar from './components/PaymentsTableToolbar';
import QuotePagination from '@/app/(protected)/quotes/components/QuotePagination';
import { Prisma } from '@prisma/client';
import { ProjectsFilter } from './components/ProjectsFilter';
import { ProjectViewButton } from './components/ProjectViewButton';

import { ProjectAssigner } from './project-assigner';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const DEFAULT_PAGE_SIZE = 20;

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; tab?: string; status?: string; start_date?: string }>;
}) {
  const me = await getCurrentUser();
  if (!me) return <div className="p-6 text-sm text-gray-600">Authentication required.</div>;

  try {
    assertRoles(
      me.role as any,
      [
        'ADMIN',
        'CLIENT',
        'VIEWER',
        'PROJECT_MANAGER',
        'SENIOR_PM',
        'PROCUREMENT',
        'SENIOR_PROCUREMENT',
        'SECURITY',
        'ACCOUNTS',
        'CASHIER',
        'ACCOUNTING_OFFICER',
        'ACCOUNTING_AUDITOR',
        'ACCOUNTING_CLERK',
        'DRIVER',
        'GENERAL_MANAGER',
        'MANAGING_DIRECTOR',
        'SALES_ACCOUNTS',
      ] as any
    );
  } catch {
    redirect('/dashboard');
  }

  const role = me.role as string;
  const isSeniorPM = ['SENIOR_PM', 'ADMIN', 'GENERAL_MANAGER', 'MANAGING_DIRECTOR'].includes(role);
  const isProjectManager = role === 'PROJECT_MANAGER';
  const isSalesAccounts = role === 'SALES_ACCOUNTS';

  const { q: query, page: pageParam, tab, status, start_date } = await searchParams;
  const currentPage = parseInt(pageParam || '1', 10);
  const pageSize = DEFAULT_PAGE_SIZE;
  const skip = (currentPage - 1) * pageSize;

  let currentTab = 'active';
  if (isSeniorPM) {
    currentTab = tab || 'assignment'; // Default tab for Senior PM
  } else if (isSalesAccounts) {
    currentTab = tab === 'all_payments' ? 'all_payments' : 'due_today';
  } else if (isProjectManager) {
    currentTab = tab || 'active';
  }

  const baseWhere: Prisma.ProjectWhereInput = {
    ...(query
      ? {
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { projectNumber: { contains: query, mode: 'insensitive' } },
            { quote: { customer: { displayName: { contains: query, mode: 'insensitive' } } } },
            { quote: { customer: { city: { contains: query, mode: 'insensitive' } } } },
          ],
        }
      : {}),
    // Delegation Filter for regular PMs:
    ...(isProjectManager ? { assignedToId: me.id } : {}),
  };
  
  // Apply Status Filter
  if (status) {
    baseWhere.status = status as any;
  }
  
  // Apply Date Filter
  if (start_date) {
    baseWhere.commenceOn = { gte: new Date(start_date) };
  }

  let where = baseWhere;

  // Specific Logic for tabs (mostly for Senior PM logic or Sales logic)
  // For standard "Projects" view, we use baseWhere.
  // We will keep the tab logic for Senior PM "Assignment" vs "Planning" if needed, 
  // but if user just wants "Projects" list, maybe we simplify?
  // User said: "for /projects let it be a table with a view button also filter by status and or start date."
  // I will preserve the tab structure for safety but render everything as a table.

  if (isSeniorPM) {
     if (currentTab === 'assignment') {
       where = { ...where, assignedToId: null, status: { notIn: ['CREATED','COMPLETED','CLOSED'] } };
     } else if (currentTab === 'unplanned') {
       where = { ...where, status: 'PLANNED', schedules: null };
     } else if (currentTab === 'planning') {
       where = { ...where, status: 'CREATED' };
     }
  }

  // Fetch Data
  const [projects, totalCount, projectManagers] = await Promise.all([
    prisma.project.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }],
      include: {
        quote: {
          select: {
            number: true,
            customer: { select: { displayName: true, city: true } },
            createdBy: { select: { name: true, email: true } },
          },
        },
        assignedTo: { select: { id: true, name: true, email: true } },
        // For Sales
        paymentSchedules: isSalesAccounts ? { select: { amountMinor: true, paidMinor: true, status: true, dueOn: true, label: true } } : false,
        clientPayments: isSalesAccounts ? { select: { amountMinor: true, type: true } } : false,
      },
      take: pageSize,
      skip,
    }),
    prisma.project.count({ where }),
    isSeniorPM
      ? prisma.user.findMany({ where: { role: 'PROJECT_MANAGER' }, select: { id: true, name: true } })
      : Promise.resolve([]),
  ]);

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Projects</h1>
            {!isSalesAccounts && !isSeniorPM && (
               <p className="mt-1 text-sm text-gray-600">Your assigned projects.</p>
            )}
            {isSeniorPM && (
               <p className="mt-1 text-sm text-gray-600">Manage all projects.</p>
            )}
          </div>
          <div className="flex flex-col sm:flex-row gap-4 items-end sm:items-center w-full sm:w-auto">
             <ProjectsFilter />
             <div className="w-full sm:w-72">
                <SearchInput placeholder="Search projects..." />
             </div>
          </div>
        </div>

        {/* Table View */}
        <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden">
             <div className="overflow-x-auto">
               <table className="min-w-full divide-y divide-gray-200">
                 <thead className="bg-gray-50">
                   <tr>
                     <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Ref</th>
                     <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Customer</th>
                     <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Location</th>
                     <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                     <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Start Date</th>
                     <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">PM</th>
                     <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Actions</th>
                   </tr>
                 </thead>
                 <tbody className="bg-white divide-y divide-gray-200">
                   {projects.length === 0 ? (
                     <tr>
                       <td colSpan={7} className="px-6 py-12 text-center text-sm text-gray-500">
                         No projects found matching your criteria.
                       </td>
                     </tr>
                   ) : (
                     projects.map((project) => (
                       <tr key={project.id} className="hover:bg-gray-50 transition-colors">
                         <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-600">
                           {project.projectNumber || project.id.slice(0, 8)}
                         </td>
                         <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                           {project.quote?.customer?.displayName || 'Unknown'}
                         </td>
                         <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                           {project.quote?.customer?.city || '-'}
                         </td>
                         <td className="px-6 py-4 whitespace-nowrap">
                           <WorkflowStatusBadge status={project.status} />
                         </td>
                         <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                           {project.commenceOn ? new Date(project.commenceOn).toLocaleDateString() : '-'}
                         </td>
                         <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                           {isSeniorPM ? (
                              <ProjectAssigner 
                                projectId={project.id} 
                                initialAssigneeId={project.assignedTo?.id} 
                                projectManagers={projectManagers as any}
                                variant="table"
                              />
                           ) : (
                              project.assignedTo?.name || '-'
                           )}
                         </td>
                         <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                           <ProjectViewButton projectId={project.id} />
                         </td>
                       </tr>
                     ))
                   )}
                 </tbody>
               </table>
             </div>
             <div className="px-4 py-4 border-t border-gray-200">
                <QuotePagination total={totalCount} currentPage={currentPage} pageSize={pageSize} />
             </div>
        </div>
      </div>
    </div>
  );
}
