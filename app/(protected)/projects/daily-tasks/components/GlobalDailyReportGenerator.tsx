'use client';

import { useState } from 'react';
import { getGlobalDailyReportData } from '@/app/(protected)/projects/actions';
import { pdf } from '@react-pdf/renderer';
import GlobalDailyReport from '@/lib/pdf/GlobalDailyReport';
import { DocumentArrowDownIcon, CalendarDaysIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { Dialog } from '@headlessui/react';

export default function GlobalDailyReportGenerator() {
  const [isOpen, setIsOpen] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getGlobalDailyReportData(date);
      
      if (data.length === 0) {
        throw new Error("No active projects found.");
      }

      const blob = await pdf(<GlobalDailyReport reports={data} />).toBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Global_Daily_Report_${date}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setIsOpen(false);
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : "Failed to generate report");
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
        End of Day Report (All)
      </button>

      <Dialog open={isOpen} onClose={() => setIsOpen(false)} className="relative z-50">
        <div className="fixed inset-0 bg-black/30" aria-hidden="true" />

        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
               <Dialog.Title className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <CalendarDaysIcon className="h-5 w-5 text-gray-500" />
                  End of Day Report
               </Dialog.Title>
               <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-gray-500">
                 <XMarkIcon className="h-5 w-5" />
               </button>
            </div>
            
            <p className="text-sm text-gray-500 mb-6">
              Generate a combined PDF report for ALL your active projects.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Report Date
                </label>
                <input
                  type="date"
                  value={date}
                  max={new Date().toISOString().split('T')[0]}
                  onChange={(e) => setDate(e.target.value)}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm p-2 border"
                />
              </div>

              {error && (
                <div className="p-3 bg-red-50 text-red-700 text-sm rounded-md">
                   {error}
                </div>
              )}

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleGenerate}
                  disabled={loading}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-md hover:bg-emerald-700 disabled:opacity-50"
                >
                  {loading ? 'Generating...' : 'Download PDF'}
                </button>
              </div>
            </div>
          </Dialog.Panel>
        </div>
      </Dialog>
    </>
  );
}
