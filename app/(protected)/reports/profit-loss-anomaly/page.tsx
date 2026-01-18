import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import GlobalPnLTable from '@/components/GlobalPnLTable';
import { VarianceItem } from '@/lib/profit-loss';
import { toMinor } from '@/helpers/money';

export const dynamic = 'force-dynamic';

export default async function AnomalyReportPage({ searchParams }: { searchParams: Promise<{ page?: string; q?: string }> }) {
  const me = await getCurrentUser();
  if (!me) redirect('/login');
  
  // Restricted access
  if (!['ADMIN', 'MANAGING_DIRECTOR', 'GENERAL_MANAGER', 'PROJECT_OPERATIONS_OFFICER'].includes(me.role as string)) {
     return <div className="p-8 text-center text-red-600">Access Denied. Executive Report Only.</div>;
  }

  /* const { page, q } = await searchParams; // searchParams is a Promise in Next 15? - user snippet had await. 
     Keeping it simple for now as per snippet. */
  
  // Fetch up to 200 recent potential anomalies
  const purchases = await prisma.purchase.findMany({
      where: {
          requisitionItemId: { not: null },
          // Filter by q if provided (optional logic can be re-added if needed, stripped for simplicity to match prop constraints)
      },
      orderBy: { purchasedAt: 'desc' },
      take: 200,
      include: {
          requisition: { select: { project: { select: { projectNumber: true, name: true } } } },
          requisitionItem: {
              include: {
                  poItems: { where: { purchaseOrder: { status: { not: 'DRAFT' } } } }
              }
          }
      }
  });

  const variances: VarianceItem[] = [];

  for (const p of purchases) {
      if (!p.requisitionItem || p.requisitionItem.poItems.length === 0) continue;

      const poItems = p.requisitionItem.poItems;
      const totalPoQty = poItems.reduce((acc, i) => acc + i.qty, 0);
      const totalPoCost = poItems.reduce((acc, i) => acc + Number(i.totalMinor), 0);
      
      if (totalPoQty === 0) continue;

      const avgPoUnitPrice = totalPoCost / totalPoQty; 
      const securityPrice = Number(p.priceMinor); // Total
      const securityQty = p.qty;

      if (securityQty <= 0) continue;

      const expectedCost = avgPoUnitPrice * securityQty;
      const diff = BigInt(Math.round(expectedCost - securityPrice));
      
      // If difference is significant (> 100 cents)
      if (Math.abs(Number(diff)) > 100) {
          variances.push({
              id: p.id,
              description: `[${p.vendor}] ${p.requisitionItem.description}`,
              category: 'PROCUREMENT', // Start using PROCUREMENT category for rendering
              varianceMinor: diff,
              projectName: p.requisition.project?.projectNumber || p.requisition.project?.name,
              details: `Sec: ${(securityPrice / 100).toFixed(2)} | PO: ${(expectedCost / 100).toFixed(2)}`,
              structuredDetails: {
                  quantity: securityQty,
                  estUnitPriceMinor: BigInt(Math.round(avgPoUnitPrice)),
                  actualUnitPriceMinor: BigInt(Math.round(securityPrice / securityQty))
              }
          });
      }
  }

  return (
    <div className="space-y-6 p-6 max-w-[1600px] mx-auto">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
          Procurement Anomaly Report
        </h1>
        <p className="text-gray-500 max-w-2xl">
          Discrepancies between Procurement (Purchase Orders) and Security (Gate/Receipt Records).
          <br/>
          <span className="text-rose-600 font-semibold">Negative Variance</span> indicates Security recorded a higher price than Procurement authorized.
        </p>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
         <GlobalPnLTable 
            items={variances}
            title="Price Anomalies (Security vs PO)"
            pageSize={15}
         />
      </div>
    </div>
  );
}
