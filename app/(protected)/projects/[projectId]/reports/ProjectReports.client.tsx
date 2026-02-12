'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';

// Components
import DeliveriesReport from './components/DeliveriesReport';
import MaterialReconciliationReport from './components/MaterialReconciliationReport';
import ProfitabilityReport from './components/ProfitabilityReport';

type Tab = 'DELIVERIES' | 'RECONCILIATION' | 'PROFITABILITY';

import Link from 'next/link';

export default function ProjectReportsClient({ data, projectId }: { data: ReportData; projectId: string }) {
  const [activeTab, setActiveTab] = useState<Tab>('DELIVERIES');

  const handlePrint = () => {
    // Open the print page in a new window/tab
    // URL: /projects/[projectId]/reports/print?reportType=...
    const url = `/projects/${projectId}/reports/print?reportType=${activeTab}`;
    window.open(url, '_blank', 'resizable=yes,scrollbars=yes,status=yes');
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-6 pb-0">
        <div className="flex justify-between items-center mb-3">
             <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">Detailed Reports</h3>
             <button
                onClick={handlePrint}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm flex items-center gap-2"
             >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5zm-3 0h.008v.008H15V10.5z" />
                </svg>
                Print PDF
             </button>
        </div>
        <div className="flex flex-wrap gap-3 mb-6">
            <Link href={`/projects/${projectId}/reports/progress-tracking`} className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-green-600 transition-colors shadow-sm">
                Progress Tracking
            </Link>
            <Link href={`/projects/${projectId}/reports/schedule-reliability`} className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-green-600 transition-colors shadow-sm">
                Schedule Reliability
            </Link>
            <Link href={`/projects/${projectId}/reports/employee-performance`} className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-green-600 transition-colors shadow-sm">
                Employee Performance
            </Link>
            <Link href={`/projects/${projectId}/reports/material-efficiency`} className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-green-600 transition-colors shadow-sm">
                Material Efficiency
            </Link>
            <Link href={`/projects/${projectId}/reports/profit-loss`} className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-green-600 transition-colors shadow-sm">
                Profit & Loss (Deep Dive)
            </Link>
        </div>
      </div>
      <div className="border-b border-gray-200 px-6">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          <button
            onClick={() => setActiveTab('DELIVERIES')}
            className={cn(
              activeTab === 'DELIVERIES'
                ? 'border-barmlo-green text-barmlo-green'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
              'whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors'
            )}
          >
            Deliveries
          </button>
          
          <button
            onClick={() => setActiveTab('RECONCILIATION')}
            className={cn(
              activeTab === 'RECONCILIATION'
                ? 'border-barmlo-green text-barmlo-green'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
              'whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors'
            )}
          >
            Material Reconciliation
          </button>

          <button
            onClick={() => setActiveTab('PROFITABILITY')}
            className={cn(
              activeTab === 'PROFITABILITY'
                ? 'border-barmlo-green text-barmlo-green'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
              'whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors'
            )}
          >
            Profitability
          </button>
        </nav>
      </div>

      <div className="p-6">
        {activeTab === 'DELIVERIES' && <DeliveriesReport data={data} />}
        {activeTab === 'RECONCILIATION' && <MaterialReconciliationReport data={data} />}
        {activeTab === 'PROFITABILITY' && <ProfitabilityReport data={data} />}
      </div>
    </div>
  );
}
