'use client';

import Link from 'next/link';

type ProjectSummary = {
  id: string;
  name: string;
  client: string;
  location: string;
  status: string;
};

type ReportsProjectListProps = {
  projects: ProjectSummary[];
  viewPath?: string;
};

export default function ReportsProjectList({ projects, viewPath }: ReportsProjectListProps) {
  if (projects.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-12 text-center text-gray-500 border border-gray-200">
        <h3 className="text-lg font-medium text-gray-900">No active projects found</h3>
        <p className="mt-1">You don't have any active projects assigned to you at the moment.</p>
      </div>
    );
  }

  return (
    <div className="bg-white shadow-sm ring-1 ring-gray-900/5 sm:rounded-xl overflow-hidden">
      <table className="min-w-full divide-y divide-gray-300">
        <thead className="bg-gray-50">
          <tr>
            <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">
              Project Name
            </th>
            <th scope="col" className="hidden px-3 py-3.5 text-left text-sm font-semibold text-gray-900 lg:table-cell">
              Client
            </th>
            <th scope="col" className="hidden px-3 py-3.5 text-left text-sm font-semibold text-gray-900 sm:table-cell">
              Location
            </th>
            <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
              Status
            </th>
            <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 bg-white">
          {projects.map((project) => (
            <tr key={project.id}>
              <td className="w-full max-w-0 py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:w-auto sm:max-w-none sm:pl-6">
                {project.name}
                <dl className="font-normal lg:hidden">
                  <dt className="sr-only">Client</dt>
                  <dd className="mt-1 truncate text-gray-700">{project.client}</dd>
                  <dt className="sr-only sm:hidden">Location</dt>
                  <dd className="mt-1 truncate text-gray-500 sm:hidden">{project.location}</dd>
                </dl>
              </td>
              <td className="hidden px-3 py-4 text-sm text-gray-500 lg:table-cell">{project.client}</td>
              <td className="hidden px-3 py-4 text-sm text-gray-500 sm:table-cell">{project.location}</td>
              <td className="px-3 py-4 text-sm text-gray-500">
                <span className="inline-flex items-center rounded-md bg-green-50 px-2 py-1 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20">
                  {project.status.replace('_', ' ')}
                </span>
              </td>
              <td className="py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                <Link
                  href={`/projects/${project.id}/${viewPath || 'reports'}`}
                  className="text-indigo-600 hover:text-indigo-900 font-bold"
                >
                  View<span className="sr-only">, {project.name}</span>
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
