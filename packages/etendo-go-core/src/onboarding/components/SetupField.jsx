import React from 'react';
import { Input } from '@etendosoftware/app-shell-core/components/ui/input';
import { Label } from '@etendosoftware/app-shell-core/components/ui/label';

export function SetupField({ id, label, required = false, trailingLabel, error, className = '', ...props }) {
  return (
    <div className={className}>
      <Label
        htmlFor={id}
        className="mb-2 block text-sm font-medium leading-6 text-slate-900"
        data-testid="Label__79cf84">
        {label}
        {required && <span className="ml-1 text-rose-500">*</span>}
        {trailingLabel && <span className="ml-2 font-normal text-slate-500">{trailingLabel}</span>}
      </Label>
      <Input
        id={id}
        aria-invalid={Boolean(error)}
        className={`h-10 rounded-lg border bg-white px-4 text-base text-slate-900 shadow-[0_1px_2px_rgba(18,18,23,0.05)] transition-colors focus-visible:ring-4 ${
          error
            ? 'border-rose-500 hover:border-rose-500 focus-visible:border-rose-500 focus-visible:ring-rose-500/10'
            : 'border-[#D1D4DB] hover:border-slate-400 focus-visible:border-slate-400 focus-visible:ring-slate-900/5'
        }`}
        data-testid="Input__79cf84"
        {...props} />
      {error && (
        <p className="mt-1.5 text-sm text-rose-500" data-testid="SetupField-error__79cf84">
          {error}
        </p>
      )}
    </div>
  );
}

export default SetupField;
