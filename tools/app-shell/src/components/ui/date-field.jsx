import * as React from 'react';
import {
  Calendar as CalendarIcon,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
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

function intlLocale(appLocale) {
  return (appLocale || 'en-GB').replace('_', '-');
}

// Generates "Ene Feb Mar Abr May Jun Jul Ago Sep Oct Nov Dic" / "Jan Feb…" per locale.
// Strips a trailing dot some locales add (e.g. "ene.") and capitalizes the first letter.
function getMonthShortNames(localeStr) {
  const fmt = new Intl.DateTimeFormat(localeStr, { month: 'short' });
  return Array.from({ length: 12 }, (_, i) => {
    const raw = fmt.format(new Date(2024, i, 1)).replace(/\.$/, '');
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  });
}

// Header row used by every view: clickable month/year label on the left,
// circular pill nav arrows on the right.
function HeaderRow({ label, onLabelClick, onPrev, onNext, showLabelChevron }) {
  return (
    <div className="flex items-center justify-between h-8 px-2">
      <button
        type="button"
        onClick={onLabelClick}
        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm leading-6 font-normal text-[#121217] hover:bg-[rgba(18,18,23,0.05)] capitalize"
      >
        <span>{label}</span>
        {showLabelChevron && (
          <ChevronDown className="h-4 w-4 text-[#828FA3]" aria-hidden="true" />
        )}
      </button>
      <div className="flex items-center gap-2">
        <NavButton onClick={onPrev} ariaLabel="prev">
          <ChevronLeft className="h-5 w-5 text-[#828FA3]" aria-hidden="true" />
        </NavButton>
        <NavButton onClick={onNext} ariaLabel="next">
          <ChevronRight className="h-5 w-5 text-[#828FA3]" aria-hidden="true" />
        </NavButton>
      </div>
    </div>
  );
}

function NavButton({ onClick, ariaLabel, children }) {
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
function PillButton({ children, onClick, variant = 'outlined', disabled }) {
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
function PickerTabs({ active, onChange, monthLabel, yearLabel }) {
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
function PickerGrid({ items, selectedValue, onSelect }) {
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
  const localeStr = intlLocale(appLocale);

  const [open, setOpen] = React.useState(false);
  const [view, setView] = React.useState('calendar'); // 'calendar' | 'picker'
  const [pickerTab, setPickerTab] = React.useState('month'); // 'month' | 'year'

  const parsedValue = React.useMemo(() => parseCalendarDate(value), [value]);

  // The month currently rendered in the calendar — controlled so the picker can drive it.
  const [displayedMonth, setDisplayedMonth] = React.useState(
    () => parsedValue || new Date(),
  );

  // Pending selections inside the picker; committed to displayedMonth on Ok.
  const [tempMonth, setTempMonth] = React.useState(displayedMonth.getMonth());
  const [tempYear, setTempYear] = React.useState(displayedMonth.getFullYear());
  // Anchor for the year grid page — only changes via prev/next arrows, NOT when
  // the user clicks a year. This keeps the grid stable after a year selection,
  // matching the month picker's behavior.
  const [yearPageAnchor, setYearPageAnchor] = React.useState(displayedMonth.getFullYear());

  // Re-sync displayedMonth when the value prop changes from outside.
  React.useEffect(() => {
    if (parsedValue) setDisplayedMonth(parsedValue);
  }, [parsedValue]);

  const displayText = parsedValue ? formatCalendarDate(value, appLocale) : '';

  const handleOpenChange = (next) => {
    if (disabled) return;
    setOpen(next);
    if (!next) {
      // Reset to calendar view whenever the popover closes so it always
      // reopens on the calendar.
      setView('calendar');
      onBlur?.();
    }
  };

  const handleSelect = (date) => {
    onChange?.(toIsoDate(date));
    setOpen(false);
  };

  const handleClear = () => {
    onChange?.('');
    setOpen(false);
  };

  const openPicker = () => {
    const currentYear = displayedMonth.getFullYear();
    setTempMonth(displayedMonth.getMonth());
    setTempYear(currentYear);
    setYearPageAnchor(currentYear);
    setPickerTab('month');
    setView('picker');
  };

  const cancelPicker = () => setView('calendar');

  const commitPicker = () => {
    setDisplayedMonth(new Date(tempYear, tempMonth, 1));
    setView('calendar');
  };

  const navPrev = () => {
    if (view === 'calendar') {
      setDisplayedMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1));
    } else if (pickerTab === 'year') {
      // Arrows move the year grid page, NOT the selected year.
      setYearPageAnchor((a) => a - 12);
    } else {
      // Mes tab: navigate by year in the header label.
      setTempYear((y) => y - 1);
    }
  };

  const navNext = () => {
    if (view === 'calendar') {
      setDisplayedMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1));
    } else if (pickerTab === 'year') {
      setYearPageAnchor((a) => a + 12);
    } else {
      setTempYear((y) => y + 1);
    }
  };

  const headerDate = view === 'calendar' ? displayedMonth : new Date(tempYear, tempMonth, 1);
  const headerLabel = new Intl.DateTimeFormat(localeStr, {
    month: 'long',
    year: 'numeric',
  }).format(headerDate);

  // Month grid items for the picker (Ene/Feb/… per locale).
  const monthShortNames = React.useMemo(() => getMonthShortNames(localeStr), [localeStr]);
  const monthItems = monthShortNames.map((label, i) => ({ value: i, label }));

  // Year grid: 12 years anchored to yearPageAnchor (NOT tempYear).
  // This keeps the grid stable when the user selects a year — only prev/next
  // arrows change which 12 years are visible.
  const yearItems = React.useMemo(() => {
    const anchor = yearPageAnchor - 4;
    return Array.from({ length: 12 }, (_, i) => {
      const y = anchor + i;
      return { value: y, label: String(y) };
    });
  }, [yearPageAnchor]);

  const wrapperClass = cn(
    'flex items-center gap-2 h-10 w-full rounded-lg border border-[#D1D4DB] bg-white px-2',
    'shadow-[0px_1px_2px_rgba(18,18,23,0.05)]',
    'text-left',
    disabled
      ? 'opacity-60 cursor-not-allowed bg-muted/50'
      : 'cursor-pointer hover:border-[rgba(18,18,23,0.3)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
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
        <PopoverContent className="w-[264px] p-0" align="start">
          <div className="p-2">
            <HeaderRow
              label={headerLabel}
              onLabelClick={view === 'calendar' ? openPicker : cancelPicker}
              onPrev={navPrev}
              onNext={navNext}
              showLabelChevron={view === 'calendar'}
            />

            {view === 'calendar' && (
              <Calendar
                mode="single"
                selected={parsedValue || undefined}
                onSelect={handleSelect}
                month={displayedMonth}
                onMonthChange={setDisplayedMonth}
                hideNavigation
                className="p-0 pt-1"
                classNames={{
                  // Hide the built-in caption/dropdowns — we render our own header.
                  month_caption: 'hidden',
                  nav: 'hidden',
                  // Regular day cells: subtle gray hover (not yellow — yellow is only
                  // for elements that are already in the black/active state).
                  day_button:
                    'h-8 w-8 p-0 font-normal text-[#121217] rounded-full hover:bg-[rgba(18,18,23,0.05)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  // Today: outlined circle. Hover yellow is applied via the
                  // <style> tag above (targets [data-today="true"] button:hover).
                  today:
                    '[&>button]:border [&>button]:border-[#282833] [&>button]:text-[#282833]',
                }}
              />
            )}

            {view === 'picker' && (
              <div className="pt-1 space-y-2">
                <PickerTabs
                  active={pickerTab}
                  onChange={setPickerTab}
                  monthLabel={ui('datePickerMonth')}
                  yearLabel={ui('datePickerYear')}
                />
                {pickerTab === 'month' ? (
                  <PickerGrid
                    items={monthItems}
                    selectedValue={tempMonth}
                    onSelect={setTempMonth}
                  />
                ) : (
                  <PickerGrid
                    items={yearItems}
                    selectedValue={tempYear}
                    onSelect={setTempYear}
                  />
                )}
              </div>
            )}
          </div>

          <div className="border-t border-[#E8EAEF] flex items-center justify-between gap-2 px-5 py-3">
            {view === 'calendar' ? (
              <>
                <PillButton onClick={handleClear} disabled={!parsedValue}>
                  {ui('clear')}
                </PillButton>
                <PillButton variant="filled" onClick={() => handleSelect(new Date())}>
                  {ui('dateRangeToday')}
                </PillButton>
              </>
            ) : (
              <>
                <PillButton onClick={cancelPicker}>{ui('datePickerBack')}</PillButton>
                <PillButton variant="filled" onClick={commitPicker}>
                  {ui('datePickerOk')}
                </PillButton>
              </>
            )}
          </div>
        </PopoverContent>
      )}
    </Popover>
  );
}

export default DateField;
