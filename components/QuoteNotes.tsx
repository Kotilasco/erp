"use client";

import { useState, useTransition, useEffect } from 'react';
import { ArrowPathIcon } from '@heroicons/react/24/outline';
import { CheckCircleIcon } from '@heroicons/react/24/solid';

type QuoteNotesProps = {
  assumptions: string[];
  exclusions: string[];
  onChange?: (assumptions: string[], exclusions: string[]) => void;
  onSave?: (assumptions: string[], exclusions: string[]) => Promise<any>;
  readOnly?: boolean;
};

export default function QuoteNotes({ 
  assumptions: initialAssumptions, 
  exclusions: initialExclusions, 
  onChange, 
  onSave, 
  readOnly = false 
}: QuoteNotesProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState("");
  
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);

  // Sync with props if they change
  useEffect(() => {
    const combined = [...initialAssumptions, ...initialExclusions].filter(Boolean).join('\n\n');
    setEditText(combined);
  }, [initialAssumptions, initialExclusions]);

  const handleSave = () => {
    if (!onSave) return;
    start(async () => {
      // For consolidated notes, we treat it as one assumption block and empty exclusions
      await onSave([editText.trim()], []);
      setIsEditing(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    });
  };

  const currentDisplay = editText.trim();

  return (
    <div className="space-y-4 mt-8">
      <div className="flex justify-between items-center bg-gray-50 p-4 rounded-lg border border-gray-100 dark:bg-gray-900/50 dark:border-gray-800">
         <div>
           <h3 className="text-lg font-bold text-gray-900 dark:text-white">Notes & Conditions</h3>
           <p className="text-sm text-gray-500 dark:text-gray-400">View and manage assumptions and exclusions for this quote.</p>
         </div>
         
         {!readOnly && (
           <div className="flex gap-2">
             {!isEditing ? (
               <button
                 onClick={() => setIsEditing(true)}
                 className="px-4 py-2 rounded-lg text-sm font-medium bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 transition-all dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700 dark:hover:bg-gray-700 shadow-sm"
               >
                 Edit Notes
               </button>
             ) : (
               <>
                 <button
                   onClick={() => setIsEditing(false)}
                   className="px-4 py-2 rounded-lg text-sm font-medium bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 transition-all dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700 dark:hover:bg-gray-700"
                 >
                   Cancel
                 </button>
                 <button
                   onClick={handleSave}
                   disabled={pending}
                   className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 shadow-sm transition-all disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
                 >
                   {pending ? <ArrowPathIcon className="h-4 w-4 animate-spin" /> : null}
                   {pending ? 'Saving...' : 'Save Notes'}
                 </button>
               </>
             )}
             {saved && !isEditing && (
               <div className="flex items-center gap-1 text-green-600 text-sm font-medium px-2">
                 <CheckCircleIcon className="h-4 w-4" />
                 Saved
               </div>
             )}
           </div>
         )}
      </div>

      <div className="bg-white p-6 rounded-lg border shadow-sm dark:bg-gray-800 dark:border-gray-700">
        {isEditing ? (
          <textarea
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            className="w-full h-[500px] p-4 text-sm text-gray-600 bg-gray-50 rounded border border-gray-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-mono whitespace-pre-wrap outline-none dark:bg-gray-900 dark:text-gray-300 dark:border-gray-700 dark:focus:border-blue-400"
            placeholder="Enter notes and conditions..."
          />
        ) : (
          <div className="text-sm text-gray-600 bg-gray-50 p-6 rounded whitespace-pre-wrap leading-relaxed min-h-[100px] font-mono dark:bg-gray-900/50 dark:text-gray-400">
            {currentDisplay || <span className="italic text-gray-400">No notes and conditions listed.</span>}
          </div>
        )}
      </div>
    </div>
  );
}
