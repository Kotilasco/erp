import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getEndOfDaySummaryData } from '@/app/(protected)/projects/actions';
import PrintHeader from '@/components/PrintHeader';
import PrintButton from '@/components/PrintButton';
import Link from 'next/link';
import {
  CalendarDaysIcon,
  ClipboardDocumentListIcon,
  MapPinIcon,
  UserGroupIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function EndOfDayReportPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const { date: dateParam } = await searchParams;
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const date = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : todayStr;

  const allowedRoles = ['PROJECT_COORDINATOR', 'PROJECT_OPERATIONS_OFFICER', 'PM_CLERK', 'ADMIN', 'MANAGING_DIRECTOR'];
  if (!allowedRoles.includes(user.role)) redirect('/reports');

  const summaries = await getEndOfDaySummaryData(date);

  const rows = summaries.map((summary: any) => {
    const reportingDate =
      summary.lastReportDate ? new Date(summary.lastReportDate) : null;
    const reportingDateLabel = reportingDate
      ? reportingDate.toLocaleDateString(undefined, {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })
      : null;

    return {
      id: summary.projectId,
      site: summary.location || '-',
      projectName: summary.projectName,
      workforceGroups: summary.workforceGroups ?? [],
      activity: summary.lastActivity,
      used: summary.materialsUsedSummary ?? '',
      balance: summary.materialsBalanceSummary ?? '',
      status: summary.status,
      reportingDate,
      reportingDateLabel,
    };
  });

  const sortedRows = rows.sort((a, b) => a.site.localeCompare(b.site));

  const headerDate = today.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="p-6 space-y-8 max-w-[1600px] mx-auto bg-slate-50 min-h-screen font-sans">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-gray-200 pb-6">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-700/10">
            <ClipboardDocumentListIcon className="h-4 w-4" />
            End Of Day
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 flex items-center gap-3">
            <CalendarDaysIcon className="h-8 w-8 text-emerald-600" />
            Projects Management End Of Day
          </h1>
          <p className="text-sm text-slate-600">
            Summary of workforce, activity, and status across all active projects for the selected date.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <form className="flex items-center gap-2" method="get">
            <label className="text-xs font-semibold text-gray-600 uppercase">Date</label>
            <input
              type="date"
              name="date"
              defaultValue={date}
              max={todayStr}
              className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-emerald-500 focus:ring-emerald-500"
            />
            <button
              type="submit"
              className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"
            >
              Apply
            </button>
          </form>
          <PrintButton />
          <Link
            href="/reports"
            className="hidden md:inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
          >
            Back to Reports
          </Link>
        </div>
      </div>

      {sortedRows.length === 0 ? (
        <div className="bg-white border border-dashed border-gray-300 rounded-3xl py-20 text-center">
          <CalendarDaysIcon className="mx-auto h-12 w-12 text-gray-300" />
          <h2 className="mt-4 text-lg font-semibold text-gray-900">No activity recorded for this date</h2>
          <p className="mt-2 text-sm text-gray-500 max-w-md mx-auto">
            There are no daily reports captured for the selected date across your active projects.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 pt-6 pb-4 border-b border-gray-200 bg-white space-y-4">
            <PrintHeader showOnScreen />
            <div className="space-y-1 text-left">
              <h2 className="text-sm font-extrabold tracking-wide text-gray-900 underline">
                PROJECTS MANAGEMENT END OF DAY UPDATE {headerDate}
              </h2>
              <p className="text-sm text-gray-900">
                From: <span className="font-extrabold">PROJECT MANAGEMENT</span>
              </p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-emerald-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-emerald-700">Site</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-emerald-700">
                    Workforce
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-emerald-700">
                    Activity
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-emerald-700">
                    Used
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-emerald-700">
                    Balance
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-emerald-700">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {sortedRows.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50 align-top">
                    <td className="px-4 py-3 text-gray-900">
                      <div className="flex items-start gap-2">
                        <MapPinIcon className="mt-0.5 h-4 w-4 text-emerald-600" />
                        <div>
                          <div className="font-semibold uppercase">{row.site}</div>
                          <div className="text-xs text-gray-500">{row.projectName}</div>
                          {row.reportingDateLabel && (
                            <div className="mt-1 text-left">
                              <div className="text-[11px] font-semibold text-emerald-700">
                                Last update:
                              </div>
                              <div className="mt-0.5 inline-flex items-center justify-start rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                                {row.reportingDateLabel}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-800 max-w-sm align-top">
                      <div className="flex items-start gap-2">
                        <UserGroupIcon className="mt-0.5 h-4 w-4 text-gray-400" />
                        <div className="text-xs leading-relaxed">
                          {Array.isArray(row.workforceGroups) && row.workforceGroups.length > 0 ? (
                            row.workforceGroups.map(
                              (group: { role: string; names: string[] }, index: number) => (
                                <div key={`${group.role}-${index}`} className={index > 0 ? 'mt-3' : ''}>
                                  <div className="font-semibold text-red-600 uppercase">
                                    {group.role}
                                  </div>
                                  <ol className="list-decimal pl-4 mt-1 space-y-0.5">
                                    {group.names.map((name, idx) => (
                                      <li key={`${name}-${idx}`} className="text-gray-900">
                                        {name}
                                      </li>
                                    ))}
                                  </ol>
                                </div>
                              ),
                            )
                          ) : (
                            <span className="text-xs text-gray-400">No team assigned</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-700 max-w-md">
                      <span className="text-xs leading-relaxed whitespace-pre-line">{row.activity}</span>
                    </td>
                    <td className="px-4 py-3 text-center text-gray-900">
                      <span className="inline-flex items-start rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 text-left max-w-xs">
                        {row.used ? (
                          <ol className="list-decimal pl-4 space-y-0.5">
                            {row.used.split('\n').map((line: string, index: number) => (
                              <li key={index}>{line}</li>
                            ))}
                          </ol>
                        ) : (
                          '—'
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-gray-900">
                      <span className="inline-flex items-start rounded-md bg-orange-50 px-2.5 py-1 text-xs font-semibold text-orange-700 text-left max-w-xs">
                        {row.balance ? (
                          <ol className="list-decimal pl-4 space-y-0.5">
                            {row.balance.split('\n').map((line: string, index: number) => (
                              <li key={index}>{line}</li>
                            ))}
                          </ol>
                        ) : (
                          '—'
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-gray-900">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          row.status === 'ONGOING'
                            ? 'bg-blue-50 text-blue-700'
                            : row.status === 'COMPLETED'
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-gray-50 text-gray-700'
                        }`}
                      >
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
