import { SEND_STATUS } from './importEngine.js';

/**
 * Pure helpers behind the import run summary (ETP-5676). Everything here returns QUANTITIES
 * only — counts, never a row, a header text or a cell. That is the contract the summary is
 * handed to the caller under (`ImportDialog`'s `onImportFinished`), so what leaves the dialog
 * for telemetry cannot carry file content by construction.
 */

/**
 * Column counts for a file. `autoMapping` is what `mapColumns` proposed, `mapping` what the user
 * ended up with; both are `{ [header]: target | null }`. A column counts as manually mapped when
 * it is mapped now to something other than what the auto-mapping said.
 */
export function countColumns(headers, autoMapping, mapping) {
  const list = Array.isArray(headers) ? headers : [];
  let columnsAutoMapped = 0;
  let columnsManuallyMapped = 0;
  for (const header of list) {
    const auto = autoMapping?.[header] ?? null;
    const current = mapping?.[header] ?? null;
    if (auto) columnsAutoMapped += 1;
    if (current && current !== auto) columnsManuallyMapped += 1;
  }
  return { columnsInFile: list.length, columnsAutoMapped, columnsManuallyMapped };
}

/** Distinct foreign-key values resolved to one record: `Map<target, Map<value, resolution>>`. */
export function countAutoResolvedFks(fkResolutions) {
  let count = 0;
  for (const column of fkResolutions?.values?.() ?? []) {
    for (const resolution of column?.values?.() ?? []) {
      if (resolution?.status === 'auto-resolved') count += 1;
    }
  }
  return count;
}

/** Outcome counts of one send run, from `runImport`'s `results`. */
export function countResults(results) {
  const list = Array.isArray(results) ? results : [];
  const count = (status) => list.filter((r) => r?.status === status).length;
  return {
    rowsTotal: list.length,
    rowsCreated: count(SEND_STATUS.OK),
    rowsFailed: count(SEND_STATUS.FAILED),
    rowsDuplicate: count(SEND_STATUS.DUPLICATE),
    rowsUnknown: count(SEND_STATUS.UNKNOWN),
  };
}
