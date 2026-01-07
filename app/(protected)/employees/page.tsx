'use server';

import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import Link from 'next/link';
import { SearchInput } from '@/components/ui/search-input';
import { Prisma } from '@prisma/client';

function canManage(role: string | null | undefined) {
  return ['ADMIN', 'MANAGING_DIRECTOR', 'PROJECT_OPERATIONS_OFFICER'].includes(role || '');
}

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const me = await getCurrentUser();
  if (!me) return <div className="p-6">Auth required</div>;
  if (!canManage(me.role)) return <div className="p-6">Not authorized</div>;

  const { q: query } = await searchParams;
  const where: Prisma.EmployeeWhereInput = query
    ? {
        OR: [
          { givenName: { contains: query, mode: 'insensitive' } },
          { surname: { contains: query, mode: 'insensitive' } },
          { role: { contains: query, mode: 'insensitive' } },
          { office: { contains: query, mode: 'insensitive' } },
        ],
      }
    : {};

  const employees = await prisma.employee.findMany({
    where,
    orderBy: [{ role: 'asc' }, { givenName: 'asc' }],
    include: {
      user: { select: { email: true, role: true } },
      scheduleItems: {
        select: {
          id: true,
          schedule: { select: { projectId: true } },
        },
      },
    },
  });

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Employees</h1>
          <p className="text-sm text-gray-600">Manage worker accounts. Default password: Password01.</p>
        </div>
        <Link
          href="/employees/add"
          className="rounded bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-500"
        >
          Add employee
        </Link>
      </div>

      <div className="max-w-xs">
        <SearchInput placeholder="Search employees..." />
      </div>

      <div className="rounded-md border bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Name</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Role</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Office</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Phone</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Email</th>
                <th className="px-4 py-3 text-center font-medium text-gray-500">Jobs Assigned</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {employees.length === 0 ? (
                <tr>
                   <td className="px-4 py-8 text-center text-gray-500" colSpan={6}>No employees found.</td>
                </tr>
              ) : (
                employees.map((e) => {
                  const uniqueProjects = new Set(e.scheduleItems.map((si) => si.schedule.projectId));
                  return (
                    <tr key={e.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-gray-900">{`${e.givenName} ${e.surname ?? ''}`.trim()}</td>
                      <td className="px-4 py-3 text-gray-500">{e.role}</td>
                      <td className="px-4 py-3 text-gray-500">{e.office ?? '-'}</td>
                      <td className="px-4 py-3 text-gray-500">{e.phone ?? '-'}</td>
                      <td className="px-4 py-3 text-gray-500">{e.email}</td>
                      <td className="px-4 py-3 text-center text-gray-900">{uniqueProjects.size}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
