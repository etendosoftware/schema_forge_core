import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { cn } from '../../lib/utils.js';

// ─────────────────────────────────────────────────────────────────────────────
// Shared month/year-picker chrome (ETP-4771).
//
// Extracted verbatim from date-field.jsx so both the conditional-filter date
// picker (DateField → AdvancedFilterBuilder) and the quick-filter date-range
// picker (DateRangePopover, in the functional repo) render the exact same
// header/nav/tabs/grid components instead of two independently drifting
// reimplementations. Pure, presentational, no coupling to either caller's
// internal state — all behavior is driven via props.
// ─────────────────────────────────────────────────────────────────────────────

// Header row used by every view: clickable month/year label on the left,
// circular pill nav arrows on the right.
export function HeaderRow({ label, onLabelClick, onPrev, onNext, showLabelChevron }) {
  return (
    <div className="flex items-center justify-between h-8 px-2">
      <button
        type="button"
        onClick={onLabelClick}
        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm leading-6 font-normal text-[#121217] hover:bg-[rgba(18,18,23,0.05)] capitalize"
      >
        <span>{label}</span>
        {showLabelChevron && (
          <ChevronDown
            className="h-4 w-4 text-[#828FA3]"
            aria-hidden="true"
            data-testid="ChevronDown__d56af3" />
        )}
      </button>
      <div className="flex items-center gap-2">
        <NavButton onClick={onPrev} ariaLabel="prev" data-testid="NavButton__d56af3">
          <ChevronLeft
            className="h-5 w-5 text-[#828FA3]"
            aria-hidden="true"
            data-testid="ChevronLeft__d56af3" />
        </NavButton>
        <NavButton onClick={onNext} ariaLabel="next" data-testid="NavButton__d56af3">
          <ChevronRight
            className="h-5 w-5 text-[#828FA3]"
            aria-hidden="true"
            data-testid="ChevronRight__d56af3" />
        </NavButton>
      </div>
    </div>
  );
}

export function NavButton({ onClick, ariaLabel, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className="h-6 w-6 inline-flex items-center justify-center bg-white border border-[#D1D4DB] rounded-full shadow-[0px_1px_2px_rgba(18,18,23,0.05)] hover:bg-[rgba(18,18,23,0.05)] transition-colors"
    >
      {children}
    </button>
  );
}

// Pill-shaped action button used in the footer.
// `variant`: 'filled' (black, white text) | 'outlined' (white, border, dark text).
export function PillButton({ children, onClick, variant = 'outlined', disabled }) {
  const styles =
    variant === 'filled'
      ? 'bg-[#121217] text-white hover:bg-[#FFD500] hover:text-[#121217]'
      : 'bg-white border border-[#D1D4DB] text-[#121217] shadow-[0px_1px_2px_rgba(18,18,23,0.05)] hover:bg-[rgba(18,18,23,0.05)]';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'inline-flex items-center justify-center h-8 px-3 rounded-full text-sm leading-6 font-medium transition-colors',
        'disabled:opacity-40 disabled:cursor-not-allowed',
        styles,
      )}
    >
      {children}
    </button>
  );
}

// Tabs control used inside the picker view: rounded background, selected tab gets
// a white card with shadow.
export function PickerTabs({ active, onChange, monthLabel, yearLabel }) {
  const tabBase =
    'flex-1 inline-flex items-center justify-center h-8 px-2 rounded-lg text-sm leading-6 font-medium transition-colors';
  const tabActive =
    'bg-white text-[#121217] shadow-[0px_1px_3px_rgba(18,18,23,0.1),0px_1px_2px_rgba(18,18,23,0.06)]';
  const tabIdle = 'text-[#121217] hover:bg-[rgba(18,18,23,0.05)]';
  return (
    <div className="flex items-center gap-1 h-10 p-1 bg-[#F5F7F9] rounded-xl">
      <button
        type="button"
        onClick={() => onChange('month')}
        className={cn(tabBase, active === 'month' ? tabActive : tabIdle)}
      >
        {monthLabel}
      </button>
      <button
        type="button"
        onClick={() => onChange('year')}
        className={cn(tabBase, active === 'year' ? tabActive : tabIdle)}
      >
        {yearLabel}
      </button>
    </div>
  );
}

// 3-column grid of selectable items used by the month and year pickers.
export function PickerGrid({ items, selectedValue, onSelect }) {
  return (
    <div className="grid grid-cols-3 gap-2 pt-2">
      {items.map((item) => {
        const isSelected = item.value === selectedValue;
        return (
          <button
            key={item.value}
            type="button"
            onClick={() => onSelect(item.value)}
            className={cn(
              'h-8 px-2 rounded-lg text-sm leading-6 font-medium transition-colors',
              isSelected
                ? 'bg-[#121217] text-white hover:bg-[#FFD500] hover:text-[#121217]'
                : 'text-[#121217] hover:bg-[rgba(18,18,23,0.05)]',
            )}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
