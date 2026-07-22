/**
 * ETP-4556 — TEMPORARY compatibility adapter (field-name inference).
 *
 * ⚠️ TEMPORARY. The validation ENGINE core has ZERO field-name inference. Today,
 * though, `email` / `web` / `phone` formats do NOT arrive as a `format`
 * constraint in contract.json — they are inferred from the field name. This
 * adapter ports that heuristic (whose canonical, still-live original lives in
 * the functional repo at
 * `schema_forge/tools/app-shell/src/components/contract-ui/recipientEdits.js`)
 * so consumers can keep validating those formats until the pipeline emits real
 * `format` / `allowedSchemes` constraints. When that lands, DELETE this module —
 * the engine core is unaffected.
 *
 * Mapping to core constraints:
 *   email field   → { format: 'email' }
 *   website field → { format: 'url', allowedSchemes: ['https'] }  (secure only)
 *   phone field   → { format: 'phone' }
 */

const EMAIL_CREDENTIAL_RE = /email_?(user(name)?|pw|password)/i;

function isTextLike(type, ...extra) {
  return type == null || type === 'text' || type === 'string' || type === 'textarea' || extra.includes(type);
}

function fieldTokens(key, col) {
  return `${key} ${col}`
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[^a-zA-Z0-9]+/)
    .map((t) => t.toLowerCase());
}

function isEmailField(field) {
  if (field.type === 'email') return true;
  if (!isTextLike(field.type)) return false;
  const key = String(field.key ?? '');
  const col = String(field.column ?? '');
  // SMTP credential fields contain "email" but hold a username/password.
  if (EMAIL_CREDENTIAL_RE.test(key) || EMAIL_CREDENTIAL_RE.test(col)) return false;
  return /email/i.test(key) || /email/i.test(col);
}

function isWebsiteField(field) {
  if (field.type === 'url') return true;
  if (!isTextLike(field.type)) return false;
  const key = String(field.key ?? '');
  const col = String(field.column ?? '');
  if (/website|homepage|url/i.test(key) || /website|homepage|url/i.test(col)) return true;
  // 'web' is too short for a substring match — require it as a whole token.
  return fieldTokens(key, col).includes('web');
}

function isPhoneField(field) {
  if (!isTextLike(field.type, 'tel')) return false;
  const key = String(field.key ?? '');
  const col = String(field.column ?? '');
  return /phone/i.test(key) || /phone/i.test(col);
}

/**
 * Infer format constraints for a field from its name/type, or null when none
 * apply. Email is checked first, then website, then phone.
 *
 * @param {{key?:string, column?:string, type?:string}} field
 * @returns {{format:string, allowedSchemes?:string[]}|null}
 */
export function inferFormatConstraints(field) {
  if (!field) return null;
  if (isEmailField(field)) return { format: 'email' };
  if (isWebsiteField(field)) return { format: 'url', allowedSchemes: ['https'] };
  if (isPhoneField(field)) return { format: 'phone' };
  return null;
}

/**
 * Return a NEW array of field descriptors with inferred format constraints
 * merged into each field's `validation` object. Explicit constraints always win
 * over inferred ones. The input array and its fields are never mutated.
 *
 * @param {Array} fields
 * @returns {Array}
 */
export function applyCompatFormats(fields = []) {
  return fields.map((field) => {
    const inferred = inferFormatConstraints(field);
    if (!inferred) return field;
    // Inferred first, then existing validation on top → explicit wins.
    return { ...field, validation: { ...inferred, ...(field.validation || {}) } };
  });
}
