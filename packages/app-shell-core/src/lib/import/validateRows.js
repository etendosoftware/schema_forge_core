import { isInvalidImportNumber } from './parseImportNumber.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isBlank(value) {
  return value == null || String(value).trim() === '';
}

/**
 * English fallbacks for the row-level validation messages. Used verbatim only when the
 * caller injects no `translate` — the same posture `importEngine.js` takes for backend
 * errors. Keys match the genericLabels keys the functional app defines, so an injected
 * `translate` (useUI's `ui`) resolves them to the session language.
 *
 * These messages reach the user directly in the review queue, so leaving them hardcoded
 * in English was a real i18n hole in a product used primarily in Spanish.
 */
const VALIDATION_FALLBACKS = {
  importErrorRequiredGeneric: () => 'Required field is missing.',
  importErrorInvalidEmail: () => 'Not a valid email address.',
  importErrorNotANumber: (p) => `"${p.value}" is not a valid number.`,
  importErrorFkUnmatched: (p) => `"${p.value}" could not be matched to an existing record.`,
};

function message(key, params, translate) {
  const fallback = VALIDATION_FALLBACKS[key](params ?? {});
  if (typeof translate !== 'function') return fallback;
  const translated = translate(key, params);
  return translated && translated !== key ? translated : fallback;
}

/**
 * Validate a single row against a window's required fields, email-format
 * fields, numeric fields, and already-resolved foreign-key columns. Pure and
 * single-row so the same function powers both the bulk pre-send pass and the
 * review queue's inline "re-validate after edit" action.
 *
 * `numericTargets` exists so a malformed amount is caught HERE, in the review queue,
 * instead of at operation-build time: a price cell reading "abc" used to sit in the
 * Correctas tab until the user confirmed the import, and only then failed the row.
 * A blank numeric cell is valid — see `parseImportNumber`.
 */
export function validateRow(row, {
  requiredTargets = [],
  emailTargets = [],
  numericTargets = [],
  fkTargets = [],
  fkResolutions = new Map(),
  extraErrors = [],
  translate,
} = {}) {
  const errors = [];

  for (const target of requiredTargets) {
    if (isBlank(row[target])) {
      errors.push({ target, message: message('importErrorRequiredGeneric', {}, translate) });
    }
  }

  for (const target of emailTargets) {
    const value = row[target];
    if (!isBlank(value) && !EMAIL_RE.test(String(value).trim())) {
      errors.push({ target, message: message('importErrorInvalidEmail', {}, translate) });
    }
  }

  for (const target of numericTargets) {
    const value = row[target];
    if (isInvalidImportNumber(value)) {
      errors.push({ target, message: message('importErrorNotANumber', { value }, translate) });
    }
  }

  for (const target of fkTargets) {
    const value = row[target];
    if (isBlank(value)) continue;
    const resolution = fkResolutions.get(target)?.get(String(value).trim());
    if (!resolution || resolution.status !== 'auto-resolved') {
      // `candidates` (present, possibly empty) is what lets the review queue offer a
      // pick-a-value selector instead of a bare retype-and-hope text field.
      errors.push({
        target,
        message: message('importErrorFkUnmatched', { value }, translate),
        candidates: resolution?.candidates ?? [],
      });
    }
  }

  // Descriptor-supplied errors (AD-coded columns, cross-field rules) come last, so the
  // generic problems a user can fix without domain knowledge are listed first.
  errors.push(...extraErrors);

  return { valid: errors.length === 0, errors };
}

export function validateRows(rows, opts) {
  return rows.map((row) => ({ row, ...validateRow(row, opts) }));
}
