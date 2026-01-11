'use server';

import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import Link from 'next/link';
import { Prisma } from '@prisma/client';
import EmployeesTableToolbar from './components/EmployeesTableToolbar';
import TablePagination from '@/components/ui/table-pagination';
import { UserPlusIcon, UserGroupIcon, BuildingOfficeIcon } from '@heroicons/react/24/outline';

function canManage(role: string | null | undefined) {
  return ['ADMIN', 'MANAGING_DIRECTOR', 'PROJECT_OPERATIONS_OFFICER'].includes(role || '');
}

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; pageSize?: string }>;
}) {
  const me = await getCurrentUser();
  if (!me) return <div className="p-6">Auth required</div>;
  if (!canManage(me.role)) return <div className="p-6">Not authorized</div>;

  const resolved = await searchParams;
  const q = (resolved.q ?? '').trim();
  const page = Math.max(1, Number(resolved.page ?? '1'));
  const pageSize = Math.max(1, Number(resolved.pageSize ?? '20'));

  const where: Prisma.EmployeeWhereInput = q
    ? {
        OR: [
          { givenName: { contains: q, mode: 'insensitive' } },
          { surname: { contains: q, mode: 'insensitive' } },
          { role: { contains: q, mode: 'insensitive' } },
          { office: { contains: q, mode: 'insensitive' } },
        ],
      }
    : {};

  const [employees, total] = await Promise.all([
    prisma.employee.findMany({
      where,
      orderBy: [{ role: 'asc' }, { givenName: 'asc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        user: { select: { email: true, role: true } },
        scheduleItems: {
          select: {
            id: true,
            schedule: { select: { projectId: true } },
          },
        },
      },
    }),
    prisma.employee.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-8 p-2 sm:p-4 max-w-7xl mx-auto">
      {/* Header Section */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b border-gray-200 pb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg dark:bg-blue-900/30">
            <UserGroupIcon className="h-8 w-8 text-barmlo-blue dark:text-blue-400" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">Employees</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Manage worker accounts and access levels.
            </p>
          </div>
        </div>
        <Link
          href="/employees/add"
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-bold text-white shadow-md transition-all hover:bg-orange-600 hover:shadow-lg hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 active:scale-95"
        >
          <UserPlusIcon className="h-5 w-5 stroke-2" />
          Add Employee
        </Link>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden dark:border-gray-700 dark:bg-gray-800">
        <div className="p-4 border-b border-gray-100 dark:border-gray-700">
             <EmployeesTableToolbar />
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50/80 backdrop-blur-sm dark:bg-gray-900/50">
              <tr>
                <th scope="col" className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Employee</th>
                <th scope="col" className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Role & Office</th>
                <th scope="col" className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Contact</th>
                <th scope="col" className="px-6 py-4 text-center text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Active Jobs</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-800">
              {employees.length === 0 ? (
                <tr>
                   <td className="px-6 py-12 text-center text-gray-500 dark:text-gray-400" colSpan={4}>
                      <div className="flex flex-col items-center justify-center gap-2">
                        <UserGroupIcon className="h-10 w-10 text-gray-300" />
                        <p className="text-base font-medium">No employees found</p>
                        <p className="text-sm">Try adjusting your search or add a new employee above.</p>
                      </div>
                   </td>
                </tr>
              ) : (
                employees.map((e) => {
                  const uniqueProjects = new Set(e.scheduleItems.map((si) => si.schedule.projectId));
                  const initials = `${e.givenName?.[0] || ''}${e.surname?.[0] || ''}`.toUpperCase();
                  
                  return (
                    <tr key={e.id} className="group hover:bg-blue-50/30 transition-colors dark:hover:bg-gray-700/50">
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                            <div className="h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 font-bold mr-4 border-2 border-white shadow-sm group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors">
                                {initials}
                            </div>
                            <div>
                                <div className="font-semibold text-gray-900 dark:text-gray-100 text-base">
                                    {e.givenName} {e.surname}
                                </div>
                                <div className="text-xs text-gray-500">{e.email}</div>
                            </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1.5 items-start">
                             <span className="inline-flex items-center rounded-md bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10 dark:bg-blue-400/10 dark:text-blue-400 dark:ring-blue-400/30">
                                {e.role || 'Unassigned'}
                             </span>
                             {e.office && (
                                <span className="text-xs text-gray-500 flex items-center gap-1.5 ml-0.5">
                                    <BuildingOfficeIcon className="h-3.5 w-3.5" />
                                    {e.office}
                                </span>
                             )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                         <div className="text-sm text-gray-600 dark:text-gray-300 font-mono">
                            {e.phone || '-'}
                         </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex items-center justify-center rounded-full px-3 py-1 text-xs font-medium ${uniqueProjects.size > 0 ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'}`}>
                            {uniqueProjects.size} Projects
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {total > 0 && (
          <div className="border-t border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-800/50">
            <TablePagination
              currentPage={page}
              totalPages={totalPages}
              totalItems={total}
              pageSize={pageSize}
            />
          </div>
        )}
      </div>
    </div>
  );
}
