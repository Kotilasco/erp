import { prisma } from '@/lib/db';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { assertRoles } from '@/lib/workflow';
import InventoryTableToolbar from './components/InventoryTableToolbar';
import TablePagination from '@/components/ui/table-pagination';
import { CubeIcon } from '@heroicons/react/24/outline';

type SearchParamsShape = {
  q?: string;
  page?: string;
  pageSize?: string;
};

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<SearchParamsShape>;
}) {
  const me = await getCurrentUser();

  if (!me) {
    redirect('/login');
  }
  try {
    assertRoles(me.role as any, ['PROJECT_OPERATIONS_OFFICER', 'PROCUREMENT', 'SENIOR_PROCUREMENT', 'SECURITY', 'ADMIN'] as any);
  } catch {
    const r = String((me as any).role || '');
    if (['QS', 'SENIOR_QS', 'SALES'].includes(r)) redirect('/quotes');
    redirect('/projects');
  }

  const resolved = await searchParams;
  const q = (resolved.q ?? '').trim();
  const page = Math.max(1, Number(resolved.page ?? '1'));
  const pageSize = Math.max(1, Number(resolved.pageSize ?? '20'));

  const where: any = { category: 'MATERIAL' };
  if (q) where.name = { contains: q, mode: 'insensitive' };

  const [items, total] = await Promise.all([
    prisma.inventoryItem.findMany({
      where,
      orderBy: { name: 'asc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.inventoryItem.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-8 p-2 sm:p-4 max-w-7xl mx-auto">
      {/* Header Section */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b border-gray-200 pb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg dark:bg-blue-900/30">
            <CubeIcon className="h-8 w-8 text-barmlo-blue dark:text-blue-400" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">Inventory</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Manage stock items and quantities.
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden dark:border-gray-700 dark:bg-gray-800">
        <div className="p-4 border-b border-gray-100 dark:border-gray-700">
           <InventoryTableToolbar />
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50/80 backdrop-blur-sm dark:bg-gray-900/50">
              <tr>
                <th scope="col" className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Name</th>
                <th scope="col" className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Unit</th>
                <th scope="col" className="px-6 py-4 text-right text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Qty</th>
                <th scope="col" className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Category</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-800">
              {items.length === 0 ? (
                <tr>
                  <td className="px-6 py-12 text-center text-gray-500 dark:text-gray-400" colSpan={4}>
                    <div className="flex flex-col items-center justify-center gap-2">
                       <CubeIcon className="h-10 w-10 text-gray-300" />
                       <p className="text-base font-medium">No inventory items found</p>
                       <p className="text-sm">Adjust your search or add items.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                items.map((it) => (
                  <tr key={it.id} className="group hover:bg-blue-50/30 transition-colors dark:hover:bg-gray-700/50">
                    <td className="px-6 py-4 text-sm font-semibold text-gray-900 dark:text-gray-100">{it.name}</td>
                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 font-mono">{it.unit ?? '-'}</td>
                    <td className="px-6 py-4 text-sm text-right font-medium text-gray-900 dark:text-gray-100">{it.qty}</td>
                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                        <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-800 dark:bg-gray-700 dark:text-gray-300">
                            {it.category ?? '-'}
                        </span>
                    </td>
                  </tr>
                ))
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

// server action
async function addInventoryItem(formData: FormData) {
  'use server';

  const me = await getCurrentUser();
  if (!me) redirect('/inventory');
  try {
    assertRoles((me as any).role, ['PROJECT_OPERATIONS_OFFICER', 'PROCUREMENT', 'SENIOR_PROCUREMENT', 'ADMIN'] as any);
  } catch {
    const r = String((me as any).role || '');
    if (['QS', 'SENIOR_QS', 'SALES'].includes(r)) redirect('/quotes');
    redirect('/projects');
  }

  const name = String(formData.get('name') || '').trim();
  const unit = String(formData.get('unit') || '').trim() || null;
  const qty = Number(formData.get('qty') || 0);
  const category = String(formData.get('category') || 'MATERIAL').trim() || 'MATERIAL';

  if (!name || isNaN(qty)) {
    redirect('/inventory');
  }

  const key = `${name}|${unit || ''}`.toLowerCase();

  await prisma.inventoryItem.upsert({
    where: { key },
    update: {
      qty: { increment: qty },
      quantity: { increment: qty },
      category,
    },
    create: {
      name,
      description: name,
      unit,
      qty,
      quantity: qty,
      category,
      key,
    },
  });

  redirect('/inventory');
}
