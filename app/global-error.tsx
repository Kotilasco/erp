'use client';

import { useEffect } from 'react';
import { Montserrat } from 'next/font/google';
import '@/app/ui/global.css';

const montserrat = Montserrat({ subsets: ['latin'] });

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body className={`${montserrat.className} antialiased bg-[#F8FAFC] text-slate-900`}>
        <div className="flex min-h-screen flex-col items-center justify-center p-6">
          <div className="w-full max-w-lg space-y-10 rounded-3xl bg-white p-12 shadow-2xl ring-1 ring-slate-900/5 text-center">
            
            <div className="relative mx-auto w-24 h-24 flex items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
               <svg
                className="h-12 w-12"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth="1.5"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
                />
              </svg>
            </div>
            
            <div className="space-y-4">
              <h2 className="text-4xl font-extrabold tracking-tight text-slate-900">
                System Halt
              </h2>
              <p className="text-lg text-slate-500 leading-relaxed max-w-sm mx-auto">
                A critical system interruption occurred. Most operations are paused to maintain data integrity.
              </p>
            </div>

            <div className="flex flex-col gap-4 pt-6">
              <button
                onClick={() => reset()}
                className="inline-flex w-full items-center justify-center rounded-2xl bg-slate-900 px-8 py-4 text-sm font-bold text-white shadow-xl hover:bg-emerald-600 focus:outline-none transition-all active:scale-95"
              >
                Attempt Recovery
              </button>
              <button
                onClick={() => window.location.href = '/'}
                className="inline-flex w-full items-center justify-center rounded-2xl bg-white px-8 py-4 text-sm font-bold text-slate-700 shadow-sm ring-1 ring-inset ring-slate-200 hover:bg-slate-50 transition-all active:scale-95"
              >
                Back to Dashboard
              </button>
            </div>
            
            {error.digest && (
              <div className="pt-6 border-t border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-2">Internal Reference</p>
                <code className="text-[11px] font-mono text-slate-500 bg-slate-50 px-2 py-1 rounded">
                  {error.digest}
                </code>
              </div>
            )}
          </div>
        </div>
      </body>
    </html>
  );
}
