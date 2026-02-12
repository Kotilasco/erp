'use client';

import { PrinterIcon } from '@heroicons/react/24/outline';

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700 transition-colors shadow-sm"
    >
      <PrinterIcon className="w-5 h-5" />
      Print Report
    </button>
  );
}
