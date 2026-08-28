export function normalizeHeader(s) {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/**
 * Trailing required-column marker written by `buildTemplateCsv` (`"cif/nif *"`). Also
 * accepts the fullwidth asterisk, which is what an IME or a copy-paste out of some
 * spreadsheets produces.
 */
const REQUIRED_MARKER_RE = /[\s*\uff0a]+$/;

/**
 * Strips the template's required marker from a header before matching.
 *
 * The marker exists so a user opening the downloaded template can see which columns are
 * mandatory. It must not survive into matching, or the very template the dialog hands
 * out would fail to map its own required columns back onto their fields \u2014 the same class
 * of bug as ETP-4995's un-importable template, reintroduced by the fix for it.
 */
export function stripRequiredMarker(header) {
  return String(header ?? '').replace(REQUIRED_MARKER_RE, '');
}

/**
 * Auto-map a file's column headers to a window's importable fields by
 * matching each header (case/accent-insensitive) against a field's label or
 * declared aliases. Unmatched headers map to null — the UI lets the user
 * override them manually rather than guessing.
 */
export function mapColumns(headers, importFields) {
  const candidatesByTarget = importFields.map((field) => ({
    target: field.target,
    normalizedCandidates: [field.label, ...(field.aliases || [])]
      .filter(Boolean)
      .map(normalizeHeader),
  }));

  const mapping = {};
  const matchedTargets = new Set();

  for (const header of headers) {
    const normalizedHeader = normalizeHeader(stripRequiredMarker(header));
    // A field can only claim ONE column. When several fields recognize the same header, the
    // first one that is still unclaimed wins, so a second column carrying a shared term
    // falls through to the next field that wants it instead of overwriting the first.
    //
    // Concretely: `name` owns the alias "nombre" (ETP-4995 — a lone `nombre` column must
    // create a business partner with a trade name, not one with an empty name and an empty
    // searchKey). A Contacts template legitimately carries BOTH "Razón Social" and "Nombre":
    // the first takes `name`, and without this fall-through the second took it again, so the
    // person's first name silently overwrote the company's trade name and `etgoFirstname`
    // ended up with no column at all. A file with only "nombre" still maps to `name`, since
    // nothing has claimed it yet — ETP-4995's rule is unchanged.
    const match = candidatesByTarget.find((c) => (
      c.normalizedCandidates.includes(normalizedHeader) && !matchedTargets.has(c.target)
    ));
    mapping[header] = match ? match.target : null;
    if (match) matchedTargets.add(match.target);
  }

  const unmappedTargets = importFields
    .map((f) => f.target)
    .filter((target) => !matchedTargets.has(target));

  return { mapping, unmappedTargets };
}
