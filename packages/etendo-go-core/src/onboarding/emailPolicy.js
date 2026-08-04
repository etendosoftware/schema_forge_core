// Frontend email format validation. Mirrors the EMAIL_PATTERN used by the
// declarative validation engine (@etendosoftware/app-shell-core
// lib/validation/formats.js) for immediate UX feedback only — the backend
// remains the source of truth for uniqueness/existence checks.

const EMAIL_PATTERN = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;

/**
 * @param {string} email
 * @returns {boolean} whether the email has a syntactically valid format.
 */
export function isValidEmailFormat(email) {
  const value = (email || '').trim();
  return EMAIL_PATTERN.test(value);
}
