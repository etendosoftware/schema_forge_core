export const FK_AUTO_RESOLVE_THRESHOLD = 80;
export const FK_AMBIGUOUS_GAP = 15;

/**
 * Decide whether a column of similarity candidates (best-first, as returned
 * by simSearch's `.candidates`) resolves automatically or needs the user's
 * review. Auto-resolves only when the top candidate clears the confidence
 * threshold AND there is no close runner-up to be ambiguous about.
 */
export function classifyCandidates(candidates) {
  if (!candidates || candidates.length === 0) {
    return { status: 'needs-review', candidates: [] };
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
export async function resolveForeignKeyColumn({ values, matchEntity, simSearchFn, token, qtyResults = 5 }) {
  const results = await simSearchFn({ token, entityName: matchEntity, items: values, qtyResults });
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
    });
    result.set(column.target, columnMap);
  }
  return result;
}
