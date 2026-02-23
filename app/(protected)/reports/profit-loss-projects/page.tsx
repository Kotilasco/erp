import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import PrintHeader from '@/components/PrintHeader';
import ReportsProjectList from '../ReportsProjectList';
import { ChartPieIcon } from '@heroicons/react/24/outline';
import { prisma } from '@/lib/db';
import { SearchInput } from '@/components/ui/search-input';
import TablePagination from '@/components/ui/table-pagination';

export default async function ProfitLossProjectsPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string; page?: string; pageSize?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  // Match Material Reconciliation listing pattern and role guard
  const allowedRoles = ['PROJECT_COORDINATOR', 'ADMIN', 'MANAGING_DIRECTOR', 'ACCOUNTS', 'ACCOUNTING_CLERK', 'ACCOUNTING_OFFICER', 'ACCOUNTING_AUDITOR'];
  if (!allowedRoles.includes(user.role!)) return redirect('/reports');

  const { q, page: pageParam, pageSize: pageSizeParam } = (await searchParams) ?? {};
  const currentPage = parseInt(pageParam || '1', 10);
  const pageSize = parseInt(pageSizeParam || '20', 10);
  const skip = (currentPage - 1) * pageSize;

  // Build where based on role and search
  const role = user.role || 'VIEWER';
  const isProjectManager = role === 'PROJECT_OPERATIONS_OFFICER';
  const isForeman = role === 'FOREMAN';

  const baseWhere: any = {};
  if (isProjectManager) {
    baseWhere.assignedToId = user.id;
    baseWhere.schedules = { status: 'ACTIVE' };
  } else if (isForeman) {
    baseWhere.schedules = { items: { some: { assignees: { some: { userId: user.id } } } }, status: 'ACTIVE' };
  } else {
    baseWhere.status = { in: ['PLANNED', 'PREPARING', 'READY', 'ONGOING', 'ON_HOLD', 'SCHEDULING_PENDING'] };
  }

  const where = q
    ? {
        ...baseWhere,
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { projectNumber: { contains: q, mode: 'insensitive' } },
          { quote: { customer: { displayName: { contains: q, mode: 'insensitive' } } } },
        ],
      }
    : baseWhere;

  const [rows, totalItems] = await Promise.all([
    prisma.project.findMany({
      where,
      select: {
        id: true,
        name: true,
        status: true,
        office: true,
        quote: { select: { customer: { select: { displayName: true } } } },
      },
      orderBy: { name: 'asc' },
      take: pageSize,
      skip,
    }),
    prisma.project.count({ where }),
  ]);

  const projects = rows.map((p) => ({
    id: p.id,
    name: p.name,
    client: p.quote?.customer?.displayName || 'Unknown Client',
    location: p.office || 'N/A',
    status: p.status,
  }));

  return (
    <div className="p-6 space-y-8 max-w-[1600px] mx-auto min-h-screen">
      <PrintHeader />

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-flex items-center rounded-md bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700 ring-1 ring-inset ring-indigo-700/10">
              Project Financials
            </span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 flex items-center gap-3">
            <ChartPieIcon className="h-8 w-8 text-gray-400" />
            Profit and Loss
          </h1>
          <p className="text-gray-500 mt-2">
            Select a project to view its profit and loss breakdown.
          </p>
        </div>
        <SearchInput placeholder="Search projects or customers..." className="w-80" />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <ReportsProjectList projects={projects} viewPath="reports/profit-loss" />
        <TablePagination currentPage={currentPage} pageSize={pageSize} totalItems={totalItems} />
      </div>
    </div>
  );
}
