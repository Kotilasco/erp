import { getCurrentUser } from '@/lib/auth';
import { SidebarNavigation } from './SidebarNavigation';

const BASE: { label:string; href:string; icon:string; roles?: string[] }[] = [
  { label: 'My Quotes', href: '/quotes', icon: 'quote', roles: ['QS','SENIOR_QS','SALES','ADMIN'] },
  { label: 'Projects', href: '/projects', icon: 'folder', roles: ['ADMIN','CLIENT','VIEWER','PROJECT_OPERATIONS_OFFICER','PROCUREMENT','SECURITY','ACCOUNTS','CASHIER','ACCOUNTING_OFFICER','ACCOUNTING_AUDITOR','ACCOUNTING_CLERK','DRIVER','GENERAL_MANAGER','MANAGING_DIRECTOR'] },
  { label: 'New Quote', href: '/quotes/new', icon: 'quote', roles: ['QS','SENIOR_QS','ADMIN'] },
  { label: 'Requisitions', href: '/procurement/requisitions', icon: 'list', roles: ['PROJECT_OPERATIONS_OFFICER','PROJECT_COORDINATOR','PROCUREMENT','ADMIN'] },
  { label: 'Purchase Orders', href: '/accounts/po', icon: 'list', roles: ['ACCOUNTS','ACCOUNTING_CLERK','ACCOUNTING_OFFICER','ADMIN'] },
  { label: 'Dispatches', href: '/dispatches', icon: 'truck', roles: ['PROJECT_OPERATIONS_OFFICER','SECURITY','ADMIN'] },
  { label: 'Funds', href: '/funds', icon: 'bank', roles: ['ACCOUNTS','ACCOUNTING_CLERK','ACCOUNTING_OFFICER','ACCOUNTING_AUDITOR','ADMIN'] },
  { label: 'Inventory', href: '/inventory', icon: 'boxes', roles: ['PROCUREMENT','PROJECT_OPERATIONS_OFFICER','ADMIN'] },
  { label: 'Audit Logs', href: '/audit-logs', icon: 'list', roles: ['ADMIN'] },
  { label: 'Employees', href: '/employees', icon: 'list', roles: ['ADMIN','MANAGING_DIRECTOR'] },
];

export default async function Sidebar() {
  const me = await getCurrentUser();
  const role = (me?.role ?? 'VIEWER') as string;
  const pages = BASE.filter(p => !p.roles || p.roles.includes(role));

  return <SidebarNavigation links={pages} />;
}
