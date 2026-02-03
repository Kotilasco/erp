'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import EmployeeAssignmentModal from './EmployeeAssignmentModal';
import { PlusIcon, CalendarIcon, DocumentTextIcon, CheckCircleIcon, PencilSquareIcon, XMarkIcon } from '@heroicons/react/24/outline';

// Helper to infer task type (copied from server action logic)
function inferTaskType(unit?: string | null, description?: string | null): 'excavation' | 'brick' | 'plaster' | 'cubic' | null {
  const u = (unit || '').toLowerCase();
  const d = (description || '').toLowerCase();
  if (u.includes('m3') || u.includes('cubic')) return 'cubic';
  if (u.includes('m2') || u.includes('sqm') || d.includes('plaster')) return 'plaster';
  if (u.includes('brick') || d.includes('brick')) return 'brick';
  if (u === 'm' || d.includes('excav')) return 'excavation';
  return null;
}

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
};

type ProductivitySettings = {
  builderShare: number;
  excavationBuilder: number;
  excavationAssistant: number;
  brickBuilder: number;
  brickAssistant: number;
  plasterBuilder: number;
  plasterAssistant: number;
  cubicBuilder: number;
  cubicAssistant: number;
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
  /* ... inside ScheduleEditor ... */
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
  }));

  const [items, setItems] = useState<Item[]>(initItems);
  const [note, setNote] = useState<string>(schedule?.note ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);

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

  const calculateSchedule = useCallback((currentItems: Item[]) => {
    if (!projectStartDate) return currentItems;

    let currentStart = new Date(projectStartDate);
    // Set start time to 07:00
    currentStart.setHours(7, 0, 0, 0);

    // Helper to add working time
    const addWorkingTime = (startDate: Date, hours: number): Date => {
      let remainingHours = hours;
      let date = new Date(startDate);

      while (remainingHours > 0) {
        // Check if current day is weekend (Sat=6, Sun=0)
        const day = date.getDay();
        if (day === 0 || day === 6) {
          // Move to next Monday 07:00
          date.setDate(date.getDate() + (day === 6 ? 2 : 1));
          date.setHours(7, 0, 0, 0);
          continue;
        }

        // Current work day ends at 17:00
        const workEnd = new Date(date);
        workEnd.setHours(17, 0, 0, 0);

        // If currently before 07:00, move to 07:00
        if (date.getHours() < 7) {
          date.setHours(7, 0, 0, 0);
        }
        // If currently after 17:00, move to next day 07:00
        if (date.getHours() >= 17) {
          date.setDate(date.getDate() + 1);
          date.setHours(7, 0, 0, 0);
          continue;
        }

        const msRemainingToday = workEnd.getTime() - date.getTime();
        const hoursRemainingToday = msRemainingToday / (1000 * 60 * 60);

        if (hoursRemainingToday >= remainingHours) {
          date.setTime(date.getTime() + remainingHours * 60 * 60 * 1000);
          remainingHours = 0;
        } else {
          remainingHours -= hoursRemainingToday;
          date.setDate(date.getDate() + 1);
          date.setHours(7, 0, 0, 0);
        }
      }
      return date;
    };

    const addGap = (date: Date, minutes: number): Date => {
      let newDate = new Date(date.getTime() + minutes * 60000);
      // If gap pushes past 17:00, move to next day 07:00
      if (newDate.getHours() >= 17 || (newDate.getHours() === 16 && newDate.getMinutes() > 59)) { // simplified check
         // Actually, let's just check if it's past 17:00
         const endOfDay = new Date(newDate);
         endOfDay.setHours(17, 0, 0, 0);
         if (newDate > endOfDay) {
             newDate.setDate(newDate.getDate() + 1);
             newDate.setHours(7, 0, 0, 0);
         }
      }
      // Handle weekends after gap
      const day = newDate.getDay();
      if (day === 0 || day === 6) {
         newDate.setDate(newDate.getDate() + (day === 6 ? 2 : 1));
         newDate.setHours(7, 0, 0, 0);
      }
      // Handle before 7am
      if (newDate.getHours() < 7) {
          newDate.setHours(7, 0, 0, 0);
      }

      return newDate;
    };

    return currentItems.map((item) => {
      const type = inferTaskType(item.unit, item.description);
      const qty = Number(item.quantity ?? 0);
      const numEmployees = item.employeeIds?.length || 0;
      
      let estHours = 8; // Default fallback

      if (type && qty > 0 && numEmployees > 0) {
        const builders = Math.max(1, Math.round(numEmployees * productivity.builderShare));
        const assistants = Math.max(0, numEmployees - builders);

        const rates = (() => {
          switch (type) {
            case 'excavation': return { b: productivity.excavationBuilder, a: productivity.excavationAssistant };
            case 'brick': return { b: productivity.brickBuilder, a: productivity.brickAssistant };
            case 'plaster': return { b: productivity.plasterBuilder, a: productivity.plasterAssistant };
            case 'cubic': return { b: productivity.cubicBuilder, a: productivity.cubicAssistant };
            default: return { b: 0, a: 0 };
          }
        })();

        const daily = builders * rates.b + assistants * rates.a;
        if (daily > 0) {
          const days = qty / daily;
          estHours = days * 10; // 10-hour workday (07:00 - 17:00)
        }
      } else if (item.estHours) {
          // Keep existing estimate if manually set or calculated previously
          estHours = item.estHours;
      }

      const start = new Date(currentStart);
      const end = addWorkingTime(start, estHours);

      // Update currentStart for next task
      currentStart = addGap(end, gapMinutes);

      return {
        ...item,
        plannedStart: start.toISOString().slice(0, 10),
        plannedEnd: end.toISOString().slice(0, 10),
        estHours: Number(estHours.toFixed(2)),
        employees: numEmployees, // Sync employee count
      };
    });
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
      {/* Top Controls - Only show if items exist */}
      {items.length > 0 && (
      <div className="flex flex-wrap items-end gap-6 bg-white p-4 rounded-lg border shadow-sm">
        <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Project Start Date</label>
            <input
                type="date"
                value={projectStartDate}
                onChange={(e) => setProjectStartDate(e.target.value)}
                className="flex h-8 w-full rounded-md border border-input bg-transparent px-2 py-1 text-xs shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
        </div>
        <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Gap Between Tasks</label>
            <div className="flex items-center gap-2">
                <input
                    type="number"
                    min="0"
                    value={gapMinutes}
                    onChange={(e) => setGapMinutes(Number(e.target.value))}
                    className="flex h-8 w-20 rounded-md border border-input bg-transparent px-2 py-1 text-xs shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
                <span className="text-xs text-gray-500">minutes</span>
            </div>
        </div>
        <div className="flex-1"></div>
        <div className="flex items-center gap-3">
             {/* <button
                onClick={addRow}
                className="inline-flex items-center justify-center gap-2 rounded-md text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-green-500 text-white shadow hover:bg-green-600 h-8 px-3 py-1"
            >
                <PlusIcon className="h-3 w-3" />
                Add Row
            </button> */}
             {/* {items.length === 0 && (
                <button
                    onClick={handleExtract}
                    disabled={extracting}
                    className="inline-flex items-center justify-center rounded-md text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground h-8 px-3 py-1"
                >
                    {extracting ? 'Extracting...' : 'Extract from Quote'}
                </button>
            )} */}
        </div>
      </div>
      )}

      {items.length === 0 && (
        <div className="flex justify-center items-center min-h-[60vh] p-4">
            <button
                onClick={handleExtract}
                disabled={extracting}
                className="flex flex-col items-center justify-center gap-6 rounded-2xl bg-green-500 p-12 text-white shadow-2xl transition-all hover:bg-green-600 hover:shadow-green-500/50 hover:scale-[1.02] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 w-full max-w-4xl h-[50vh] border-none"
            >
                <div className="rounded-full bg-white/20 p-8 backdrop-blur-sm ring-8 ring-white/10">
                    <DocumentTextIcon className="h-24 w-24 text-white" />
                </div>
                <div className="text-center space-y-2">
                    <span className="block text-4xl font-extrabold tracking-tight">Extract from Quote</span>
                    <span className="block text-lg font-medium text-white/90">
                        {extracting ? 'Extracting items...' : 'Click to populate schedule items'}
                    </span>
                </div>
            </button>
        </div>
      )}

      {items.length > 0 && (
      <div className="rounded-md border bg-white">
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
                <tr key={it.id ?? i} className="hover:bg-muted/50 transition-colors">
                  <td className="px-2 py-1">
                    <input
                      value={it.title}
                      onChange={(e) => updateField(i, 'title', e.target.value)}
                      className="flex h-8 w-full rounded-md border border-input bg-transparent px-2 py-1 text-xs shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      placeholder="Task name"
                    />
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
      </div>
      )}

      {items.length > 0 && (
      <div className="flex items-center justify-between pt-4 border-t">
        <div className="flex-1 max-w-sm">
          <input
            value={note ?? ''}
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
                <CalendarIcon className="h-4 w-4" />
                {loading ? 'Processing...' : 'Create Schedule'}
                </button>
            )}

            {schedule?.status === 'ACTIVE' && (
                  <button
                  onClick={() => handleSave(true)} // Keep active
                  disabled={loading}
                  className="inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-barmlo-blue text-white shadow hover:bg-barmlo-blue/90 h-9 px-4 py-2"
                  >
                  <CheckCircleIcon className="h-4 w-4" />
                  {loading ? 'Saving...' : 'Save Changes'}
                  </button>
             )}
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
            selectedIds={items[activeRowIndex].employeeIds ?? []}
            onSave={(ids) => updateField(activeRowIndex, 'employeeIds', ids)}
            startDate={items[activeRowIndex].plannedStart ?? null}
            endDate={items[activeRowIndex].plannedEnd ?? null}
            scheduleItemId={items[activeRowIndex].id}
            assignedIds={Array.from(
              new Set(
                items
                  .filter((_, idx) => idx !== activeRowIndex)
                  .flatMap((it) => it.employeeIds ?? [])
              )
            )}
        />
      )}
    </div>
  );
}
