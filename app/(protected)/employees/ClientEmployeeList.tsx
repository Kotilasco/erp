'use client';

import { useState } from 'react';
import { addEmployee, updateEmployeeStatus } from './actions';
import { useRouter } from 'next/navigation';

export default function ClientEmployeeList({ employees }: { employees: any[] }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const router = useRouter();

  const handleStatusChange = async (id: string, status: string) => {
    await updateEmployeeStatus(id, status);
  };

  return (
    <>
      <div className="mb-4">
        <button 
           onClick={() => setIsModalOpen(true)}
           className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700"
        >
          Add Employee
        </button>
      </div>

      <div className="bg-white shadow rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">EC Number</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {employees.map((emp) => (
              <tr key={emp.id}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">{emp.givenName} {emp.surname}</div>
                  <div className="text-sm text-gray-500">{emp.email}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{emp.role}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{emp.ecNumber}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                    ${emp.status === 'ACTIVE' ? 'bg-green-100 text-green-800' : 
                      emp.status === 'LEAVE' ? 'bg-yellow-100 text-yellow-800' : 
                      'bg-red-100 text-red-800'}`}>
                    {emp.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <select 
                    value={emp.status} 
                    onChange={(e) => handleStatusChange(emp.id, e.target.value)}
                    className="border border-gray-300 rounded p-1 text-sm"
                  >
                    <option value="ACTIVE">Active</option>
                    <option value="LEAVE">Leave</option>
                    <option value="SUSPENDED">Suspended</option>
                    <option value="DISABLED">Disabled</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
           <div className="bg-white p-6 rounded-lg w-full max-w-md">
              <h2 className="text-xl font-bold mb-4">Add New Employee</h2>
              <form action={async (fd) => {
                  const res = await addEmployee(fd);
                  if(res.ok) {
                      setIsModalOpen(false);
                      router.refresh(); // Refresh to show new employee
                  } else {
                      alert(res.error);
                  }
              }}>
                  <div className="space-y-4">
                      <div>
                          <label className="block text-sm font-medium">Given Name</label>
                          <input name="givenName" required className="w-full border p-2 rounded" />
                      </div>
                      <div>
                          <label className="block text-sm font-medium">Surname</label>
                          <input name="surname" className="w-full border p-2 rounded" />
                      </div>
                      <div>
                          <label className="block text-sm font-medium">Role</label>
                          <input name="role" required className="w-full border p-2 rounded" placeholder="e.g. Electrician" />
                      </div>
                      <div>
                          <label className="block text-sm font-medium">EC Number</label>
                          <input name="ecNumber" className="w-full border p-2 rounded" />
                      </div>
                      <div>
                          <label className="block text-sm font-medium">Email</label>
                          <input name="email" type="email" className="w-full border p-2 rounded" />
                      </div>
                      <div className="flex justify-end gap-2 mt-4">
                          <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 border rounded">Cancel</button>
                          <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded">Save</button>
                      </div>
                  </div>
              </form>
           </div>
        </div>
      )}
    </>
  );
}
