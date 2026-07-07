import React from 'react';
import { Label } from '@etendosoftware/app-shell-core/components/ui/label';

export function SetupSelect({ id, label, required = false, value, onChange, children, className = '' }) {
  return (
    <div className={className}>
      <Label
        htmlFor={id}
        className="mb-2 block text-sm font-medium leading-6 text-slate-900"
        data-testid="Label__79cf84">
        {label}
        {required && <span className="ml-1 text-rose-500">*</span>}
      </Label>
      <select
        id={id}
        value={value}
        onChange={onChange}
        className="h-10 w-full rounded-lg border border-[#D1D4DB] bg-white px-4 text-base text-slate-900 shadow-[0_1px_2px_rgba(18,18,23,0.05)] transition-colors hover:border-slate-400 focus:outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-900/5"
      >
        {children}
      </select>
    </div>
  );
}

export default SetupSelect;
