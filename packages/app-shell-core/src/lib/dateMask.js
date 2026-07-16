// Pure date-mask helpers for DateField (ETP-4544): locale-aware pattern
// detection, typed-input masking/parsing, and the calendar header label.
//
// Extracted from date-field.jsx so this logic is covered by real node:test
// execution instead of regex-matching the JSX source — the .jsx file has no
// JSX transform available to this project's `node --test` runner, so the
// old date-field.test.js could only pattern-match against the raw source
// string, which is a weak regression test for logic bugs. Same precedent as
// status-tag.jsx -> status-tag-tokens.js and add-line-button.jsx ->
// add-line-button-tokens.js. `date-field.jsx` already imports
// parseCalendarDate/formatCalendarDate from ../../lib/dateOnly.js, so this
// file is the natural sibling to that.

// Inspects the locale to learn the natural date order (en-US is month-first;
// es-ES, en-GB and most others are day-first) plus the literal separator,
// so the input mask, placeholder and parser all match the locale convention.
export function getDatePattern(localeStr) {
  const sample = new Date(2026, 0, 8);
  const parts = new Intl.DateTimeFormat(localeStr, {
    day: '2-digit', month: '2-digit', year: 'numeric',
  }).formatToParts(sample);
  const order = parts
    .filter((p) => p.type === 'day' || p.type === 'month' || p.type === 'year')
    .map((p) => p.type);
  const sepPart = parts.find((p) => p.type === 'literal' && p.value.trim());
  const sep = sepPart ? sepPart.value.trim().charAt(0) : '/';
  return { order, sep };
}

// Masks raw keyboard input to the locale-specific shape: drops every non-digit,
// caps at 8 digits and auto-inserts the separators so the user cannot type
// arbitrary characters and never has to type them manually.
//
// KNOWN BUG (ETP-4544): this always flattens `raw` down to a bare digit
// string and re-chunks it from scratch, with no notion of which segment an
// edit touched. Deleting a single digit out of a middle segment (e.g. the
// "0" in "16/07/2026" -> raw "16/7/2026") shifts every later digit backward,
// redistributing them into the wrong segments ("16/72/026"). Fixed in the
// next commit — see dateMask.test.js for the failing regression test.
export function formatDateInput(raw, pattern) {
  const digits = (raw ?? '').replace(/\D/g, '').slice(0, 8);
  const segLengths = { day: 2, month: 2, year: 4 };
  const chunks = [];
  let cursor = 0;
  for (const seg of pattern.order) {
    if (cursor >= digits.length) break;
    const len = segLengths[seg];
    chunks.push(digits.slice(cursor, cursor + len));
    cursor += len;
  }
  return chunks.join(pattern.sep);
}

// Parses a user-typed date according to the locale pattern. Returns
// { ok: true, iso } when the value is a real calendar date,
// { ok: true, iso: '' } when empty, { ok: false } otherwise.
export function parseDateInput(text, pattern) {
  const trimmed = (text ?? '').trim();
  if (!trimmed) return { ok: true, iso: '' };
  const m = trimmed.match(/^(\d{1,4})[\/\-.](\d{1,2})[\/\-.](\d{1,4})$/);
  if (!m) return { ok: false };
  const monthFirst = pattern.order[0] === 'month';
  const day = Number(monthFirst ? m[2] : m[1]);
  const month = Number(monthFirst ? m[1] : m[2]);
  const year = Number(m[3]);
  if (year < 1000 || year > 9999) return { ok: false };
  if (month < 1 || month > 12) return { ok: false };
  const lastDay = new Date(year, month, 0).getDate();
  if (day < 1 || day > lastDay) return { ok: false };
  const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return { ok: true, iso };
}

// Builds the calendar header label ("Julio 2026" / "July 2026"): month name
// + year, locale-aware.
//
// KNOWN BUG (ETP-4544): formatting month+year together in a single
// Intl.DateTimeFormat call lets locales apply their combined-format grammar
// — es-ES inserts the "de" preposition, producing "julio de 2026" instead
// of the expected "Julio 2026". Fixed in the next commit — see
// dateMask.test.js for the failing regression test.
export function formatMonthYearLabel(date, localeStr) {
  return new Intl.DateTimeFormat(localeStr, {
    month: 'long',
    year: 'numeric',
  }).format(date);
}
