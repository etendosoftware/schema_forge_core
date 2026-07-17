import * as React from 'react';
import {
  Calendar as CalendarIcon,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from './popover.jsx';
import { Calendar } from './calendar.jsx';
import { parseCalendarDate, formatCalendarDate } from '../../lib/dateOnly.js';
import {
  getDatePattern,
  formatDateInput,
  parseDateInput,
  formatMonthYearLabel,
} from '../../lib/dateMask.js';
import { useLocaleSwitch, useUI } from '../../i18n/index.js';
import { cn } from '../../lib/utils.js';
import { FIELD_HEIGHT } from './formDensity.js';

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

// Builds the visible placeholder hint (e.g. "dd/mm/aaaa", "mm/dd/yyyy") so the
// user knows the expected order without trial and error.
function buildDatePlaceholder(pattern, localeStr) {
  const yearLabel = (localeStr || '').toLowerCase().startsWith('es') ? 'aaaa' : 'yyyy';
  const labels = { day: 'dd', month: 'mm', year: yearLabel };
  return pattern.order.map((seg) => labels[seg]).join(pattern.sep);
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
  const datePattern = React.useMemo(() => getDatePattern(localeStr), [localeStr]);
  const localePlaceholder = React.useMemo(
    () => buildDatePlaceholder(datePattern, localeStr),
    [datePattern, localeStr],
  );

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

  const formattedValue = parsedValue ? formatCalendarDate(value, appLocale) : '';

  // Local state for the text the user is typing — kept separate from `value`
  // so partial / invalid input doesn't fire onChange on every keystroke.
  const [inputText, setInputText] = React.useState(formattedValue);
  const [isFocused, setIsFocused] = React.useState(false);

  // Sync input text when the value prop changes from outside, but only while
  // the user is not actively typing (otherwise every keystroke would race
  // with the parent's controlled value).
  React.useEffect(() => {
    if (!isFocused) setInputText(formattedValue);
  }, [formattedValue, isFocused]);

  const commitTypedValue = () => {
    const parsed = parseDateInput(inputText, datePattern);
    if (!parsed.ok) {
      // Invalid input — revert to last known good value.
      setInputText(formattedValue);
      return null;
    }
    if (parsed.iso !== (value ?? '')) onChange?.(parsed.iso);
    return parsed.iso;
  };

  const handleOpenChange = (next) => {
    if (disabled) return;
    if (next) {
      // Commit any pending typed value so the calendar opens on the right
      // month with the typed date highlighted.
      const iso = commitTypedValue();
      if (iso) {
        const d = parseCalendarDate(iso);
        if (d) setDisplayedMonth(d);
      }
    }
    setOpen(next);
    if (!next) {
      // Reset to calendar view whenever the popover closes so it always
      // reopens on the calendar.
      setView('calendar');
      onBlur?.();
    }
  };

  const handleSelect = (date) => {
    const iso = toIsoDate(date);
    onChange?.(iso);
    setInputText(iso ? formatCalendarDate(iso, appLocale) : '');
    setOpen(false);
  };

  const handleClear = () => {
    onChange?.('');
    setInputText('');
    setOpen(false);
  };

  const handleInputBlur = () => {
    setIsFocused(false);
    commitTypedValue();
    onBlur?.();
  };

  const handleInputKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.currentTarget.blur();
    } else if (e.key === 'Escape') {
      setInputText(formattedValue);
      e.currentTarget.blur();
    }
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
    if (parsedValue) {
      // Preserve the selected day, only swap month/year. If the day does not
      // exist in the target month (e.g. Mar 31 → Feb), clear the selection
      // rather than silently clamping to a different day.
      const lastDay = new Date(tempYear, tempMonth + 1, 0).getDate();
      const day = parsedValue.getDate();
      onChange?.(day <= lastDay ? toIsoDate(new Date(tempYear, tempMonth, day)) : '');
    }
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
  const headerLabel = formatMonthYearLabel(headerDate, localeStr);

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
    `flex items-center gap-2 ${FIELD_HEIGHT} w-full rounded-lg border border-[#D1D4DB] bg-white px-2`,
    'shadow-[0px_1px_2px_rgba(18,18,23,0.05)]',
    disabled
      ? 'opacity-60 cursor-not-allowed bg-muted/50'
      : 'hover:border-[rgba(18,18,23,0.3)] focus-within:outline-none focus-within:ring-2 focus-within:ring-ring',
    className,
  );

  // Default placeholder hints the expected typing format per locale
  // (es-ES → dd/mm/aaaa; en-US → mm/dd/yyyy; en-GB → dd/mm/yyyy).
  const inputPlaceholder = placeholder || localePlaceholder;

  return (
    <Popover open={open} onOpenChange={handleOpenChange} data-testid="Popover__d56af3">
      <div className={wrapperClass}>
        <PopoverTrigger asChild data-testid="PopoverTrigger__d56af3">
          <button
            type="button"
            disabled={disabled}
            aria-label={ui('datePickerOpen')}
            className={cn(
              'inline-flex items-center justify-center shrink-0 rounded',
              !disabled && 'hover:bg-[rgba(18,18,23,0.05)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            )}
          >
            <CalendarIcon
              className="h-6 w-6 shrink-0 text-[#A9A9BC]"
              aria-hidden="true"
              data-testid="CalendarIcon__d56af3" />
          </button>
        </PopoverTrigger>
        <input
          type="text"
          id={id}
          name={name}
          data-testid={dataTestId}
          disabled={disabled}
          required={required}
          inputMode="numeric"
          autoComplete="off"
          placeholder={isFocused ? inputPlaceholder : ''}
          value={inputText}
          onChange={(e) => setInputText(formatDateInput(e.target.value, datePattern))}
          maxLength={10}
          onFocus={() => setIsFocused(true)}
          onBlur={handleInputBlur}
          onKeyDown={handleInputKeyDown}
          className="flex-1 min-w-0 bg-transparent border-0 outline-none text-sm leading-6 font-normal text-[#121217] placeholder:text-[#A9A9BC] disabled:cursor-not-allowed"
        />
      </div>
      {!disabled && (
        <PopoverContent
          className="w-[264px] p-0"
          align="start"
          data-testid="PopoverContent__d56af3">
          <div className="p-2">
            <HeaderRow
              label={headerLabel}
              onLabelClick={view === 'calendar' ? openPicker : cancelPicker}
              onPrev={navPrev}
              onNext={navNext}
              showLabelChevron={view === 'calendar'}
              data-testid="HeaderRow__d56af3" />

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
                data-testid="Calendar__d56af3" />
            )}

            {view === 'picker' && (
              <div className="pt-1 space-y-2">
                <PickerTabs
                  active={pickerTab}
                  onChange={setPickerTab}
                  monthLabel={ui('datePickerMonth')}
                  yearLabel={ui('datePickerYear')}
                  data-testid="PickerTabs__d56af3" />
                {pickerTab === 'month' ? (
                  <PickerGrid
                    items={monthItems}
                    selectedValue={tempMonth}
                    onSelect={setTempMonth}
                    data-testid="PickerGrid__d56af3" />
                ) : (
                  <PickerGrid
                    items={yearItems}
                    selectedValue={tempYear}
                    onSelect={setTempYear}
                    data-testid="PickerGrid__d56af3" />
                )}
              </div>
            )}
          </div>

          <div className="border-t border-[#E8EAEF] flex items-center justify-between gap-2 px-5 py-3">
            {view === 'calendar' ? (
              <>
                <PillButton
                  onClick={handleClear}
                  disabled={!parsedValue}
                  data-testid="PillButton__d56af3">
                  {ui('clear')}
                </PillButton>
                <PillButton
                  variant="filled"
                  onClick={() => handleSelect(new Date())}
                  data-testid="PillButton__d56af3">
                  {ui('dateRangeToday')}
                </PillButton>
              </>
            ) : (
              <>
                <PillButton onClick={cancelPicker} data-testid="PillButton__d56af3">{ui('datePickerBack')}</PillButton>
                <PillButton variant="filled" onClick={commitPicker} data-testid="PillButton__d56af3">
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
