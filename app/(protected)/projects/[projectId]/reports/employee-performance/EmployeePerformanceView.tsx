"use strict";
"use client";

import { useState } from "react";
import { 
  UserGroupIcon, 
  ChatBubbleLeftRightIcon, 
  ClockIcon,
  ArrowsRightLeftIcon,
  TableCellsIcon,
  MagnifyingGlassIcon
} from '@heroicons/react/24/outline';

export type EmployeeStat = {
  id: string;
  name: string;
  role: string;
  tasksAssigned: number;
  tasksCompleted: number;
  reportsSubmitted: number;
  lastActive: string | null;
};

export default function EmployeePerformanceView({ employees }: { employees: EmployeeStat[] }) {
  const [viewMode, setViewMode] = useState<'LIST' | 'COMPARE'>('LIST');
  const [compareA, setCompareA] = useState<string>(employees[0]?.id || '');
  const [compareB, setCompareB] = useState<string>(employees[1]?.id || '');
  const [searchTerm, setSearchTerm] = useState('');

  const empA = employees.find(e => e.id === compareA);
  const empB = employees.find(e => e.id === compareB);

  const filteredEmployees = employees.filter(e => 
    e.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    e.role.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
       {/* View Toggles */}
       <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
           {/* Search only shows in List mode */}
           <div className={`relative flex-1 max-w-sm ${viewMode === 'COMPARE' ? 'invisible' : ''}`}>
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />
                </div>
                <input
                    type="text"
                    className="block w-full rounded-md border-0 py-1.5 pl-10 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                    placeholder="Search employees..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
           </div>

           {/* Tabs */}
           <div className="flex rounded-lg bg-gray-100 p-1 self-start sm:self-auto">
                <button
                    onClick={() => setViewMode('LIST')}
                    className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-all ${
                        viewMode === 'LIST' 
                        ? 'bg-white text-gray-900 shadow-sm' 
                        : 'text-gray-500 hover:text-gray-900'
                    }`}
                >
                    <TableCellsIcon className="h-4 w-4" />
                    List View
                </button>
                <button
                    onClick={() => setViewMode('COMPARE')}
                    className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-all ${
                        viewMode === 'COMPARE' 
                        ? 'bg-white text-gray-900 shadow-sm' 
                        : 'text-gray-500 hover:text-gray-900'
                    }`}
                >
                    <ArrowsRightLeftIcon className="h-4 w-4" />
                    Compare
                </button>
           </div>
       </div>

       {viewMode === 'LIST' ? (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Employee</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                            <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Tasks Assigned</th>
                            <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Tasks Completed</th>
                            <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Completion Rate</th>
                            <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Reports</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider pl-8">Last Activity</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {filteredEmployees.map((emp) => {
                            const completionRate = emp.tasksAssigned > 0 ? (emp.tasksCompleted / emp.tasksAssigned) * 100 : 0;
                            return (
                                <tr key={emp.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center">
                                            <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-xs ring-2 ring-white">
                                                {emp.name.charAt(0)}
                                            </div>
                                            <div className="ml-4">
                                                <div className="text-sm font-medium text-gray-900">{emp.name}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-800">
                                            {emp.role.replace(/_/g, ' ')}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-500">
                                        {emp.tasksAssigned}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900 font-semibold">
                                        {emp.tasksCompleted}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-500">
                                        <div className="flex items-center justify-end gap-2">
                                            <span>{completionRate.toFixed(0)}%</span>
                                            <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                                <div 
                                                    className={`h-full rounded-full ${completionRate === 100 ? 'bg-emerald-500' : 'bg-blue-500'}`} 
                                                    style={{ width: `${completionRate}%` }}
                                                />
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-500">
                                        {emp.reportsSubmitted > 0 ? (
                                             <span className="inline-flex items-center gap-1 text-indigo-600 font-medium">
                                                 <ChatBubbleLeftRightIcon className="h-4 w-4" />
                                                 {emp.reportsSubmitted}
                                             </span>
                                        ) : (
                                            '-'
                                        )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 pl-8">
                                        {emp.lastActive ? (
                                            <div className="flex items-center gap-1.5 ">
                                                <ClockIcon className="h-4 w-4 text-gray-400" />
                                                <span>{new Date(emp.lastActive).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                                            </div>
                                        ) : (
                                            <span className="text-gray-300 italic">No activity</span>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
       ) : (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 md:p-8">
                {/* Selectors */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8 relative">
                    {/* Divider Icon */}
                    <div className="hidden md:flex absolute left-1/2 top-10 -translate-x-1/2 items-center justify-center h-10 w-10 bg-gray-100 rounded-full ring-4 ring-white z-10">
                        <span className="text-xs font-bold text-gray-500">VS</span>
                    </div>

                    {/* Employee A */}
                    <div className="bg-gray-50/50 rounded-xl p-4 border border-gray-100">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Detailed Analysis For</label>
                        <select 
                            value={compareA} 
                            onChange={(e) => setCompareA(e.target.value)}
                            className="block w-full rounded-md border-0 py-1.5 pl-3 pr-10 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-indigo-600 sm:text-sm sm:leading-6"
                        >
                            {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                        </select>
                        
                        {empA && (
                            <div className="mt-6 flex flex-col items-center text-center">
                                <div className="h-20 w-20 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-2xl ring-4 ring-white mb-3">
                                    {empA.name.charAt(0)}
                                </div>
                                <h3 className="text-lg font-bold text-gray-900">{empA.name}</h3>
                                <div className="mt-1 inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-800">
                                    {empA.role.replace(/_/g, ' ')}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Employee B */}
                    <div className="bg-gray-50/50 rounded-xl p-4 border border-gray-100">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Compare Against</label>
                        <select 
                            value={compareB} 
                            onChange={(e) => setCompareB(e.target.value)}
                            className="block w-full rounded-md border-0 py-1.5 pl-3 pr-10 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-indigo-600 sm:text-sm sm:leading-6"
                        >
                            {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                        </select>

                        {empB && (
                            <div className="mt-6 flex flex-col items-center text-center">
                                <div className="h-20 w-20 rounded-full bg-green-100 flex items-center justify-center text-green-700 font-bold text-2xl ring-4 ring-white mb-3">
                                    {empB.name.charAt(0)}
                                </div>
                                <h3 className="text-lg font-bold text-gray-900">{empB.name}</h3>
                                <div className="mt-1 inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-800">
                                    {empB.role.replace(/_/g, ' ')}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Comparison Stats */}
                {empA && empB && (
                    <div className="space-y-6 max-w-2xl mx-auto">
                        <StatRow 
                            label="Tasks Assigned" 
                            valA={empA.tasksAssigned} 
                            valB={empB.tasksAssigned} 
                            winner={empA.tasksAssigned > empB.tasksAssigned ? 'A' : empA.tasksAssigned < empB.tasksAssigned ? 'B' : 'Draw'} 
                        />
                        <StatRow 
                            label="Tasks Completed" 
                            valA={empA.tasksCompleted} 
                            valB={empB.tasksCompleted} 
                            winner={empA.tasksCompleted > empB.tasksCompleted ? 'A' : empA.tasksCompleted < empB.tasksCompleted ? 'B' : 'Draw'}
                        />
                         <StatRow 
                            label="Completion Rate" 
                            valA={empA.tasksAssigned > 0 ? Math.round((empA.tasksCompleted / empA.tasksAssigned) * 100) : 0} 
                            valB={empB.tasksAssigned > 0 ? Math.round((empB.tasksCompleted / empB.tasksAssigned) * 100) : 0} 
                            unit="%"
                            winner="High is Good"
                        />
                         <StatRow 
                            label="Reports Submitted" 
                            valA={empA.reportsSubmitted} 
                            valB={empB.reportsSubmitted} 
                            winner={empA.reportsSubmitted > empB.reportsSubmitted ? 'A' : empA.reportsSubmitted < empB.reportsSubmitted ? 'B' : 'Draw'}
                        />
                    </div>
                )}
            </div>
       )}
    </div>
  );
}

function StatRow({ label, valA, valB, winner, unit = '' }: { label: string, valA: number, valB: number, winner?: 'A' | 'B' | 'Draw' | 'High is Good', unit?: string }) {
    let colorA = 'bg-gray-200';
    let colorB = 'bg-gray-200';
    
    if (winner === 'A' || (winner === 'High is Good' && valA > valB)) {
        colorA = 'bg-indigo-500';
    } else if (winner === 'B' || (winner === 'High is Good' && valB > valA)) {
        colorB = 'bg-green-500';
    } else if (winner === 'Draw' || valA === valB) {
        colorA = 'bg-gray-400';
        colorB = 'bg-gray-400';
    }

    const total = valA + valB || 1; 
    const widthA = (valA / total) * 100;
    const widthB = (valB / total) * 100;

    return (
        <div className="relative">
            <div className="flex justify-between text-sm font-semibold mb-1">
                <span className={winner === 'A' || (winner === 'High is Good' && valA > valB) ? 'text-indigo-600' : 'text-gray-500'}>{valA}{unit}</span>
                <span className="text-gray-400 font-medium text-xs uppercase">{label}</span>
                <span className={winner === 'B' || (winner === 'High is Good' && valB > valA) ? 'text-green-600' : 'text-gray-500'}>{valB}{unit}</span>
            </div>
            <div className="flex w-full h-2 rounded-full overflow-hidden bg-gray-100">
                <div style={{ width: `${valA === 0 && valB === 0 ? 50 : (valA / (valA + valB)) * 100}%` }} className={`h-full ${colorA} transition-all duration-500`}></div>
                <div className="w-0.5 h-full bg-white z-10"></div>
                <div style={{ width: `${valA === 0 && valB === 0 ? 50 : (valB / (valA + valB)) * 100}%` }} className={`h-full ${colorB} transition-all duration-500`}></div>
            </div>
        </div>
    );
}
