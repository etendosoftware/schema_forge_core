import React from 'react';

/**
 * ETP-5806 design follow-up — one cell of the "compound address field" used by
 * CompanyStep.jsx. Street/Number/Building Name are visually one field (a single outer
 * border, divided internally by thin lines) instead of three separate bordered inputs,
 * so the block reads as "one piece of data: the address". The cell itself carries no
 * border — the border belongs to the shared frame in CompanyStep.jsx — and the label
 * sits inside the cell, small and muted, stacked above the value like a compound
 * card-details input (month/year/CVV in one block).
 */
export function AddressCell({ id, label, trailingLabel, required = false, error, className = '', ...props }) {
  return (
    <div className={`px-4 py-2.5 ${className}`}>
      <label
        htmlFor={id}
        className="block text-xs font-medium leading-4 text-slate-500"
        data-testid="AddressCell-label__79cf84">
        {label}
        {required && <span className="ml-1 text-rose-500">*</span>}
        {trailingLabel && <span className="ml-1 font-normal text-slate-400">{trailingLabel}</span>}
      </label>
      <input
        id={id}
        aria-invalid={Boolean(error)}
        className="h-6 w-full border-0 bg-transparent p-0 text-base leading-6 text-slate-900 outline-none placeholder:text-slate-400"
        data-testid="AddressCell-input__79cf84"
        {...props}
      />
      {error && (
        <p className="mt-1 text-xs text-rose-500" data-testid="AddressCell-error__79cf84">
          {error}
        </p>
      )}
    </div>
  );
}

export default AddressCell;
