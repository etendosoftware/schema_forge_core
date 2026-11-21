import { matchRank } from '../simSearch.js';

/**
 * The simSearch `scoreMode` an import field asks for (ETP-5730). `matchMode: 'strict'` in
 * `decisions.json` means the percentage shown and classified is the whole-string similarity, so an
 * exact name outranks the names that only contain it. Any other value keeps the endpoint's score.
 */
export function scoreModeForField(field) {
  return field?.matchMode === 'strict' ? 'text' : undefined;
}

export const FK_AUTO_RESOLVE_THRESHOLD = 80;
export const FK_AMBIGUOUS_GAP = 15;

/**
 * Decide whether a column of similarity candidates (best-first, as returned
 * by simSearch's `.candidates`) resolves automatically or needs the user's
 * review.
 *
 * A name that equals the value (ETP-5895: `matchType` 'exact', or 'normalized' when only accents
 * differ) decides on its own: one such name auto-resolves, two or more are a real ambiguity
 * (duplicated names) and need review. The score cannot tell them apart, because every name that
 * CONTAINS the value scores 100 too ("Meter" vs "Cubic Meter"). Without an equal name, the top
 * candidate must clear the confidence threshold with no close runner-up.
 */
export function classifyCandidates(candidates) {
  if (!candidates || candidates.length === 0) {
    return { status: 'needs-review', candidates: [] };
  }
  const bestRank = Math.max(...candidates.map(matchRank));
  if (bestRank > 0) {
    const equal = candidates.filter((c) => matchRank(c) === bestRank);
    return equal.length === 1
      ? { status: 'auto-resolved', id: equal[0].id, name: equal[0].name }
      : { status: 'needs-review', candidates };
  }
  const top = Number(candidates[0].similarityPercent);
  if (top < FK_AUTO_RESOLVE_THRESHOLD) {
    return { status: 'needs-review', candidates };
  }
  if (candidates.length > 1) {
    const runnerUp = Number(candidates[1].similarityPercent);
    if (top - runnerUp < FK_AMBIGUOUS_GAP) {
      return { status: 'needs-review', candidates };
    }
  }
  return { status: 'auto-resolved', id: candidates[0].id, name: candidates[0].name };
}

/**
 * Resolve one column's distinct raw text values against a single Etendo
 * entity via one batched simSearchFn call — never one lookup per row.
 */
export async function resolveForeignKeyColumn({ values, matchEntity, simSearchFn, token, qtyResults = 5, scoreMode }) {
  const results = await simSearchFn({ token, entityName: matchEntity, items: values, qtyResults, scoreMode });
  const map = new Map();
  values.forEach((value, i) => {
    const entry = results[i];
    map.set(value, classifyCandidates(entry?.candidates ?? []));
  });
  return map;
}

/**
 * Resolve every `match`-mode foreign-key column across a row set, one
 * simSearchFn call per column (not per row).
 */
export async function resolveForeignKeys({ rows, columns, simSearchFn, token }) {
  const result = new Map();
  for (const column of columns) {
    const distinctValues = [...new Set(
      rows.map((r) => String(r[column.target] ?? '').trim()).filter((v) => v !== ''),
    )];
    const columnMap = await resolveForeignKeyColumn({
      values: distinctValues,
      matchEntity: column.matchEntity,
      simSearchFn,
      token,
      qtyResults: column.qtyResults,
      scoreMode: column.scoreMode,
    });
    result.set(column.target, columnMap);
  }
  return result;
}
