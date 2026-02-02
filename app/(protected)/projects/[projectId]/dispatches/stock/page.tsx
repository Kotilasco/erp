import { prisma } from '@/lib/db';
import { notFound } from 'next/navigation';
import StockDispatchSelector from './StockDispatchSelector';
import Link from 'next/link';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';

export default async function NewStockDispatchPage({ 
  params 
}: { 
  params: Promise<{ projectId: string }> 
}) {
  const { projectId } = await params;

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      quote: { include: { customer: true } },
    },
  });

  if (!project) return notFound();

  // Fetch multipurpose inventory items with quantity > 0
  const availableItems = await prisma.inventoryItem.findMany({
    where: { category: 'MULTIPURPOSE', qty: { gt: 0 } },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, description: true, unit: true, qty: true }
  });

  return (
    <div className="min-h-screen bg-slate-50/50 pb-20 font-sans">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b border-gray-200 pb-6">
          <div className="flex-1 min-w-0">
            <nav className="flex items-center text-sm font-medium text-gray-500 mb-4">
              <Link 
                href={`/projects/${projectId}/dispatches`} 
                className="hover:text-orange-600 transition-colors flex items-center bg-white px-3 py-1.5 rounded-lg border border-gray-200 shadow-sm"
              >
                <ArrowLeftIcon className="h-4 w-4 mr-1.5 text-orange-600" />
                Back to Dispatches
              </Link>
            </nav>
            <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">New Stock Dispatch</h1>
            <div className="mt-2 flex items-center text-sm text-gray-500">
              <span className="font-medium text-gray-700">Project:</span>
              <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-50 text-green-700 border border-green-100">
                {project.quote?.customer?.displayName || 'Project'}
              </span>
            </div>
          </div>
        </div>

        <StockDispatchSelector 
          projectId={projectId} 
          availableItems={availableItems as any} 
        />
      </div>
    </div>
  );
}
