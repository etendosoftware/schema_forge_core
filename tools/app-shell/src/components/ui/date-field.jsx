import * as React from 'react';
import { Calendar as CalendarIcon } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { parseCalendarDate, formatCalendarDate } from '@/lib/dateOnly';
import { useLocaleSwitch, useUI } from '@/i18n';
import { cn } from '@/lib/utils';

function toIsoDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Replaces react-day-picker's native <select> dropdowns (mes/año) with Radix Select
// so the options list inherits the project's design tokens instead of falling
// back to the unstyled OS dropdown.
function CalendarDropdown({ value, onChange, options = [], 'aria-label': ariaLabel }) {
  const handleValueChange = (next) => {
    onChange?.({ target: { value: next } });
  };
  return (
    <Select value={String(value)} onValueChange={handleValueChange}>
      <SelectTrigger
        aria-label={ariaLabel}
        className="h-7 w-auto gap-1 px-2 text-sm font-medium text-[#121217] border-0 shadow-none hover:bg-muted/50 focus:ring-0 focus:ring-offset-0 capitalize"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="max-h-72">
        {options.map((opt) => (
          <SelectItem key={opt.value} value={String(opt.value)} disabled={opt.disabled}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function DateField({
  value,
  onChange,
  onBlur,
  disabled,
  required,
  id,
  name,
  placeholder = '',
  className,
  'data-testid': dataTestId,
}) {
  const { locale: appLocale } = useLocaleSwitch();
  const ui = useUI();
  const [open, setOpen] = React.useState(false);

  const parsedValue = React.useMemo(() => parseCalendarDate(value), [value]);
  const displayText = parsedValue ? formatCalendarDate(value, appLocale) : '';

  const handleOpenChange = (next) => {
    if (disabled) return;
    setOpen(next);
    if (!next) onBlur?.();
  };

  const handleSelect = (date) => {
    onChange?.(toIsoDate(date));
    setOpen(false);
  };

  const handleClear = () => {
    onChange?.('');
    setOpen(false);
  };

  const wrapperClass = cn(
    'flex items-center gap-2 h-10 w-full rounded-lg border border-[#D1D4DB] bg-white px-2',
    'shadow-[0px_1px_2px_rgba(18,18,23,0.05)]',
    'text-left',
    disabled
      ? 'opacity-60 cursor-not-allowed bg-muted/50'
      : 'cursor-pointer hover:border-foreground/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
    className,
  );

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          id={id}
          name={name}
          data-testid={dataTestId}
          disabled={disabled}
          aria-required={required || undefined}
          aria-label={placeholder || undefined}
          className={wrapperClass}
        >
          <CalendarIcon className="h-6 w-6 shrink-0 text-[#A9A9BC]" aria-hidden="true" />
          <span className="text-sm leading-6 font-normal text-[#121217] truncate">
            {displayText || placeholder}
          </span>
        </button>
      </PopoverTrigger>
      {!disabled && (
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={parsedValue || undefined}
            onSelect={handleSelect}
            defaultMonth={parsedValue || undefined}
            captionLayout="dropdown"
            components={{ Dropdown: CalendarDropdown }}
            classNames={{
              // Lay out month_caption + nav side-by-side; the grid lets month_grid
              // span the full width below them.
              month: 'grid grid-cols-[1fr_auto] gap-0 items-center',
              month_caption:
                'col-start-1 row-start-1 flex flex-row items-center gap-1 h-8 px-1',
              dropdowns:
                'flex flex-row items-center gap-1',
              dropdown_root:
                'relative inline-flex items-center',
              nav:
                'col-start-2 row-start-1 flex flex-row items-center gap-1 h-8 pr-1',
              button_previous:
                'inline-flex items-center justify-center h-7 w-7 rounded-md hover:bg-muted/50 transition-colors',
              button_next:
                'inline-flex items-center justify-center h-7 w-7 rounded-md hover:bg-muted/50 transition-colors',
              chevron: 'h-4 w-4 fill-[#828FA3]',
              month_grid: 'col-span-2 row-start-2',
            }}
          />
          <div className="border-t border-[#E8EAEF] px-3 py-2 flex justify-between items-center">
            <button
              type="button"
              onClick={handleClear}
              disabled={!parsedValue}
              className="text-sm font-medium text-[#121217] hover:text-foreground/70 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {ui('clear')}
            </button>
            <button
              type="button"
              onClick={() => handleSelect(new Date())}
              className="text-sm font-medium text-[#121217] hover:text-foreground/70 transition-colors"
            >
              {ui('dateRangeToday')}
            </button>
          </div>
        </PopoverContent>
      )}
    </Popover>
  );
}

export default DateField;
