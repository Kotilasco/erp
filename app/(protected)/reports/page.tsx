import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import {
  ChartBarSquareIcon,
  BanknotesIcon,
  ShoppingCartIcon,
  PresentationChartLineIcon,
  DocumentDuplicateIcon,
  ArrowTrendingDownIcon,
  ExclamationTriangleIcon,
  ArchiveBoxIcon,
  UserGroupIcon,
  ScaleIcon,
  CalendarDaysIcon,
  GlobeAltIcon
} from '@heroicons/react/24/outline';
import PrintHeader from '@/components/PrintHeader';

export default async function GlobalReportsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  type Report = {
      title: string;
      description: string;
      href: string;
      icon: any;
      color: string;
      bgColor: string;
      roles?: string[];
      disabled?: boolean;
  };

  const reports: Report[] = [
    {
      title: "Global Task Progress",
      description: "Aggregate tracking of schedule tasks and completion status across all projects.",
      href: `/reports/progress-tracking`,
      icon: ChartBarSquareIcon,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
      roles: ['PM_CLERK', 'PROJECT_OPERATIONS_OFFICER', 'PROJECT_COORDINATOR', 'ADMIN', 'MANAGING_DIRECTOR', 'ACCOUNTING_CLERK', 'ACCOUNTING_OFFICER', 'ACCOUNTS']
    },
    {
      title: "Consolidated Profit & Loss",
      description: "Company-wide financial overview including procurement, usage, and variances.",
      href: `/reports/profit-loss`,
      icon: BanknotesIcon,
      color: "text-emerald-600",
      bgColor: "bg-emerald-50",
      roles: ['ADMIN', 'MANAGING_DIRECTOR', 'ACCOUNTING_CLERK', 'ACCOUNTING_OFFICER', 'ACCOUNTS', 'PROJECT_OPERATIONS_OFFICER']
    },
    {
      title: "Procurement Efficiency (Global)",
      description: "Analysis of procurement variances and spending trends across all sites.",
      href: `/reports/profit-loss-procurement`,
      icon: ShoppingCartIcon,
      color: "text-indigo-600",
      bgColor: "bg-indigo-50",
      roles: ['ADMIN', 'MANAGING_DIRECTOR', 'ACCOUNTING_CLERK', 'ACCOUNTING_OFFICER', 'ACCOUNTS', 'PROJECT_OPERATIONS_OFFICER', 'PROCUREMENT']
    },
    {
      title: "Negotiation Gains (Global)",
      description: "Total revenue impact from post-quote negotiations across the organization.",
      href: `/reports/profit-loss-negotiation`,
      icon: ArrowTrendingDownIcon,
      color: "text-purple-600",
      bgColor: "bg-purple-50",
      roles: ['ADMIN', 'MANAGING_DIRECTOR', 'ACCOUNTING_CLERK', 'ACCOUNTING_OFFICER', 'ACCOUNTS', 'PROJECT_OPERATIONS_OFFICER']
    },
    {
      title: "Material Usage Analysis",
      description: "Consolidated view of material over/under usage statistics.",
      href: `/reports/profit-loss-usage`,
      icon: ExclamationTriangleIcon,
      color: "text-amber-600",
      bgColor: "bg-amber-50",
      roles: ['ADMIN', 'MANAGING_DIRECTOR', 'ACCOUNTING_CLERK', 'ACCOUNTING_OFFICER', 'ACCOUNTS', 'PROJECT_OPERATIONS_OFFICER']
    },
    {
      title: "Global Employee Performance",
      description: "Ranking and performance metrics for employees across all assigned projects.",
      href: `/reports/employee-performance`,
      icon: UserGroupIcon,
      color: "text-teal-600",
      bgColor: "bg-teal-50",
      roles: ['ADMIN', 'MANAGING_DIRECTOR', 'PROJECT_OPERATIONS_OFFICER', 'ACCOUNTING_CLERK', 'ACCOUNTING_OFFICER', 'ACCOUNTS'],
      disabled: false
    },
    {
      title: "Material Efficiency (Global)",
      description: "Identify top material consumers and efficiency trends organization-wide.",
      href: `/reports/material-efficiency`,
      icon: ScaleIcon,
      color: "text-orange-600",
      bgColor: "bg-orange-50",
      roles: ['ADMIN', 'MANAGING_DIRECTOR', 'PROJECT_OPERATIONS_OFFICER', 'ACCOUNTING_CLERK', 'ACCOUNTING_OFFICER', 'ACCOUNTS'],
      disabled: false
    },
    {
        title: "Schedule Reliability (Global)",
        description: "Organization-wide analysis of task completion timeliness and delays.",
        href: `/reports/schedule-reliability`,
        icon: CalendarDaysIcon,
        color: "text-rose-600",
        bgColor: "bg-rose-50",
        roles: ['ADMIN', 'MANAGING_DIRECTOR', 'PROJECT_OPERATIONS_OFFICER', 'ACCOUNTING_CLERK', 'ACCOUNTING_OFFICER', 'ACCOUNTS'],
        disabled: false
    }
  ];

  return (
    <div className="p-6 space-y-8 max-w-[1600px] mx-auto min-h-screen">
      <PrintHeader />
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200 pb-6">
        <div>
           <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center rounded-md bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700 ring-1 ring-inset ring-indigo-700/10">
                Organization Overview
              </span>
           </div>
           <h1 className="text-3xl font-bold tracking-tight text-gray-900 flex items-center gap-3">
              <GlobeAltIcon className="h-8 w-8 text-gray-400" />
              Global Reports Center
           </h1>
           <p className="text-gray-500 mt-2">
              Consolidated reporting and analytics across {user.role === 'PROJECT_OPERATIONS_OFFICER' ? 'your assigned' : 'all'} projects.
           </p>
        </div>
      </div>

      {/* Reports Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {reports.map((report) => {
          if (report.roles && !report.roles.includes(user.role as string)) return null;
          
          const CardContent = (
             <>
                <div>
                    <div className={`inline-flex items-center justify-center rounded-lg p-3 ${report.bgColor} ${report.color} mb-4`}>
                        <report.icon className="h-6 w-6" aria-hidden="true" />
                    </div>
                    <h3 className={`text-lg font-semibold leading-6 ${report.disabled ? 'text-gray-400' : 'text-gray-900 group-hover:text-indigo-600'} transition-colors`}>
                        {report.title}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-gray-500">
                    {report.description}
                    </p>
                </div>
                {!report.disabled && (
                    <div className="mt-6 flex items-center gap-4 text-sm font-medium text-gray-500">
                        <div className="flex items-center gap-1 hover:text-gray-900">
                            <DocumentDuplicateIcon className="h-4 w-4" />
                            View Global Report
                        </div>
                    </div>
                )}
                {report.disabled && (
                    <div className="mt-6 flex items-center gap-2 text-xs font-medium text-gray-400 bg-gray-100 rounded-md px-2 py-1 w-fit">
                        Coming Soon
                    </div>
                )}
             </>
          );

          if (report.disabled) {
              return (
                <div key={report.title} className="group relative flex flex-col justify-between rounded-2xl bg-gray-50 p-6 shadow-sm ring-1 ring-gray-100 opacity-70 cursor-not-allowed">
                    {CardContent}
                </div>
              );
          }

          return (
            <Link key={report.title} href={report.href} className="group relative flex flex-col justify-between rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200 hover:shadow-md hover:ring-indigo-500 transition-all">
                {CardContent}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
