import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { SearchInput } from '@/components/ui/search-input';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function PaymentHistoryProjectsPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (!['PROJECT_COORDINATOR'].includes(user.role)) redirect('/dashboard');

  const { q } = (await searchParams) ?? {};
  const where: any = q
    ? {
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { projectNumber: { contains: q, mode: 'insensitive' } },
          { quote: { customer: { displayName: { contains: q, mode: 'insensitive' } } } },
        ],
      }
    : {};

  const projects = await prisma.project.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      projectNumber: true,
      quote: { select: { customer: { select: { displayName: true } } } },
    },
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Payment History</h1>
          <p className="text-sm text-gray-600 mt-1">Select a project to view customer payment history.</p>
        </div>
        <SearchInput placeholder="Search projects or customers..." className="w-80" />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">Project</th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">Customer</th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">Ref</th>
                <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-600">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {projects.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{p.name}</td>
                  <td className="px-6 py-4 text-sm text-gray-700">{p.quote?.customer?.displayName || '-'}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{p.projectNumber || p.id.slice(0, 8)}</td>
                  <td className="px-6 py-4 text-right">
                    <Link
                      href={`/reports/payment-history/${p.id}`}
                      className="inline-flex items-center rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"
                    >
                      History
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

