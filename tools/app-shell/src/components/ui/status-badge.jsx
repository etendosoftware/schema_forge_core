import * as React from 'react';
import { cn } from '@/lib/utils';

const STATUS_MAP = {
  DR: { label: 'Draft', className: 'bg-gray-100 text-gray-700' },
  CO: { label: 'Complete', className: 'bg-green-100 text-green-700' },
  VO: { label: 'Void', className: 'bg-red-100 text-red-700' },
  IP: { label: 'In Process', className: 'bg-yellow-100 text-yellow-700' },
};

export function StatusBadge({ status }) {
  const config = STATUS_MAP[status] || { label: status, className: 'bg-gray-100 text-gray-600' };
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', config.className)}>
      {config.label}
    </span>
  );
}
