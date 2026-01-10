'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

type NavLink = {
  label: string;
  href: string;
  icon: string;
};

export function SidebarNavigation({ links }: { links: NavLink[] }) {
  const pathname = usePathname();
  
  // Dynamic replacement logic
  const processedLinks = links.map(link => {
    // If we are in looking at a specific project, update 'Requisitions' link
    if (link.label === 'Requisitions' && pathname.startsWith('/projects/')) {
        const match = pathname.match(/\/projects\/([^\/]+)/);
        if (match && match[1]) {
            return { ...link, href: `/projects/${match[1]}/requisitions` };
        }
    }
    return link;
  });

  return (
    <nav className="flex flex-col gap-2 p-2">
      {processedLinks.map(p => {
        const isActive = pathname === p.href || (p.href !== '/dashboard' && pathname.startsWith(p.href)); // Basic active state check logic if needed
        return (
          <Link 
            key={p.href} 
            href={p.href} 
            className={`px-3 py-2 rounded text-gray-700 hover:bg-gray-200 ${isActive ? 'bg-gray-200 font-medium' : 'bg-gray-100'}`}
          >
            {p.label}
          </Link>
        );
      })}
    </nav>
  );
}
