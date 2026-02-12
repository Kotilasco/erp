'use client';

import { useState } from 'react';
import { DocumentArrowDownIcon, CalendarDaysIcon, XMarkIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import { Dialog } from '@headlessui/react';

export default function DailyReportGenerator({ projectId }: { projectId: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDownload = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/projects/${projectId}/daily-report?date=${date}`);
      
      if (!response.ok) {
        throw new Error(await response.text() || 'Failed to download report');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      // Content-Disposition header usually handles filename, but backup:
      a.download = `Daily_Report_${date}.pdf`; 
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      setIsOpen(false);
    } catch (e: any) {
      console.error(e);
      setError(e instanceof Error ? e.message : "Failed to download report");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-2 rounded-md bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm border border-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
      >
        <DocumentArrowDownIcon className="h-4 w-4 text-emerald-600" />
        Generate Daily Report
      </button>

      <Dialog open={isOpen} onClose={() => setIsOpen(false)} className="relative z-50">
        <div className="fixed inset-0 bg-black/30" aria-hidden="true" />

        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
               <Dialog.Title className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <CalendarDaysIcon className="h-5 w-5 text-gray-500" />
                  Generate End of Day Report
               </Dialog.Title>
               <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-gray-500">
                 <XMarkIcon className="h-5 w-5" />
               </button>
            </div>
            
            <p className="text-sm text-gray-500 mb-6">
              Select a date to generate a summary of work progress, material usage, and task statuses for that day.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Report Date
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm p-2 border"
                />
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => window.open(`/projects/${projectId}/daily-report/view?date=${date}`, '_blank')}
                  className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
                >
                  View Report
                </button>

                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
                >
                  Close
                </button>
              </div>
            </div>
          </Dialog.Panel>
        </div>
      </Dialog>
    </>
  );
}
