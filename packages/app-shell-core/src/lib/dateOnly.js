const DATE_ONLY_PREFIX_RE = /^(\d{4})-(\d{2})-(\d{2})(?:$|[T\s])/;

function normalizeLocale(locales) {
  if (typeof locales === 'string') return locales.replace('_', '-');
  if (Array.isArray(locales)) return locales.map((locale) => normalizeLocale(locale));
  return locales;
}

export function parseCalendarDate(raw) {
  if (!raw) return null;

  if (raw instanceof Date) {
    return Number.isNaN(raw.getTime())
      ? null
      : new Date(raw.getFullYear(), raw.getMonth(), raw.getDate());
  }

  const str = String(raw).trim();
  const match = str.match(DATE_ONLY_PREFIX_RE);
  if (match) {
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  }

  const parsed = new Date(str);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatCalendarDate(
  raw,
  locales = 'en-GB',
  options = { day: '2-digit', month: '2-digit', year: 'numeric' },
) {
  const date = parseCalendarDate(raw);
  return date ? date.toLocaleDateString(normalizeLocale(locales), options) : '—';
}

export function getCalendarDateRelation(raw, reference = new Date()) {
  const date = parseCalendarDate(raw);
  if (!date) return null;

  const normalizedDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const normalizedReference = new Date(reference.getFullYear(), reference.getMonth(), reference.getDate());

  if (normalizedDate.getTime() < normalizedReference.getTime()) return 'past';
  if (normalizedDate.getTime() > normalizedReference.getTime()) return 'future';
  return 'today';
}
