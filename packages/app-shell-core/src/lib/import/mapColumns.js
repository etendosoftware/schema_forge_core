export function normalizeHeader(s) {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
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
    const normalizedHeader = normalizeHeader(header);
    const match = candidatesByTarget.find((c) => c.normalizedCandidates.includes(normalizedHeader));
    mapping[header] = match ? match.target : null;
    if (match) matchedTargets.add(match.target);
  }

  const unmappedTargets = importFields
    .map((f) => f.target)
    .filter((target) => !matchedTargets.has(target));

  return { mapping, unmappedTargets };
}
