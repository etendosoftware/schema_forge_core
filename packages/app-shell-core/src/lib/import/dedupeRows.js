function buildKey(row, keyTargets) {
  const parts = keyTargets.map((t) => String(row[t] ?? '').trim().toLowerCase());
  if (parts.some((p) => p === '')) return null; // blank key: never a dedupe match
  return parts.join(' ');
}

/**
 * Collapse rows that share the same value (case/whitespace-insensitive) across
 * `keyTargets`. The first occurrence of a key wins and lands in `uniqueRows`;
 * every later row with the same key is reported in `duplicates`, pointing at
 * its match's position in `uniqueRows` — never silently dropped.
 */
export function dedupeRows(rows, keyTargets) {
  const uniqueRows = [];
  const duplicates = [];
  const indexByKey = new Map();

  for (const row of rows) {
    const key = buildKey(row, keyTargets);
    if (key === null) {
      uniqueRows.push(row);
      continue;
    }
    const existingIndex = indexByKey.get(key);
    if (existingIndex === undefined) {
      indexByKey.set(key, uniqueRows.length);
      uniqueRows.push(row);
    } else {
      duplicates.push({ row, duplicateOfIndex: existingIndex });
    }
  }

  return { uniqueRows, duplicates };
}
