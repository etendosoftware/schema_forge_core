/**
 * field-visibility.js — The single source of truth for the curated-visibility →
 * NEO-flag projection.
 *
 * `ETGO_SF_FIELD` stores the same decision twice, on purpose:
 *   - `ISINCLUDED` / `ISREADONLY` — the two booleans NEO's runtime enforces.
 *   - `VISIBILITY`               — the curated value verbatim, which `neo_schema`
 *                                  hands to agents (`system` and `readOnly` both
 *                                  collapse to Y/Y, so the flags cannot recover it).
 *
 * Storing a decision twice means it can disagree with itself. ETP-4793 / IMP-26
 * found exactly that: `populateSpec` writes the two flags unconditionally but
 * `VISIBILITY` only on some paths, so rows accumulate open flags with no
 * curated value. `visibilityMatchesFlags()` is the predicate that detects it,
 * and validator rule F23 is what runs it.
 *
 * Before ETP-4793 this function existed twice — exported from `push-to-neo.js`
 * and inlined into `lib/neo-delta.js` to dodge a circular import. Both now
 * import it from here. Do not add a third copy; a validator that re-implements
 * the projection cannot detect a drift in the projection.
 */

/**
 * Map a curated field visibility value to the NEO flag pair.
 *
 * Any value outside the curated set — including `null`, `undefined` and the
 * empty string — is treated as `discarded` (closed). That default is what makes
 * an absent `VISIBILITY` column coherent with `N`/`N` rather than a violation.
 *
 * @param {string|null|undefined} visibility - `editable` | `readOnly` | `system` | `discarded`
 * @returns {{ isIncluded: 'Y'|'N', isReadOnly: 'Y'|'N' }}
 */
export function mapVisibility(visibility) {
  switch (visibility) {
    case 'editable':
      return { isIncluded: 'Y', isReadOnly: 'N' };
    case 'readOnly':
      return { isIncluded: 'Y', isReadOnly: 'Y' };
    case 'system':
      return { isIncluded: 'Y', isReadOnly: 'Y' };
    case 'discarded':
      return { isIncluded: 'N', isReadOnly: 'N' };
    default:
      return { isIncluded: 'N', isReadOnly: 'N' };
  }
}

/**
 * The four curated visibility values, in the order the docs present them.
 */
export const CURATED_VISIBILITIES = Object.freeze(['editable', 'readOnly', 'system', 'discarded']);

/**
 * True when `visibility` is one of the four curated values. An absent or empty
 * value is NOT curated — it is the "never written" state F23 reports separately
 * from a genuine contradiction.
 *
 * @param {string|null|undefined} visibility
 * @returns {boolean}
 */
export function isCuratedVisibility(visibility) {
  return CURATED_VISIBILITIES.includes(visibility);
}

/**
 * Check one stored row against the projection.
 *
 * Returns a verdict rather than a boolean because the two failure modes need
 * different treatment (see F23 in docs/pipeline-validator-reference.md):
 *
 *   - `contradiction` — `VISIBILITY` holds a curated value whose projection
 *     disagrees with the stored flags. Only a writer bug or a hand-edit can
 *     produce this, so it blocks.
 *   - `unwritten` — `VISIBILITY` is absent/empty while the flags say the field
 *     is included. Coherent for a closed field (`N`/`N` IS the default
 *     projection), a backfill gap for an open one, so it warns.
 *
 * @param {{ visibility?: string|null, isIncluded?: string, isReadOnly?: string }} row
 * @returns {{ ok: boolean, kind: 'ok'|'contradiction'|'unwritten',
 *             expected: { isIncluded: string, isReadOnly: string } }}
 */
export function visibilityMatchesFlags(row) {
  const visibility = row?.visibility ?? null;
  // Absent flags default to the closed pair, matching mapVisibility's default —
  // a row that omits both columns is coherent with an omitted VISIBILITY.
  const isIncluded = row?.isIncluded ?? 'N';
  const isReadOnly = row?.isReadOnly ?? 'N';
  const expected = mapVisibility(visibility);
  const ok = expected.isIncluded === isIncluded && expected.isReadOnly === isReadOnly;
  if (ok) return { ok: true, kind: 'ok', expected };
  return {
    ok: false,
    kind: isCuratedVisibility(visibility) ? 'contradiction' : 'unwritten',
    expected,
  };
}
