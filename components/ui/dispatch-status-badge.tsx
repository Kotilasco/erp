'use client';

import { DispatchStatus } from '@prisma/client';

interface DispatchStatusBadgeProps {
  status: string; // We use string to be flexible, but it usually comes from DispatchStatus
}

export function DispatchStatusBadge({ status }: DispatchStatusBadgeProps) {
  const statusConfig: Record<string, { label: string; className: string }> = {
    DRAFT: { label: 'Draft', className: 'bg-gray-100 text-gray-700 ring-gray-600/20' },
    PENDING: { label: 'Pending', className: 'bg-yellow-100 text-yellow-800 ring-yellow-600/20' },
    SUBMITTED: { label: 'Submitted', className: 'bg-blue-100 text-blue-700 ring-blue-600/20' },
    APPROVED: { label: 'Approved', className: 'bg-emerald-100 text-emerald-700 ring-emerald-600/20' },
    DISPATCHED: { label: 'Dispatched', className: 'bg-indigo-100 text-indigo-700 ring-indigo-600/20' },
    OUT_FOR_DELIVERY: { label: 'Out for Delivery', className: 'bg-purple-100 text-purple-700 ring-purple-600/20' },
    DELIVERED: { label: 'Delivered', className: 'bg-teal-100 text-teal-700 ring-teal-600/20' },
    IN_TRANSIT: { label: 'In Transit', className: 'bg-orange-100 text-orange-700 ring-orange-600/20' },
    REJECTED: { label: 'Rejected', className: 'bg-red-100 text-red-700 ring-red-600/20' },
  };

  const config = statusConfig[status] || { 
    label: status?.replace(/_/g, ' ') || 'Unknown', 
    className: 'bg-gray-100 text-gray-800 ring-gray-600/20' 
  };

  return (
    <span
      className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${config.className}`}
    >
      {config.label}
    </span>
  );
}
