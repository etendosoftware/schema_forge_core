import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(__dirname, '..', 'date-field.jsx'), 'utf8');

describe('DateField — exports and dependencies', () => {
  it('exports a named function component', () => {
    assert.match(src, /export function DateField\(/);
  });

  it('also exports DateField as default', () => {
    assert.match(src, /export default DateField/);
  });

  it('imports the Calendar icon plus chevron icons from lucide-react', () => {
    assert.match(src, /Calendar as CalendarIcon[\s\S]*?ChevronDown[\s\S]*?ChevronLeft[\s\S]*?ChevronRight[\s\S]*?from\s+['"]lucide-react['"]/);
  });

  it('imports Popover primitives', () => {
    assert.match(src, /Popover,\s*PopoverContent,\s*PopoverTrigger[\s\S]*?from\s+['"]@\/components\/ui\/popover['"]/);
  });

  it('reuses the existing Calendar component (single-month, simple date picker)', () => {
    assert.match(src, /import\s*\{\s*Calendar\s*\}\s*from\s+['"]@\/components\/ui\/calendar['"]/);
    assert.match(src, /<Calendar[\s\S]*?mode="single"/);
  });

  it('uses dateOnly helpers (no UTC shift)', () => {
    assert.match(src, /from\s+['"]@\/lib\/dateOnly['"]/);
    assert.match(src, /parseCalendarDate/);
    assert.match(src, /formatCalendarDate/);
  });

  it('reads the active locale from useLocaleSwitch and useUI', () => {
    assert.match(src, /from\s+['"]@\/i18n['"]/);
    assert.match(src, /useLocaleSwitch\(\)/);
    assert.match(src, /useUI\(\)/);
  });
});

describe('DateField — input (trigger button) Figma styling', () => {
  it('renders a 40px tall white card with 1px #D1D4DB border and rounded-lg', () => {
    assert.match(src, /h-10/);
    assert.match(src, /rounded-lg/);
    assert.match(src, /border-\[#D1D4DB\]/);
    assert.match(src, /bg-white/);
  });

  it('applies the Figma shadow (rgba(18,18,23,0.05) — shadow-xs)', () => {
    assert.match(src, /shadow-\[0px_1px_2px_rgba\(18,18,23,0\.05\)\]/);
  });

  it('renders the calendar icon at 24x24 with the Figma color #A9A9BC', () => {
    assert.match(src, /<CalendarIcon[^>]*className="h-6 w-6[^"]*text-\[#A9A9BC\]/);
  });

  it('renders the text in Inter 14/24 with color #121217', () => {
    assert.match(src, /text-sm leading-6 font-normal text-\[#121217\]/);
  });
});

describe('DateField — popover behavior', () => {
  it('always renders the calendar icon (never hidden when value is empty)', () => {
    const iconOccurrences = (src.match(/<CalendarIcon\b/g) || []).length;
    assert.ok(iconOccurrences >= 1, 'expected CalendarIcon to be rendered');
    assert.doesNotMatch(src, /\{[^}]*(?:value|displayText|parsedValue)[^}]*&&[\s\S]*?<CalendarIcon/);
  });

  it('shows formatted date text when value is present, otherwise placeholder', () => {
    assert.match(src, /\{displayText\s*\|\|\s*placeholder\}/);
  });

  it('emits yyyy-MM-dd to onChange via toIsoDate(date)', () => {
    assert.match(src, /function toIsoDate\(date\)/);
    assert.match(src, /\$\{y\}-\$\{m\}-\$\{day\}/);
    assert.match(src, /onChange\?\.\(toIsoDate\(date\)\)/);
  });

  it('skips the popover content when disabled', () => {
    assert.match(src, /\{!disabled\s*&&\s*\(\s*<PopoverContent/);
  });

  it('blocks open changes when disabled', () => {
    assert.match(src, /if\s*\(disabled\)\s*return;/);
    assert.match(src, /<button[\s\S]*?disabled=\{disabled\}/);
  });

  it('fires onBlur when the popover closes', () => {
    assert.match(src, /onBlur\?\.\(\);/);
  });

  it('resets to the calendar view whenever the popover closes', () => {
    assert.match(src, /if\s*\(!next\)\s*\{[\s\S]*?setView\('calendar'\)/);
  });

  it('closes the popover after a date is selected', () => {
    assert.match(src, /handleSelect\s*=\s*\(date\)\s*=>\s*\{[\s\S]*?setOpen\(false\)/);
  });
});

describe('DateField — calendar view (default)', () => {
  it('controls the displayed month internally with state', () => {
    assert.match(src, /\[displayedMonth,\s*setDisplayedMonth\]\s*=\s*React\.useState/);
    assert.match(src, /<Calendar[\s\S]*?month=\{displayedMonth\}[\s\S]*?onMonthChange=\{setDisplayedMonth\}/);
  });

  it('hides the built-in caption and nav (custom HeaderRow renders them instead)', () => {
    assert.match(src, /hideNavigation/);
    assert.match(src, /month_caption:\s*'hidden'/);
    assert.match(src, /nav:\s*'hidden'/);
  });

  it('renders today as outlined circle with #282833 border (no yellow on day cell hover)', () => {
    assert.match(src, /today:[\s\S]*?\[&>button\]:border[\s\S]*?border-\[#282833\]/);
    assert.doesNotMatch(src, /today:[\s\S]*?hover:bg-\[#FFD500\]/);
  });

  it('filled PillButton (Hoy/Ok) hovers to Etendo yellow #FFD500 (active-button hover convention)', () => {
    assert.match(src, /variant === 'filled'[\s\S]*?hover:bg-\[#FFD500\][\s\S]*?hover:text-\[#121217\]/);
  });

  it('selected picker cell (Feb/2025) hovers to Etendo yellow #FFD500 (active-button hover convention)', () => {
    assert.match(src, /isSelected[\s\S]*?bg-\[#121217\] text-white hover:bg-\[#FFD500\] hover:text-\[#121217\]/);
  });
});

describe('DateField — header row', () => {
  it('declares a HeaderRow subcomponent with label + chevron + nav arrows', () => {
    assert.match(src, /function HeaderRow\(/);
    assert.match(src, /<ChevronDown/);
    assert.match(src, /<ChevronLeft/);
    assert.match(src, /<ChevronRight/);
  });

  it('renders the label as a button with capitalize and locale-aware month/year', () => {
    assert.match(src, /Intl\.DateTimeFormat[\s\S]*?month:\s*'long'[\s\S]*?year:\s*'numeric'/);
    assert.match(src, /capitalize/);
  });

  it('renders the prev/next arrows as circular pill buttons (24x24, border, shadow-xs)', () => {
    assert.match(src, /h-6 w-6[\s\S]*?bg-white[\s\S]*?border border-\[#D1D4DB\][\s\S]*?rounded-full[\s\S]*?shadow-\[0px_1px_2px_rgba\(18,18,23,0\.05\)\]/);
  });
});

describe('DateField — month/year picker view', () => {
  it('declares a "view" state that toggles between calendar and picker', () => {
    assert.match(src, /\[view,\s*setView\]\s*=\s*React\.useState\('calendar'\)/);
    assert.match(src, /\{view === 'calendar' && \(/);
    assert.match(src, /\{view === 'picker' && \(/);
  });

  it('clicking the header label switches to the picker view', () => {
    assert.match(src, /onLabelClick=\{view === 'calendar'\s*\?\s*openPicker\s*:\s*cancelPicker\}/);
    assert.match(src, /const openPicker\s*=\s*\(\)\s*=>\s*\{[\s\S]*?setView\('picker'\)/);
  });

  it('keeps a tab state to switch between Mes / Año tabs in the picker', () => {
    assert.match(src, /\[pickerTab,\s*setPickerTab\]\s*=\s*React\.useState\('month'\)/);
    assert.match(src, /<PickerTabs/);
  });

  it('renders the month grid (12 short month names, locale-aware)', () => {
    assert.match(src, /function getMonthShortNames\(/);
    assert.match(src, /Array\.from\(\{\s*length:\s*12\s*\}/);
  });

  it('renders the year grid (12 years anchored around the temp year)', () => {
    assert.match(src, /yearItems\s*=\s*React\.useMemo/);
    assert.match(src, /Array\.from\(\{\s*length:\s*12\s*\}/);
  });

  it('uses tracked temp values that are committed to displayedMonth on Ok', () => {
    assert.match(src, /\[tempMonth,\s*setTempMonth\]/);
    assert.match(src, /\[tempYear,\s*setTempYear\]/);
    assert.match(src, /const commitPicker\s*=\s*\(\)\s*=>\s*\{[\s\S]*?setDisplayedMonth\(new Date\(tempYear,\s*tempMonth,\s*1\)\)/);
  });

  it('Volver/Back returns to the calendar view without committing temp values', () => {
    assert.match(src, /const cancelPicker\s*=\s*\(\)\s*=>\s*setView\('calendar'\)/);
  });

  it('selected month/year cell uses the Figma filled-black style', () => {
    assert.match(src, /isSelected[\s\S]*?bg-\[#121217\]\s*text-white/);
  });
});

describe('DateField — footer buttons', () => {
  it('declares a PillButton subcomponent supporting filled and outlined variants', () => {
    assert.match(src, /function PillButton\(/);
    assert.match(src, /variant === 'filled'/);
  });

  it('Calendar view footer shows Limpiar (outlined) + Hoy (filled)', () => {
    assert.match(src, /ui\('clear'\)/);
    assert.match(src, /ui\('dateRangeToday'\)/);
    assert.match(src, /<PillButton onClick=\{handleClear\} disabled=\{!parsedValue\}/);
  });

  it('Picker view footer shows Volver (outlined) + Ok (filled)', () => {
    assert.match(src, /ui\('datePickerBack'\)/);
    assert.match(src, /ui\('datePickerOk'\)/);
    assert.match(src, /<PillButton onClick=\{cancelPicker\}/);
    assert.match(src, /<PillButton variant="filled" onClick=\{commitPicker\}/);
  });

  it('renders pill-shaped buttons (rounded-full, h-8, border for outlined, black for filled)', () => {
    assert.match(src, /rounded-full/);
    assert.match(src, /h-8 px-3/);
    assert.match(src, /bg-\[#121217\] text-white/);
    assert.match(src, /bg-white border border-\[#D1D4DB\] text-\[#121217\]/);
  });
});

describe('DateField — header navigation arrows', () => {
  it('navigates by month in calendar view', () => {
    assert.match(src, /if\s*\(view === 'calendar'\)[\s\S]*?setDisplayedMonth\([\s\S]*?getMonth\(\)\s*-\s*1/);
    assert.match(src, /getMonth\(\)\s*\+\s*1/);
  });

  it('navigates year grid page via yearPageAnchor (independent of selected year)', () => {
    // Arrows on year tab shift yearPageAnchor ±12 — NOT tempYear
    assert.match(src, /setYearPageAnchor\(\(a\)\s*=>\s*a\s*-\s*12\)/);
    assert.match(src, /setYearPageAnchor\(\(a\)\s*=>\s*a\s*\+\s*12\)/);
    // yearItems derived from yearPageAnchor, NOT tempYear
    assert.match(src, /yearItems\s*=\s*React\.useMemo[\s\S]*?yearPageAnchor/);
    assert.doesNotMatch(src, /yearItems\s*=\s*React\.useMemo[\s\S]*?\[tempYear\]/);
  });
});
