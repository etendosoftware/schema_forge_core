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

// Higher rank = more exposed. Anything else (discarded, absent) ranks 0.
const VISIBILITY_RANK = { editable: 3, readOnly: 2, system: 1 };

/**
 * Collapse contract fields that share the same `(entityName, column)` into one.
 *
 * ETGO_SF_FIELD is unique per (entity, AD column), so every field targeting the same
 * column is written into the SAME row, and the last one pushed would win. An AD window
 * can carry two AD fields over one column (e.g. `accountType` + `accountType2` on
 * C_ElementValue.AccountType); when the duplicate is curated `discarded` and comes last,
 * it closed the row and NEO silently dropped the column on every write (ETP-5399).
 * Shared by `push-to-neo.js` and `lib/neo-delta.js` so both write the same row.
 *
 * The most-exposed visibility wins (editable > readOnly > system > discarded); on a tie
 * the first field in contract order (the primary AD field) is kept. Order of the
 * surviving fields is preserved.
 *
 * @param {Array<{entityName: string, column: string, fieldName: string, visibility?: string}>} fields
 * @returns {{ fields: Array, collapsed: Array<{entityName: string, column: string, kept: string, dropped: string[]}> }}
 */
export function coalesceDuplicateColumnFields(fields) {
  const winners = new Map();
  const groups = new Map();
  for (const f of fields) {
    const key = `${f.entityName}\u0000${f.column}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(f);
    const current = winners.get(key);
    if (!current || (VISIBILITY_RANK[f.visibility] ?? 0) > (VISIBILITY_RANK[current.visibility] ?? 0)) {
      winners.set(key, f);
    }
  }
  const collapsed = [];
  for (const [key, group] of groups) {
    if (group.length < 2) continue;
    const kept = winners.get(key);
    collapsed.push({
      entityName: kept.entityName,
      column: kept.column,
      kept: kept.fieldName,
      dropped: group.filter((f) => f !== kept).map((f) => f.fieldName),
    });
  }
  const winnerSet = new Set(winners.values());
  return { fields: fields.filter((f) => winnerSet.has(f)), collapsed };
}
