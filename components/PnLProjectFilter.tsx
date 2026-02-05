'use client';

import { useRouter, useSearchParams } from 'next/navigation';

interface Project {
  id: string;
  name: string;
  customer?: {
    displayName: string;
  } | null;
}

export default function PnLProjectFilter({ projects }: { projects: Project[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentProjectId = searchParams.get('projectId') || '';

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    const params = new URLSearchParams(searchParams.toString());
    
    if (val) {
      params.set('projectId', val);
    } else {
      params.delete('projectId');
    }
    
    // Reset pagination when filter changes
    params.delete('page');
    
    router.push(`?${params.toString()}`);
  };

  return (
    <div className="flex items-center gap-2">
        <label htmlFor="project-select" className="text-sm font-medium text-gray-700 whitespace-nowrap">
            Filter by Project:
        </label>
        <div className="relative">
            <select
                id="project-select"
                value={currentProjectId}
                onChange={handleChange}
                className="block w-full rounded-md border-0 py-1.5 pl-3 pr-10 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-indigo-600 sm:text-sm sm:leading-6 min-w-[200px]"
            >
                <option value="">All Projects</option>
                {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                        {p.customer?.displayName || p.name}
                    </option>
                ))}
            </select>
        </div>
    </div>
  );
}
