import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Label } from '@etendosoftware/app-shell-core/components/ui/label';

export function CountrySelect({ id, label, required = false, value, onChange, options = [] }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const handleOutsideEvent = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
      }
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideEvent);
    document.addEventListener('keydown', handleOutsideEvent);
    return () => {
      document.removeEventListener('mousedown', handleOutsideEvent);
      document.removeEventListener('keydown', handleOutsideEvent);
    };
  }, [open]);

  const selected = options.find((option) => option.value === value) || null;

  return (
    <div className="relative" ref={containerRef}>
      <Label
        htmlFor={id}
        className="mb-2 block text-sm font-medium leading-6 text-slate-900"
        data-testid="Label__79cf84">
        {label}
        {required && <span className="ml-1 text-rose-500">*</span>}
      </Label>
      <button
        type="button"
        id={id}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        className="flex h-10 w-full items-center justify-between gap-2 rounded-lg border border-[#D1D4DB] bg-white px-3 text-base text-slate-900 shadow-[0_1px_2px_rgba(18,18,23,0.05)] transition-colors hover:border-slate-400 focus:outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-900/5"
        data-testid="CountrySelect-trigger__79cf84"
      >
        <span className="flex items-center gap-2 truncate">
          {selected ? (
            <>
              <span aria-hidden="true">{selected.flag}</span>
              <span>{selected.label}</span>
            </>
          ) : (
            <span className="text-slate-400">&nbsp;</span>
          )}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" data-testid="ChevronDown__79cf84" />
      </button>
      {open && (
        <ul
          role="listbox"
          className="absolute z-10 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-[#D1D4DB] bg-white py-1 shadow-[0_4px_16px_rgba(18,18,23,0.12)]"
          data-testid="CountrySelect-listbox__79cf84"
        >
          {options.map((option) => (
            <li key={option.value} role="option" aria-selected={option.value === value}>
              <button
                type="button"
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-base hover:bg-slate-50 ${
                  option.value === value ? 'bg-slate-50 font-medium text-slate-900' : 'text-slate-900'
                }`}
                data-testid={`CountrySelect-option-${option.value}__79cf84`}
              >
                <span aria-hidden="true">{option.flag}</span>
                <span>{option.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default CountrySelect;
