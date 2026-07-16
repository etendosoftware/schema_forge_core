function csvEscape(value) {
  const s = String(value ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Builds a blank (header-row-only) CSV template for a window's import
 * fields, so a user can download it, fill in their own data, and upload it
 * back through the exact same auto-mapping (`mapColumns`) a real file goes
 * through — headers are each field's first alias (the text `mapColumns`
 * already recognizes), falling back to the field's label or target when it
 * has no declared aliases.
 */
export function buildTemplateCsv(fields) {
  return fields
    .map((field) => csvEscape(field.aliases?.[0] ?? field.label ?? field.target))
    .join(',');
}
