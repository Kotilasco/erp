import React, { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { checkEmployeeAvailability } from './actions';
import { 
  calculateDuration, 
  addWorkingTime, 
  ProductivitySettings, 
  ScheduleItemMinimal 
} from '@/lib/schedule-engine';

type Employee = {
  id: string;
  givenName: string;
  surname?: string | null;
  role: string;
  status?: string;
};

export default function EmployeeAssignmentModal({
  isOpen,
  onClose,
  employees,
  selectedIds,
  onSave,
  startDate,
  endDate,
  scheduleItemId,
  assignedIds,
  productivity,
  itemQuantity,
  itemUnit,
  itemTitle,
  itemDescription,
}: {
  isOpen: boolean;
  onClose: () => void;
  employees: Employee[];
  selectedIds: string[];
  onSave: (ids: string[]) => void;
  startDate: string | null;
  endDate: string | null;
  scheduleItemId?: string | null;
  assignedIds: string[];
  productivity: ProductivitySettings;
  itemQuantity: number | null;
  itemUnit?: string | null;
  itemTitle: string;
  itemDescription?: string | null;
}) {
  const [localSelected, setLocalSelected] = useState<string[]>(selectedIds);
  const [busyEmployees, setBusyEmployees] = useState<string[]>([]);
  const [checking, setChecking] = useState(false);
  const [projectedEnd, setProjectedEnd] = useState<string | null>(endDate);
  const [conflicts, setConflicts] = useState<string[]>([]);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    Assistants: false,
    Builders: false,
    Carpenters: false,
    Electricians: false,
    Plumbers: false,
    Painters: false,
    'Aluminium Fiters': false,
  });

  const checkAvailability = useCallback(async (currentStart: string, currentEnd: string) => {
    setChecking(true);
    try {
      const allIds = employees.map(e => e.id);
      const result = await checkEmployeeAvailability(allIds, currentStart, currentEnd, scheduleItemId ?? undefined);
      setBusyEmployees(result.busy);
    } catch (err) {
      console.error('Failed to check availability', err);
    } finally {
      setChecking(false);
    }
  }, [employees, scheduleItemId]);

  // Handle local projections
  useEffect(() => {
    if (!startDate) return;

    const duration = calculateDuration({
        title: itemTitle,
        description: itemDescription,
        unit: itemUnit,
        quantity: itemQuantity,
        employeeIds: localSelected
    }, productivity);

    const start = new Date(startDate);
    const end = addWorkingTime(start, duration);
    const endStr = end.toISOString().slice(0, 10);
    setProjectedEnd(endStr);

    checkAvailability(startDate, endStr);
  }, [localSelected, startDate, itemTitle, itemDescription, itemUnit, itemQuantity, productivity, checkAvailability]);

  // Reset local state when modal opens
  useEffect(() => {
    if (isOpen) {
      setLocalSelected(selectedIds);
    }
  }, [isOpen, selectedIds]);

  const categories = [
    'Assistants',
    'Builders',
    'Carpenters',
    'Electricians',
    'Plumbers',
    'Painters',
    'Aluminium Fiters',
  ];

  const normalize = (s: string) => s.trim().toLowerCase();
  const roleToCategory = (r: string) => {
    const n = normalize(r);
    if (n.includes('assistant')) return 'Assistants';
    if (n.includes('builder')) return 'Builders';
    if (n.includes('carpenter')) return 'Carpenters';
    if (n.includes('electric')) return 'Electricians';
    if (n.includes('plumb')) return 'Plumbers';
    if (n.includes('paint')) return 'Painters';
    if (n.includes('aluminium') || n.includes('aluminum') || n.includes('fitter') || n.includes('fiters')) return 'Aluminium Fiters';
    return 'Assistants';
  };

  const grouped: Record<string, Employee[]> = {};
  categories.forEach((c) => (grouped[c] = []));
  employees.forEach((e) => {
    // Only show ACTIVE employees (unless they are already selected, we might want to keep showing them to unselect?)
    if (e.status && e.status !== 'ACTIVE' && !selectedIds.includes(e.id)) return;
    
    const c = roleToCategory(e.role);
    (grouped[c] ||= []).push(e);
  });

  const toggleEmployee = (id: string) => {
    if (localSelected.includes(id)) {
      setLocalSelected(localSelected.filter((sid) => sid !== id));
    } else {
      setLocalSelected([...localSelected, id]);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl rounded-lg bg-white shadow-xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">Assign Employees</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-4 flex-1 overflow-hidden flex flex-col">
          <div className="flex flex-col gap-1">
            <div className="text-sm text-gray-600">
              {checking ? 'Checking availability...' : 'Select employees by category'}
            </div>
            {projectedEnd && projectedEnd !== endDate && (
              <div className="text-xs font-semibold text-orange-600 animate-pulse">
                ⚠️ Warning: Reducing workers extends task until {projectedEnd}
              </div>
            )}
          </div>
          <div className="flex-1 overflow-y-auto border rounded-md">
            <div className="divide-y divide-gray-100">
              {categories.map((cat) => {
                const list = grouped[cat] || [];
                // Sort list: alreadyAssigned first, then alphabetically
                list.sort((a, b) => {
                    const aAssigned = assignedIds.includes(a.id);
                    const bAssigned = assignedIds.includes(b.id);
                    if (aAssigned && !bAssigned) return -1;
                    if (!aAssigned && bAssigned) return 1;
                    return a.givenName.localeCompare(b.givenName);
                });
                const open = openSections[cat];
                return (
                  <div key={cat}>
                    <button
                      type="button"
                      onClick={() =>
                        setOpenSections({ ...openSections, [cat]: !open })
                      }
                      className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
                    >
                      <span className="text-sm font-semibold text-gray-900">{cat}</span>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        className={cn("h-4 w-4 transition-transform", open ? "rotate-180" : "")}
                      >
                        <path d="m6 9 6 6 6-6" />
                      </svg>
                    </button>
                    {open && (
                      <div className="divide-y divide-gray-100">
                        {list.length === 0 ? (
                          <div className="px-4 py-3 text-sm text-gray-500">No employees</div>
                        ) : (
                          list.map((emp) => {
                            const isSelected = localSelected.includes(emp.id);
                            const isBusy = busyEmployees.includes(emp.id);
                            const alreadyAssigned = assignedIds.includes(emp.id);
                            return (
                              <label
                                key={emp.id}
                                className={cn(
                                  "flex items-center justify-between px-4 py-3 cursor-pointer transition-colors",
                                  isBusy ? "bg-gray-100 text-gray-400" : "hover:bg-gray-50"
                                )}
                              >
                                <div className="flex items-center gap-3">
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => toggleEmployee(emp.id)}
                                    disabled={isBusy && !isSelected}
                                    className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                                  />
                                  <div>
                                    <p className={cn("text-sm font-medium", isBusy ? "text-gray-500" : "text-gray-900")}>
                                      {emp.givenName} {emp.surname}
                                    </p>
                                    <p className="text-xs text-gray-500">{emp.role}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  {alreadyAssigned && (
                                    <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                                      Assigned
                                    </span>
                                  )}
                                  {isBusy && (
                                    <span className="inline-flex items-center rounded-full bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-600">
                                      Busy
                                    </span>
                                  )}
                                </div>
                              </label>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="border-t px-6 py-4 flex justify-end gap-3 bg-gray-50 rounded-b-lg">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onSave(localSelected);
              onClose();
            }}
            className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-md shadow-sm transition-colors"
          >
            Save Assignments
          </button>
        </div>
      </div>
    </div>
  );
}
