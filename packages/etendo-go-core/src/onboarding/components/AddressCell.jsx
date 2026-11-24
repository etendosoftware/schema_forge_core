import React from 'react';
import { useUI } from '@etendosoftware/app-shell-core/i18n';
import { exceedsLimit } from '../fieldLimits.js';

/**
 * ETP-5806 design follow-up — one cell of the "compound address field" used by
 * CompanyStep.jsx. Street/Number/Building Name are visually one field (a single outer
 * border, divided internally by thin lines) instead of three separate bordered inputs,
 * so the block reads as "one piece of data: the address". The cell itself carries no
 * border — the border belongs to the shared frame in CompanyStep.jsx — and the label
 * sits inside the cell, small and muted, stacked above the value like a compound
 * card-details input (month/year/CVV in one block).
 *
 * ETP-5806 CP-13 (QA finding) — the cell also COMMUNICATES its length limit instead of
 * silently enforcing it, the same contract LocationEditorModal's LimitedTextField gives
 * the other three address pop-ups. Pass `max` (the enforced cap) and the cell renders a
 * counter next to the label and a note once the value reaches it; pass a looser
 * `maxLength` and a value above `max` stays in the field, turns the counter red and is
 * reported through `error` by the caller, instead of being truncated with no signal.
 *
 * Accessibility: the counter is wired into the input's `aria-describedby` rather than
 * being a live region — it changes on every keystroke, and announcing "31/60", "32/60"…
 * would bury everything else — while the "limit reached" note is `role="status"` /
 * `aria-live="polite"` because it appears on a change the user did not ask for.
 *
 * @param {number} [max] the enforced cap the counter counts against; omit for a cell with
 *     no limit to communicate (the counter and the note are then not rendered at all)
 */
export function AddressCell({ id, label, trailingLabel, required = false, error, max, className = '', ...props }) {
  const ui = useUI();
  // Measured exactly as the Start gate (`isCompanyStepValid`) and the backend measure it: on
  // the TRIMMED value, and in code points through `exceedsLimit`. Counting the raw value made a
  // 60-char street plus one trailing space read as a red "61/60" with aria-invalid while no
  // error rendered and Start stayed enabled — the field and the gate disagreed.
  const measured = String(props.value ?? '').trim();
  const length = [...measured].length;
  const showCounter = Number.isFinite(max);
  const overLimit = showCounter && exceedsLimit(measured, max);
  const atLimit = showCounter && length === max;

  const counterId = `${id}-counter`;
  const errorId = `${id}-error`;
  const atLimitId = `${id}-at-limit`;
  const describedBy = [showCounter ? counterId : null, error ? errorId : null,
    atLimit ? atLimitId : null].filter(Boolean).join(' ') || undefined;

  return (
    <div className={`px-4 py-2.5 ${className}`}>
      <div className="flex items-baseline justify-between gap-2">
        <label
          htmlFor={id}
          className="block text-xs font-medium leading-4 text-slate-500"
          data-testid="AddressCell-label__79cf84">
          {label}
          {required && <span className="ml-1 text-rose-500">*</span>}
          {trailingLabel && <span className="ml-1 font-normal text-slate-400">{trailingLabel}</span>}
        </label>
        {showCounter && (
          <span
            id={counterId}
            className={`shrink-0 text-xs leading-4 tabular-nums ${overLimit ? 'text-rose-500' : 'text-slate-400'}`}
            data-testid={`AddressCell-counter__${id}`}
          >
            {ui('charactersUsedCounter', { used: length, max })}
          </span>
        )}
      </div>
      <input
        id={id}
        aria-invalid={Boolean(error) || overLimit}
        aria-describedby={describedBy}
        className="h-6 w-full border-0 bg-transparent p-0 text-base leading-6 text-slate-900 outline-none placeholder:text-slate-400"
        data-testid="AddressCell-input__79cf84"
        {...props}
      />
      {error && (
        <p id={errorId} className="mt-1 text-xs text-rose-500" data-testid="AddressCell-error__79cf84">
          {error}
        </p>
      )}
      {atLimit && (
        <p
          id={atLimitId}
          role="status"
          aria-live="polite"
          className="mt-1 text-xs text-slate-500"
          data-testid={`AddressCell-at-limit__${id}`}
        >
          {ui('fieldMaxLengthReached', { field: label, max })}
        </p>
      )}
    </div>
  );
}

export default AddressCell;
