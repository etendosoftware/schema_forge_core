import { csvField } from '../csv/csvSerializer.js';
import { mapColumns, normalizeHeader } from './mapColumns.js';

/**
 * Appended to a required column's header in the downloaded template. Stripped again by
 * `mapColumns` (see `stripRequiredMarker`), so a template filled in as-is still maps
 * every column back onto its own field — the marker is a hint for the human, never part
 * of the header's identity.
 */
export const REQUIRED_HEADER_MARKER = '*';

/**
 * The header this field gets in the downloaded template.
 *
 * `headerFor` is how the caller supplies the session-language label: the field's own
 * `label` is the baked English AD label and `aliases[0]` is always the Spanish term, so
 * without it the template came out in Spanish for every session regardless of the user's
 * language. `ImportDialog` passes a resolver backed by the AD label dictionary and adds
 * the resulting header to the field's aliases, which keeps the round-trip working in
 * whatever language the template was downloaded in.
 */
export function templateHeader(field, { headerFor } = {}) {
  const base = (typeof headerFor === 'function' ? headerFor(field) : null)
    || field.aliases?.[0] || field.label || field.target;
  return field.required ? `${base} ${REQUIRED_HEADER_MARKER}` : base;
}


/**
 * Header per field, guaranteed unique across the whole template.
 *
 * A composite import splits one CSV row across several entities, and the AD columns behind
 * those halves routinely share a label: Contacts carries both the company's and the contact
 * person's email, phone and first name, and `EM_Etgo_Email`/`Email` both resolve to
 * "Correo electrónico". `decisions.json` disambiguates them by declaring explicit labels
 * ("Email (Company)" / "Email (Contact)"); resolving the session label from the AD column
 * collapses that distinction again and writes the same header twice.
 *
 * That is not a cosmetic problem: `parseDelimited` REJECTS a file with duplicate headers, so
 * a template with a collision cannot be uploaded at all — the ETP-4995 blocker, reintroduced
 * by the fix for it. Any field whose localized header collides therefore falls back to its
 * own declared label, which is the one written to be unambiguous. Language consistency is
 * the right thing to sacrifice here: a mixed-language header is readable, a duplicated one
 * makes the file unusable.
 */
/** The header a field falls back to when its preferred one is not usable. */
function fallbackHeader(field) {
  return field.label || field.aliases?.[0] || field.target;
}

export function resolveTemplateHeaders(fields, options = {}) {
  const preferred = fields.map((field) => templateHeader({ ...field, required: false }, options));

  // Pass 1 — literal duplicates. The FIRST field keeps the session label and later ones fall
  // back. Field order is the window's declaration order, which puts the primary entity ahead
  // of the secondary one, so the plain name lands on the field a user means by default
  // ("Correo electrónico" is the company's) and only the qualified one carries a reference.
  // Compared in NORMALIZED form, the same way `mapColumns` compares them. "nombre" and
  // "Nombre" are distinct strings but the same column to a human — and a spreadsheet that
  // normalizes case would collapse them into a genuine duplicate that `parseDelimited`
  // rejects outright.
  const firstOwner = new Map();
  preferred.forEach((base, i) => {
    const key = normalizeHeader(base);
    if (!firstOwner.has(key)) firstOwner.set(key, i);
  });
  const bases = fields.map((field, i) => (
    firstOwner.get(normalizeHeader(preferred[i])) === i ? preferred[i] : fallbackHeader(field)
  ));

  // Pass 2 — the real invariant: every header must map back to the field it was written for.
  // Uniqueness alone is not enough, because `mapColumns` matches on labels and aliases too:
  // a header can be unique in the file and still be claimed by a different field. Rather than
  // approximating that with a heuristic, run the actual matcher over the candidate headers
  // (with each field's own header injected as an alias, exactly as ImportDialog does) and
  // fall back for whichever field lost its column. Repeat until stable — one field falling
  // back can free a header for another.
  for (let pass = 0; pass < fields.length; pass += 1) {
    const withOwnHeader = fields.map((field, i) => (
      { ...field, aliases: [...(field.aliases ?? []), bases[i]] }
    ));
    const { mapping } = mapColumns(bases, withOwnHeader);
    let changed = false;
    fields.forEach((field, i) => {
      if (mapping[bases[i]] === field.target) return;
      const fallback = fallbackHeader(field);
      if (fallback !== bases[i]) { bases[i] = fallback; changed = true; }
    });
    if (!changed) break;
  }

  // Last resort: two fields whose fallbacks also collide. Suffixing with the target keeps the
  // file uploadable; a window hitting this should give the field a distinct label.
  const seen = new Map();
  return bases.map((base, i) => {
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    const unique = n === 1 ? base : `${base} (${fields[i].target})`;
    return fields[i].required ? `${unique} ${REQUIRED_HEADER_MARKER}` : unique;
  });
}


/**
 * Builds the CSV template a user downloads from the import dialog, fills in, and uploads
 * back through the same auto-mapping (`mapColumns`) a real file goes through.
 *
 * Two things beyond the bare header row, both because a header-only template left the
 * user guessing: required columns carry a marker, and a sample row shows the expected
 * shape of each value (date format, decimal separator, which coded columns accept plain
 * words). The sample row is emitted only when at least one field declares an `example`
 * in decisions.json — a row of empty cells would just be noise, and worse, would look
 * like a data row to anyone who did not count the lines.
 *
 * @param {Array<object>} fields `window.import.fields`.
 * @param {object} [options]
 * @param {(field: object) => string} [options.headerFor] Session-language header resolver.
 * @param {boolean} [options.includeExampleRow=true] Set false to get the header line alone.
 */
export function buildTemplateCsv(fields, options = {}) {
  const { includeExampleRow = true } = options;
  const headerLine = resolveTemplateHeaders(fields, options).map(csvField).join(',');
  if (!includeExampleRow || !fields.some((f) => f.example != null && f.example !== '')) {
    return headerLine;
  }
  const exampleLine = fields.map((field) => csvField(field.example ?? '')).join(',');
  return `${headerLine}\n${exampleLine}`;
}
