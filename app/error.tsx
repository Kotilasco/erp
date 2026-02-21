'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { 
  ExclamationTriangleIcon, 
  ArrowPathIcon,
  HomeIcon,
  ServerIcon,
  ChevronRightIcon
} from '@heroicons/react/24/outline';
import Link from 'next/link';
import { Montserrat } from 'next/font/google';

const montserrat = Montserrat({ subsets: ['latin'] });

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [countdown, setCountdown] = useState(5);
  const message = error?.message ?? '';
  const isDbPoolIssue = /connection pool|timed out fetching a new connection|p1001|p1002/i.test(
    message,
  );

  useEffect(() => {
    console.error(error);
    const toastMsg = isDbPoolIssue
      ? 'Database connection lost. Reconnecting...'
      : error.message || 'An unexpected interruption occurred.';
    toast.error(toastMsg, {
      duration: 4000,
    });
  }, [error, isDbPoolIssue]);

  useEffect(() => {
    if (countdown <= 0) {
      reset();
      return;
    }
    const timer = setTimeout(() => setCountdown(v => v - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown, reset]);

  return (
    <div className={`flex min-h-[90vh] flex-col items-center justify-center p-6 bg-[#F8FAFC] ${montserrat.className}`}>
      <div className="w-full max-w-2xl text-center space-y-12">
        
        {/* Animated Icon Section */}
        <div className="relative mx-auto w-32 h-32">
          <div className="absolute inset-0 bg-emerald-500/10 rounded-full animate-ping duration-[3s]" />
          <div className="absolute inset-4 bg-emerald-500/20 rounded-full animate-pulse" />
          <div className="relative mx-auto flex h-32 w-32 items-center justify-center rounded-full bg-white shadow-2xl ring-1 ring-slate-200">
            {isDbPoolIssue ? (
              <ServerIcon className="h-14 w-14 text-emerald-600 animate-bounce" />
            ) : (
              <ExclamationTriangleIcon className="h-14 w-14 text-emerald-600" />
            )}
          </div>
        </div>

        {/* Content Section */}
        <div className="space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 text-[10px] font-bold uppercase tracking-widest text-slate-500 border border-slate-200">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            System Incident Logged
          </div>

          <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight sm:text-5xl">
            {isDbPoolIssue ? 'Connection Interrupted' : 'Temporary Disruption'}
          </h1>
          
          <div className="max-w-md mx-auto">
            {isDbPoolIssue ? (
              <p className="text-lg text-slate-600 leading-relaxed">
                The primary database is currently overloaded or unreachable. 
                Our automated recovery system is attempting to restore the link.
              </p>
            ) : (
              <p className="text-lg text-slate-600 leading-relaxed">
                {error.message || 'The system encountered an unexpected bottleneck while processing your request. Most data remains intact.'}
              </p>
            )}
          </div>
        </div>

        {/* Action Section */}
        <div className="flex flex-col items-center gap-6">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={reset}
              className="group relative inline-flex items-center justify-center gap-3 rounded-2xl bg-slate-900 px-8 py-4 text-sm font-bold text-white shadow-xl hover:bg-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 transition-all active:scale-95"
            >
              <ArrowPathIcon className={`h-5 w-5 ${countdown > 0 ? 'animate-spin-slow' : ''}`} />
              <span>Retry Now</span>
              <span className="ml-2 inline-flex items-center justify-center h-6 w-6 rounded-md bg-white/20 text-[11px]">
                {countdown}s
              </span>
            </button>

            <Link
              href="/"
              className="inline-flex items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white px-8 py-4 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50 hover:border-slate-300 transition-all active:scale-95"
            >
              <HomeIcon className="h-5 w-5 text-slate-400" />
              Return to Dashboard
            </Link>
          </div>

          <div className="flex items-center gap-8 pt-8 border-t border-slate-200">
            <div className="text-left">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Status</p>
              <p className="text-xs font-semibold text-emerald-600 flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Auto-Recovery Active
              </p>
            </div>
            {error.digest && (
              <div className="text-left border-l border-slate-200 pl-8">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Incident ID</p>
                <p className="text-xs font-mono text-slate-600">{error.digest}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
