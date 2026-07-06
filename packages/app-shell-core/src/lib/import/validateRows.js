const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isBlank(value) {
  return value == null || String(value).trim() === '';
}

/**
 * Validate a single row against a window's required fields, email-format
 * fields, and already-resolved foreign-key columns. Pure and single-row so
 * the same function powers both the bulk pre-send pass and the review
 * queue's inline "re-validate after edit" action.
 */
export function validateRow(row, { requiredTargets = [], emailTargets = [], fkTargets = [], fkResolutions = new Map() }) {
  const errors = [];

  for (const target of requiredTargets) {
    if (isBlank(row[target])) {
      errors.push({ target, message: 'Required field is missing.' });
    }
  }

  for (const target of emailTargets) {
    const value = row[target];
    if (!isBlank(value) && !EMAIL_RE.test(String(value).trim())) {
      errors.push({ target, message: 'Not a valid email address.' });
    }
  }

  for (const target of fkTargets) {
    const value = row[target];
    if (isBlank(value)) continue;
    const resolution = fkResolutions.get(target)?.get(String(value).trim());
    if (!resolution || resolution.status !== 'auto-resolved') {
      errors.push({ target, message: `"${value}" could not be matched to an existing record.` });
    }
  }

  return { valid: errors.length === 0, errors };
}

export function validateRows(rows, opts) {
  return rows.map((row) => ({ row, ...validateRow(row, opts) }));
}
