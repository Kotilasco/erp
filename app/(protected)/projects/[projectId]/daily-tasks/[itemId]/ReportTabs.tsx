'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { ChartBarIcon, ArchiveBoxIcon } from '@heroicons/react/24/outline';

export default function ReportTabs({
  taskReportForm,
  materialUsageList,
}: {
  taskReportForm: React.ReactNode;
  materialUsageList: React.ReactNode;
}) {
  const [activeTab, setActiveTab] = useState<'report' | 'materials'>('report');

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          <button
            onClick={() => setActiveTab('report')}
            className={cn(
              activeTab === 'report'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700',
              'group inline-flex items-center border-b-2 py-4 px-1 text-sm font-medium transition-colors'
            )}
            aria-current={activeTab === 'report' ? 'page' : undefined}
          >
            <ChartBarIcon
              className={cn(
                activeTab === 'report' ? 'text-indigo-500' : 'text-gray-400 group-hover:text-gray-500',
                '-ml-0.5 mr-2 h-5 w-5'
              )}
              aria-hidden="true"
            />
            {/* Today's Progress Report */}
            Progress Report
          </button>

          <button
            onClick={() => setActiveTab('materials')}
            className={cn(
              activeTab === 'materials'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700',
              'group inline-flex items-center border-b-2 py-4 px-1 text-sm font-medium transition-colors'
            )}
            aria-current={activeTab === 'materials' ? 'page' : undefined}
          >
            <ArchiveBoxIcon
              className={cn(
                activeTab === 'materials' ? 'text-indigo-500' : 'text-gray-400 group-hover:text-gray-500',
                '-ml-0.5 mr-2 h-5 w-5'
              )}
              aria-hidden="true"
            />
            Materials Used
          </button>
        </nav>
      </div>

      {/* Content */}
      <div className={cn(activeTab === 'report' ? 'block' : 'hidden')}>
        {taskReportForm}
      </div>
      <div className={cn(activeTab === 'materials' ? 'block' : 'hidden')}>
        {materialUsageList}
      </div>
    </div>
  );
}
