import * as React from 'react';
import { cn } from '@/lib/utils';

const STATUS_MAP = {
  DR: { label: 'Draft', className: 'bg-slate-100 text-slate-600 ring-slate-200' },
  CO: { label: 'Complete', className: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  VO: { label: 'Void', className: 'bg-red-50 text-red-600 ring-red-200' },
  IP: { label: 'In Process', className: 'bg-amber-50 text-amber-700 ring-amber-200' },
};

export function StatusBadge({ status }) {
  const config = STATUS_MAP[status] || { label: status, className: 'bg-slate-100 text-slate-600 ring-slate-200' };
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset', config.className)}>
      {config.label}
    </span>
  );
}
