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

  it('imports the Calendar icon from lucide-react', () => {
    assert.match(src, /Calendar as CalendarIcon[\s\S]*?from\s+['"]lucide-react['"]/);
  });

  it('imports Popover primitives', () => {
    assert.match(src, /Popover,\s*PopoverContent,\s*PopoverTrigger[\s\S]*?from\s+['"]@\/components\/ui\/popover['"]/);
  });

  it('reuses the existing Calendar component (single-month, simple date picker)', () => {
    assert.match(src, /import\s*\{\s*Calendar\s*\}\s*from\s+['"]@\/components\/ui\/calendar['"]/);
    assert.match(src, /<Calendar[\s\S]*?mode="single"/);
  });

  it('overrides the Calendar dropdown with a Radix Select to avoid the unstyled native <select>', () => {
    assert.match(src, /captionLayout="dropdown"/);
    assert.match(src, /components=\{\{\s*Dropdown:\s*CalendarDropdown\s*\}\}/);
    assert.match(src, /function CalendarDropdown\(/);
    // The custom Dropdown wraps SelectTrigger / SelectContent / SelectItem
    assert.match(src, /<SelectTrigger/);
    assert.match(src, /<SelectContent/);
    assert.match(src, /<SelectItem/);
    // It bridges react-day-picker's onChange (event-based) and Radix's onValueChange
    assert.match(src, /onChange\?\.\(\{\s*target:\s*\{\s*value:\s*next\s*\}\s*\}\)/);
  });

  it('lays out month_caption and nav on the same row via CSS grid', () => {
    // month uses a 2-column grid: dropdowns on the left, nav on the right
    assert.match(src, /month:\s*'grid grid-cols-\[1fr_auto\]/);
    assert.match(src, /month_caption:\s*'col-start-1 row-start-1/);
    assert.match(src, /nav:\s*'col-start-2 row-start-1/);
    // month_grid spans both columns below
    assert.match(src, /month_grid:\s*'col-span-2 row-start-2/);
  });

  it('shows a Today button that selects today without typing', () => {
    assert.match(src, /handleSelect\(new Date\(\)\)/);
    assert.match(src, /ui\('dateRangeToday'\)/);
  });

  it('shows a Clear button that emits empty string and closes the popover', () => {
    assert.match(src, /const handleClear\s*=\s*\(\)\s*=>\s*\{[\s\S]*?onChange\?\.\(''\)[\s\S]*?setOpen\(false\)/);
    assert.match(src, /ui\('clear'\)/);
  });

  it('disables the Clear button when there is no value to clear', () => {
    assert.match(src, /onClick=\{handleClear\}[\s\S]*?disabled=\{!parsedValue\}/);
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

describe('DateField — Figma styling', () => {
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

describe('DateField — behavior', () => {
  it('always renders the calendar icon (never hidden when value is empty)', () => {
    // The icon is unconditional — only the text node is conditional on displayText
    const iconOccurrences = (src.match(/<CalendarIcon\b/g) || []).length;
    assert.ok(iconOccurrences >= 1, 'expected CalendarIcon to be rendered');
    // No conditional wrapper around the icon
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

  it('blocks open changes and skips popover on the trigger when disabled', () => {
    assert.match(src, /if\s*\(disabled\)\s*return;/);
    // The trigger button must propagate the disabled attribute
    assert.match(src, /<button[\s\S]*?disabled=\{disabled\}/);
  });

  it('fires onBlur when the popover closes', () => {
    assert.match(src, /if\s*\(!next\)\s*onBlur\?\.\(\);/);
  });

  it('closes the popover after a date is selected', () => {
    assert.match(src, /handleSelect\s*=\s*\(date\)\s*=>\s*\{[\s\S]*?setOpen\(false\)/);
  });
});
