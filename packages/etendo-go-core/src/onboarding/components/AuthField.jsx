import React from 'react';
import { Input } from '@etendosoftware/app-shell-core/components/ui/input';
import { Label } from '@etendosoftware/app-shell-core/components/ui/label';

/**
 * `leading` is a short fixed text shown inside the field before the value (a dialling code); it
 * takes the place of `icon`, which is ignored when both are given.
 */
export function AuthField({ id, label, required = false, icon: Icon, leading, trailing, error, className = '', inputClassName = '', ...props }) {
  const showIcon = Icon && !leading;
  let leftPadding = 'pl-4';
  if (leading) leftPadding = 'pl-16';
  else if (showIcon) leftPadding = 'pl-12';
  return (
    <div className={className}>
      {/* No label when the caller labels the field itself (the phone shares one with its prefix). */}
      {label && (
        <Label
          htmlFor={id}
          className="mb-2 block text-sm font-medium leading-6 text-[#121217]"
          data-testid="Label__79cf84">
          {label}
          {required && <span className="ml-1 text-[#F53D6B]">*</span>}
        </Label>
      )}
      <div className="relative">
        {showIcon && (
          <Icon
            className="pointer-events-none absolute left-4 top-1/2 h-6 w-6 -translate-y-1/2 text-[#828FA3]"
            data-testid="Icon__79cf84" />
        )}
        {leading && (
          <span
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm text-[#828FA3]"
            data-testid={`${id}-leading`}>
            {leading}
          </span>
        )}
        <Input
          id={id}
          aria-required={required}
          aria-invalid={Boolean(error)}
          className={`h-10 rounded-lg border border-[#D1D4DB] bg-white text-sm text-[#121217] shadow-[0_1px_2px_rgba(18,18,23,0.05)] transition-colors placeholder:text-slate-400 hover:border-slate-400 focus-visible:border-slate-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${error ? 'border-rose-300' : ''} ${leftPadding} ${trailing ? 'pr-14' : 'pr-4'} ${inputClassName}`}
          data-testid="Input__79cf84"
          {...props} />
        {trailing && <div className="absolute inset-y-0 right-3 flex items-center">{trailing}</div>}
      </div>
      {error && (
        <p className="mt-1.5 text-xs font-medium text-rose-600" data-testid={`${id}-error`}>
          {error}
        </p>
      )}
    </div>
  );
}

export default AuthField;
