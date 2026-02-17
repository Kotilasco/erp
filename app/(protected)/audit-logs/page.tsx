import { getCurrentUser } from '@/lib/auth';
import { getAuditLogs, getAllUsers } from './actions';
import AuditLogsClient from './AuditLogsClient';

export default async function AuditLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const user = await getCurrentUser();

  if (!user || user.role !== 'ADMIN') {
    return (
      <div className="p-6">
        <div className="rounded border border-rose-200 bg-rose-50 p-4 text-rose-700">
          <h2 className="text-lg font-semibold">Access Denied</h2>
          <p className="mt-1 text-sm">You must be an administrator to view audit logs.</p>
        </div>
      </div>
    );
  }

  const { userId, method, path, dateFrom, dateTo, page } = await searchParams;

  const filters = {
    userId: typeof userId === 'string' ? userId : undefined,
    method: typeof method === 'string' ? method : undefined,
    path: typeof path === 'string' ? path : undefined,
    dateFrom: typeof dateFrom === 'string' ? dateFrom : undefined,
    dateTo: typeof dateTo === 'string' ? dateTo : undefined,
    page: typeof page === 'string' ? parseInt(page, 10) : 1,
  };

  const [logsData, users] = await Promise.all([
    getAuditLogs(filters),
    getAllUsers(),
  ]);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Audit Logs</h1>
        <div className="text-sm text-gray-600">
          Total: {logsData.totalCount} logs
        </div>
      </div>

      <AuditLogsClient
        initialLogs={logsData.logs}
        users={users}
        totalPages={logsData.totalPages}
        currentPage={logsData.page}
        totalCount={logsData.totalCount}
        initialFilters={filters}
      />
    </div>
  );
}
