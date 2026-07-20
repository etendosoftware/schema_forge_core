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
// FIX (ETP-4544, bug 2): the previous implementation always flattened `raw`
// down to a bare digit string and re-chunked it from scratch, with no notion
// of which segment an edit touched — deleting a single digit out of a middle
// segment (e.g. the "0" in "16/07/2026" -> raw "16/7/2026") shifted every
// later digit backward, redistributing them into the wrong segments
// ("16/72/026").
//
// Chosen contract ("keep the cursor position, don't redistribute into an
// invalid value"): if `raw` already has exactly one literal segment per
// pattern position — i.e. every separator the mask would insert is still
// present — treat it as a structured, segment-preserving edit. Clamp each
// segment to its own max length independently and NEVER pull digits from a
// later segment into an earlier one. This also means typing a 3rd digit
// into an already-complete 2-digit segment is capped rather than reflowed
// into the next segment — an acceptable trade-off for never corrupting an
// unrelated segment.
//
// Only when `raw` has FEWER segments than the pattern expects (the user
// hasn't reached a separator yet, or pasted a flat digit string) do we fall
// back to the original flat rebuild, which is what auto-inserts separators
// while the user types forward.
export function formatDateInput(raw, pattern) {
  const segLengths = { day: 2, month: 2, year: 4 };
  const rawSegments = (raw ?? '').split(pattern.sep);

  if (rawSegments.length === pattern.order.length) {
    return rawSegments
      .map((segment, i) => {
        const maxLen = segLengths[pattern.order[i]] ?? 4;
        return segment.replace(/\D/g, '').slice(0, maxLen);
      })
      .join(pattern.sep);
  }

  const digits = (raw ?? '').replace(/\D/g, '').slice(0, 8);
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
// FIX (ETP-4544, bug 1): formatting month+year together in a single
// Intl.DateTimeFormat call lets locales apply their combined-format grammar
// — es-ES inserts the "de" preposition, producing "julio de 2026" instead
// of the expected "Julio 2026". Formatting month and year SEPARATELY and
// joining with a single space sidesteps that combined-format grammar
// entirely. The month is also explicitly capitalized (Intl's long month
// name is lowercase for es-ES, e.g. "julio") to match the expected label.
export function formatMonthYearLabel(date, localeStr) {
  const rawMonth = new Intl.DateTimeFormat(localeStr, { month: 'long' }).format(date);
  const month = rawMonth.charAt(0).toUpperCase() + rawMonth.slice(1);
  const year = new Intl.DateTimeFormat(localeStr, { year: 'numeric' }).format(date);
  return `${month} ${year}`;
}
