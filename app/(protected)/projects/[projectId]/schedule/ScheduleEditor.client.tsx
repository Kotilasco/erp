'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import EmployeeAssignmentModal from './EmployeeAssignmentModal';
import { PlusIcon, CalendarIcon, DocumentTextIcon, CheckCircleIcon, PencilSquareIcon, XMarkIcon } from '@heroicons/react/24/outline';

import { 
  recalculateRipple, 
  ScheduleItemMinimal,
  ProductivitySettings
} from '@/lib/schedule-engine';
import { batchCheckConflicts } from './actions';

type Item = {
  id?: string | null;
  title: string;
  description?: string | null;
  unit?: string | null;
  quantity?: number | null;
  plannedStart?: string | null;
  plannedEnd?: string | null;
  employees?: number | null;
  estHours?: number | null;
  note?: string | null;
  employeeIds?: string[];
  hasConflict?: boolean; // New field for conflict highlight
  conflictNote?: string | null;
};
export default function ScheduleEditor({
  projectId,
  schedule,
  user,
  employees,
  productivity,
}: {
  projectId: string;
  schedule: any | null;
  user: any | null;
  employees: Array<{ id: string; givenName: string; surname?: string | null; role: string }>;
  productivity: ProductivitySettings;
}) {
  /* ... */
  const isDraft = !schedule || schedule.status === 'DRAFT';

  const initItems: Item[] = (schedule?.items ?? []).map((i: any) => ({
    id: i.id,
    title: i.title,
    description: i.description,
    unit: i.unit,
    quantity: i.quantity ?? null,
    plannedStart: i.plannedStart ? new Date(i.plannedStart).toISOString().slice(0, 10) : null,
    plannedEnd: i.plannedEnd ? new Date(i.plannedEnd).toISOString().slice(0, 10) : null,
    employees: i.employees ?? null,
    estHours: i.estHours ?? null,
    note: i.note ?? null,
    employeeIds: Array.isArray(i.assignees) ? i.assignees.map((a: any) => a.id) : [],
    hasConflict: i.hasConflict ?? false,
    conflictNote: i.conflictNote ?? null,
  }));

  const [items, setItems] = useState<Item[]>(initItems);
  const [note, setNote] = useState<string>(schedule?.note ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [checkingConflicts, setCheckingConflicts] = useState(false);

  // Auto-scheduling state
  const [projectStartDate, setProjectStartDate] = useState<string>(
    initItems[0]?.plannedStart || new Date().toISOString().slice(0, 10)
  );

  const normalizeUnit = (u: string) => {
    const v = (u ?? '').trim().toLowerCase();
    if (v === 'm2' || v === 'sqm' || v === 'm^2') return 'm²';
    if (v === 'm3' || v === 'cum' || v === 'm^3') return 'm³';
    if (v === 'ft2' || v === 'ft^2') return 'ft²';
    if (v === 'ft3' || v === 'ft^3') return 'ft³';
    return u;
  };
  const [gapMinutes, setGapMinutes] = useState<number>(30);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [activeRowIndex, setActiveRowIndex] = useState<number | null>(null);

  // --- Auto-Scheduling Logic ---

  const checkAllConflicts = useCallback(async (currentItems: Item[]) => {
    setCheckingConflicts(true);
    try {
        const payload = currentItems.map(it => ({
            id: it.id,
            employeeIds: it.employeeIds ?? [],
            plannedStart: it.plannedStart!,
            plannedEnd: it.plannedEnd!,
        })).filter(it => it.plannedStart && it.plannedEnd);

        const result = await batchCheckConflicts(payload);
        setItems(prev => prev.map(it => {
            const rowId = it.id || `temp-${items.indexOf(it)}`;
            const hasConflict = result.conflictIds.includes(rowId);
            return {
                ...it,
                hasConflict,
                conflictNote: hasConflict ? result.details[rowId] : null
            };
        }));
    } catch (err) {
        console.error('Failed to check conflicts', err);
    } finally {
        setCheckingConflicts(false);
    }
  }, [items]);

  const calculateSchedule = useCallback((currentItems: Item[]) => {
    if (!projectStartDate) return currentItems;
    
    // items in Item[] format are compatible with ScheduleItemMinimal
    const result = recalculateRipple(
        currentItems as ScheduleItemMinimal[],
        0, // Start from the beginning
        new Date(projectStartDate),
        gapMinutes,
        productivity
    );

    return result as Item[];
  }, [projectStartDate, gapMinutes, productivity]);


  // Recalculate when dependencies change
  useEffect(() => {
    const newItems = calculateSchedule(items);
    // Only update if values actually changed to avoid infinite loop
    // JSON.stringify comparison is a bit expensive but safe for this size
    if (JSON.stringify(newItems) !== JSON.stringify(items)) {
        setItems(newItems);
    }
  }, [projectStartDate, gapMinutes, calculateSchedule, items]); // include items for correctness
  // Wait, if I change 'items' (e.g. add row), I want schedule to update.
  // But updating schedule updates 'items'.
  // I need to separate 'input data' from 'calculated data' or be very careful.
  // Better: Trigger calculation only when specific fields change.
  
  const updateItemsWithSchedule = (newItems: Item[]) => {
      const scheduled = calculateSchedule(newItems);
      setItems(scheduled);
  };

  // --- Handlers ---

  function addRow() {
    const newItem: Item = {
        title: '',
        description: '',
        unit: '',
        quantity: null,
        employees: null,
        estHours: null,
        employeeIds: [],
    };
    updateItemsWithSchedule([...items, newItem]);
  }

  function removeRow(idx: number) {
    const copy = [...items];
    copy.splice(idx, 1);
    updateItemsWithSchedule(copy);
  }

  function updateField(idx: number, key: keyof Item, value: any) {
    const copy = [...items];
    (copy[idx] as any)[key] = value;
    updateItemsWithSchedule(copy);
  }

  async function handleSave(activate: boolean = false) {
    setLoading(true);
    setError(null);
    try {
      const status = activate ? 'ACTIVE' : 'DRAFT';
      const res = await fetch(`/api/projects/${projectId}/schedule`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ note, items, status }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Save failed');
      if (activate && (schedule?.status === 'DRAFT' || !schedule)) {
        window.location.href = '/dashboard';
      } else {
        window.location.reload();
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to save schedule');
    } finally {
      setLoading(false);
    }
  }

  const handleExtract = useCallback(async () => {
    setExtracting(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/schedule/from-quote`, {
        method: 'POST',
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed to extract from quote');
      
      if (Array.isArray(json.items)) {
         const newItems = json.items.map((i: any) => ({
             id: i.id,
             title: i.title,
             description: i.description,
             unit: i.unit,
             quantity: i.quantity,
             plannedStart: i.plannedStart? new Date(i.plannedStart).toISOString().slice(0, 10) : null,
             plannedEnd: i.plannedEnd? new Date(i.plannedEnd).toISOString().slice(0, 10) : null,
             employees: i.employees,
             estHours: i.estHours,
             note: i.note,
             employeeIds: Array.isArray(i.assignees) ? i.assignees.map((a: any) => a.id) : [],
         }));
         // Apply auto-schedule logic to new items
         // We need to call calculateSchedule but it depends on state. 
         // Fortunately calculateSchedule is memoized with useCallback.
         // However, calling it here might use stale state references if not careful.
         // But calculateSchedule depends on projectStartDate etc which are in state.
         // We can just setItems(newItems) and let the EXISTING useEffect for auto-scheduling kick in?
         // The existing useEffect runs when 'items' changes.
         // useEffect(() => { const newItems = calculateSchedule(items); ... }, [items])
         
         setItems(newItems); 
      }

    } catch (err: any) {
      setError(err?.message || 'Failed to extract schedule');
    } finally {
      setExtracting(false);
    }
  }, [projectId]);



  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-lg shadow-sm border mb-6">
        <div className="flex items-center gap-4">
          <div className="flex flex-col">
            <label className="text-xs font-medium text-gray-500 mb-1">Project Start Date</label>
            <input
              type="date"
              value={projectStartDate}
              onChange={(e) => setProjectStartDate(e.target.value)}
              className="h-9 rounded-md border border-gray-300 px-3 text-sm focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>
          <div className="flex flex-col">
            <label className="text-xs font-medium text-gray-500 mb-1">Gap (Minutes)</label>
            <input
              type="number"
              value={gapMinutes}
              onChange={(e) => setGapMinutes(Number(e.target.value))}
              className="h-9 w-24 rounded-md border border-gray-300 px-3 text-sm focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>
        </div>

          <button
            onClick={() => checkAllConflicts(items)}
            disabled={checkingConflicts}
            className={cn(
                "inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium shadow-sm transition-colors",
                "bg-orange-50 text-orange-700 hover:bg-orange-100 border border-orange-200",
                checkingConflicts && "opacity-50 cursor-not-allowed"
            )}
          >
            <CalendarIcon className="h-4 w-4" />
            {checkingConflicts ? 'Checking Conflicts...' : 'Check Availability'}
          </button>
          
          <button
            onClick={() => setItems([...items, { title: '', quantity: 0, employeeIds: [] }])}
            className="inline-flex items-center gap-2 rounded-md bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 transition-colors"
          >
            <PlusIcon className="h-4 w-4 text-gray-500" />
            Add Task
          </button>
       </div>

      {/* Table */}
      {items.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border">
          <DocumentTextIcon className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No tasks yet</h3>
          <p className="mt-1 text-sm text-gray-500">Get started by extracting tasks from a quote or adding them manually.</p>
          <div className="mt-6 flex items-center justify-center gap-3">
            <button
              onClick={handleExtract}
              disabled={extracting}
              className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-green-600 text-white shadow hover:bg-green-700 h-9 px-4 py-2"
            >
              {extracting ? 'Extracting...' : 'Extract from Quote'}
            </button>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto bg-white rounded-lg border shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="px-2 py-2 text-left font-medium text-muted-foreground w-1/3 min-w-[200px]">Task</th>
                <th className="px-2 py-2 text-center font-medium text-muted-foreground w-24">Unit</th>
                <th className="px-2 py-2 text-left font-medium text-muted-foreground w-28">Qty</th>
                {!isDraft && (
                  <>
                    <th className="px-2 py-2 text-left font-medium text-muted-foreground w-32">Start (auto)</th>
                    <th className="px-2 py-2 text-left font-medium text-muted-foreground w-32">End (auto)</th>
                    <th className="px-2 py-2 text-left font-medium text-muted-foreground w-20">Hours</th>
                  </>
                )}
                <th className="px-2 py-2 text-left font-medium text-muted-foreground w-24 whitespace-nowrap">Workers</th>
                <th className="px-2 py-2 text-left font-medium text-muted-foreground w-auto min-w-[200px]">Note</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {items.map((it, i) => (
                <tr key={it.id ?? i} className={cn("transition-colors", it.hasConflict ? "bg-red-50 hover:bg-red-100" : "hover:bg-muted/50")}>
                  <td className="px-2 py-1">
                    <div className="flex items-center gap-2">
                      <input
                        value={it.title}
                        onChange={(e) => updateField(i, 'title', e.target.value)}
                        className={cn(
                          "flex h-8 w-full rounded-md border border-input bg-transparent px-2 py-1 text-xs shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                          it.hasConflict && "border-rose-300 bg-rose-50"
                        )}
                        placeholder="Task name"
                      />
                      {it.hasConflict && (
                        <div className="group relative">
                          <span className="flex-shrink-0 cursor-help inline-flex items-center rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-700 ring-1 ring-inset ring-rose-600/20 shadow-sm animate-pulse">
                            CONFLICT
                          </span>
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-48 p-2 bg-gray-900 text-white text-[10px] rounded shadow-lg z-50">
                            {it.conflictNote || 'Resource busy on another project.'}
                            <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-gray-900"></div>
                          </div>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-2 py-1">
                    <input
                        value={it.unit || ''}
                        onChange={(e) => updateField(i, 'unit', e.target.value)}
                        onBlur={(e) => updateField(i, 'unit', normalizeUnit(e.target.value))}
                        placeholder="Unit (e.g., r, m², m³)"
                        className="flex h-8 w-full rounded-md border border-input bg-transparent px-2 py-1 text-xs text-center font-medium tracking-wide shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    />
                  </td>
                  <td className="px-2 py-1">
                    <input
                        type="number"
                        value={it.quantity ?? ''}
                        onChange={(e) => updateField(i, 'quantity', Number(e.target.value))}
                        className="flex h-8 w-full rounded-md border border-input bg-transparent px-2 py-1 text-xs shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    />
                  </td>

                  {!isDraft && (
                    <>
                      <td className="px-2 py-1">
                        <div className="flex h-8 w-full items-center rounded-md border border-gray-200 bg-gray-50 px-2 py-1 text-xs text-gray-500 whitespace-nowrap overflow-hidden">
                          {it.plannedStart || '-'}
                        </div>
                      </td>
                      <td className="px-2 py-1">
                        <div className="flex h-8 w-full items-center rounded-md border border-gray-200 bg-gray-50 px-2 py-1 text-xs text-gray-500 whitespace-nowrap overflow-hidden">
                          {it.plannedEnd || '-'}
                        </div>
                      </td>
                      <td className="px-2 py-1">
                         <div className="flex h-8 w-full items-center rounded-md border border-gray-200 bg-gray-50 px-2 py-1 text-xs text-gray-500">
                          {it.estHours || '-'}
                        </div>
                      </td>
                    </>
                  )}
                  <td className="px-2 py-1">
                    <button
                        type="button"
                        onClick={() => {
                            setActiveRowIndex(i);
                            setModalOpen(true);
                        }}
                        className={cn(
                          "inline-flex items-center justify-center rounded px-2 py-0.5 text-xs font-medium text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2",
                          (it.employeeIds && it.employeeIds.length > 0)
                            ? "bg-barmlo-green hover:bg-barmlo-green/90 focus:ring-barmlo-green"
                            : "bg-green-600 hover:bg-green-700 focus:ring-green-500"
                        )}
                    >
                        Select Employees
                    </button>
                  </td>
                  <td className="px-2 py-1">
                    <div className="relative">
                      <PencilSquareIcon className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <input
                        value={it.note ?? ''}
                        onChange={(e) => updateField(i, 'note', e.target.value)}
                        placeholder="Add note..."
                        className={cn(
                          "flex h-8 w-full rounded-md bg-white px-7 py-1 text-xs shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1",
                          (it.note && it.note.trim().length > 0)
                            ? "border-emerald-300 focus-visible:ring-emerald-400 bg-emerald-50"
                            : "border border-input focus-visible:ring-ring"
                        )}
                      />
                      {it.note && it.note.trim().length > 0 && (
                        <button
                          type="button"
                          onClick={() => updateField(i, 'note', '')}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-emerald-600 hover:text-emerald-700"
                        >
                          <XMarkIcon className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Bottom Controls */}
        <div className="border-t bg-gray-50 p-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Schedule Note</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Schedule note (optional)"
              className="flex h-8 w-full rounded-md border border-input bg-transparent px-2 py-1 text-xs shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={() => handleSave(false)}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground h-9 px-4 py-2"
            >
              <DocumentTextIcon className="h-4 w-4" />
              {loading ? 'Saving...' : 'Save Draft'}
            </button>
            
            {(schedule?.status === 'DRAFT' || !schedule) && (
              <button
                onClick={() => handleSave(true)}
                disabled={loading}
                className="inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-green-600 text-white shadow hover:bg-green-700 h-9 px-4 py-2"
              >
                <CheckCircleIcon className="h-4 w-4" />
                {loading ? 'Activating...' : 'Create Schedule'}
              </button>
            )}

            {schedule?.status === 'ACTIVE' && (
              <button
                onClick={() => handleSave(true)}
                disabled={loading}
                className="inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-barmlo-blue text-white shadow hover:bg-barmlo-blue/90 h-9 px-4 py-2"
              >
                <CheckCircleIcon className="h-4 w-4" />
                {loading ? 'Saving...' : 'Save Changes'}
              </button>
            )}
          </div>
        </div>
      </div>
      )}

      {error && <div className="text-sm font-medium text-destructive">{error}</div>}

      {/* Employee Assignment Modal */}
      {modalOpen && activeRowIndex !== null && (
        <EmployeeAssignmentModal
            isOpen={modalOpen}
            onClose={() => {
                setModalOpen(false);
                setActiveRowIndex(null);
            }}
            employees={employees}
            selectedIds={items[activeRowIndex!]?.employeeIds ?? []}
            onSave={(ids) => updateField(activeRowIndex!, 'employeeIds', ids)}
            startDate={items[activeRowIndex!]?.plannedStart ?? null}
            endDate={items[activeRowIndex!]?.plannedEnd ?? null}
            scheduleItemId={items[activeRowIndex!]?.id ?? null}
            assignedIds={Array.from(
              new Set(
                items
                  .filter((_, idx) => idx !== activeRowIndex)
                  .flatMap((it) => it.employeeIds ?? [])
              )
            )}
            productivity={productivity}
            itemQuantity={items[activeRowIndex!]?.quantity ?? 0}
            itemUnit={items[activeRowIndex!]?.unit ?? null}
            itemTitle={items[activeRowIndex!]?.title ?? ''}
            itemDescription={items[activeRowIndex!]?.description ?? null}
        />
      )}
    </div>
  );
}
