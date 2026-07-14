import { useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog.jsx';
import { Button } from '../ui/button.jsx';
import { ImportDropzone } from './ImportDropzone.jsx';
import { ImportColumnMapping } from './ImportColumnMapping.jsx';
import { ImportReviewQueue, buildErrorsCsv } from './ImportReviewQueue.jsx';
import { ImportConfirmStep } from './ImportConfirmStep.jsx';
import { ImportProgressStep } from './ImportProgressStep.jsx';
import { ImportFileErrorDialog } from './ImportFileErrorDialog.jsx';
import { ImportSystemErrorDialog } from './ImportSystemErrorDialog.jsx';
import { decodeCsvBuffer, parseDelimited } from '../../lib/import/parseDelimited.js';
import { mapColumns } from '../../lib/import/mapColumns.js';
import { dedupeRows } from '../../lib/import/dedupeRows.js';
import { resolveForeignKeys, resolveForeignKeyColumn } from '../../lib/import/resolveForeignKeys.js';
import { validateRow } from '../../lib/import/validateRows.js';
import { buildOperations } from '../../lib/import/buildOperations.js';
import { runImport, sendRow, SEND_STATUS } from '../../lib/import/importEngine.js';

const DEFAULT_LABELS = { title: 'Import' };

const STEP = { DROPZONE: 'dropzone', MAPPING: 'mapping', CONFIRM: 'confirm', SENDING: 'sending', FILE_ERROR: 'fileError', RESULT: 'result' };

function downloadCsv(csv, filename) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function renameRowKeys(row, mapping) {
  const renamed = {};
  for (const [header, target] of Object.entries(mapping)) {
    if (target) renamed[target] = row[header];
  }
  return renamed;
}

export function ImportDialog({ open, onOpenChange, config, token, postBatch, simSearchFn, onImported, labels }) {
  const text = { ...DEFAULT_LABELS, ...labels };
  const [step, setStep] = useState(STEP.DROPZONE);
  const [fileErrorMessage, setFileErrorMessage] = useState(null);
  const [mapping, setMapping] = useState({});
  const [headers, setHeaders] = useState([]);
  const [entries, setEntries] = useState([]);
  // Two independent filters, not one shared value — the design spec is explicit that
  // the preview (pre-send) and result (post-send) review queues each remember their own
  // filter state. 'error' (errors + skipped) is the default, matching the original
  // "show only errors" behavior — most rows are usually fine, so open on the ones that
  // need attention.
  const [statusFilterPreSend, setStatusFilterPreSend] = useState('error');
  const [statusFilterPostSend, setStatusFilterPostSend] = useState('error');
  const [progress, setProgress] = useState(0);
  // Debug-phase aid (per explicit request while the backend integration is still being
  // stabilized, one error at a time): the last uncontrolled/system-level failure of a
  // send, shown in its own blocking dialog with the full raw trace on top of the normal
  // Result step — not a replacement for the per-row review queue underneath, which stays
  // for retry/skip/download. Null means no system-error dialog is showing.
  const [systemError, setSystemError] = useState(null);

  const requiredTargets = useMemo(() => config.fields.filter((f) => f.required).map((f) => f.target), [config.fields]);
  const emailTargets = useMemo(() => config.fields.filter((f) => f.isEmail).map((f) => f.target), [config.fields]);
  // `matchEntity` presence is the real signal a column needs FK resolution — there is no
  // separate `isForeignKey` flag anywhere in the actual pipeline: generate-contract.js
  // never emits one (it only backfills `type`/`reference` from the contract), and
  // decisions.json authors set `matchEntity` directly (verified against
  // artifacts/product/decisions.json's uOM/productCategory/taxCategory, which already had
  // `matchEntity` with no `isForeignKey`). Checking `f.isForeignKey` here meant fkColumns
  // was always empty for every real window, so resolveForeignKeys() below never ran — FK
  // values were only ever resolved at send time (inside a composite descriptor, e.g.
  // Contacts' country), never previewed, confirmed by a real browser capture showing the
  // `/webhooks/?name=SimSearch` request firing only during send, not during the mapping/
  // confirm preview.
  const fkColumns = useMemo(() => config.fields.filter((f) => f.matchEntity).map((f) => ({ target: f.target, matchEntity: f.matchEntity, qtyResults: f.qtyResults })), [config.fields]);
  const fkTargets = useMemo(() => fkColumns.map((c) => c.target), [fkColumns]);
  const [fkResolutions, setFkResolutions] = useState(new Map());
  // buildOperations (engine) expects { spec, entity, targets: string[], descriptorName? } —
  // config carries `fields` (full descriptor objects, needed by the mapping/validation
  // steps above), so the operations-builder config is derived here rather than passing
  // `config` straight through, which would silently build an empty body. The real
  // decisions.json/contract.json field is `descriptor` (verified against
  // artifacts/contacts/decisions.json: `"descriptor": "contacts"`, not `descriptorName`)
  // — reading the wrong key here silently left `descriptorName` undefined, so
  // buildOperations always fell through to the flat single-op default builder instead of
  // the registered Contacts composite descriptor: no location/contact split, no country/
  // region resolution, raw address text dumped straight onto businessPartner, and the
  // descriptor's own oBTIKTaxIDKey default never applied — confirmed by inspecting the
  // actual /batch request body sent from the browser.
  // `token` must be threaded through too — a composite descriptor (e.g. Contacts) needs
  // it to call FK resolvers during operation-building (`resolveCountry(row.country,
  // { token: config.token })`). Omitting it here silently produced `token: undefined`,
  // which made `simSearch`'s own guard clause short-circuit to "no match" for every row
  // instead of actually querying — the descriptor then threw "country could not be
  // resolved" for every address-bearing row (confirmed via a real browser run).
  const operationsConfig = useMemo(() => ({
    spec: config.spec,
    entity: config.entity,
    descriptorName: config.descriptor,
    targets: config.fields.map((f) => f.target),
    token,
  }), [config.spec, config.entity, config.descriptor, config.fields, token]);

  // The real config shape (decisions.json → window.import, verified against
  // artifacts/contacts/decisions.json) is `dedupe: { scope, key: string[] }`, not a flat
  // `dedupeKeyTargets` — reading the wrong field silently passed `dedupeRows` an empty
  // key array, which collapses EVERY row to the same blank key and falsely flags all but
  // the first as duplicates (confirmed by reproducing it directly against
  // dedupeRows.js). Guard against that same failure mode for any other future empty/
  // missing config: dedupe only runs when there's an actual non-empty key list.
  const dedupeKeyTargets = config.dedupe?.key ?? [];

  const runValidation = useCallback(async (mappedRows) => {
    const { uniqueRows, duplicates } = dedupeKeyTargets.length > 0
      ? dedupeRows(mappedRows, dedupeKeyTargets)
      : { uniqueRows: mappedRows, duplicates: [] };
    const resolutions = fkColumns.length > 0
      ? await resolveForeignKeys({ rows: uniqueRows, columns: fkColumns, simSearchFn, token })
      : new Map();
    setFkResolutions(resolutions);
    const validated = uniqueRows.map((row) => ({
      row,
      ...validateRow(row, { requiredTargets, emailTargets, fkTargets, fkResolutions: resolutions }),
      status: 'pending',
    }));
    const skippedDuplicates = duplicates.map((d) => ({ row: d.row, errors: [{ target: '', message: 'Duplicate row (already in file).' }], status: 'skipped' }));
    setEntries([...validated.map((v) => ({ row: v.row, errors: v.errors, status: 'pending' })), ...skippedDuplicates]);
  }, [dedupeKeyTargets, fkColumns, fkTargets, requiredTargets, emailTargets, simSearchFn, token]);

  const handleFileSelected = useCallback(async (file) => {
    try {
      const buffer = await file.arrayBuffer();
      const text2 = decodeCsvBuffer(buffer);
      const { headers: parsedHeaders, rows } = parseDelimited(text2);
      const { mapping: autoMapping } = mapColumns(parsedHeaders, config.fields);
      setHeaders(parsedHeaders);
      setMapping(autoMapping);
      await runValidation(rows.map((row) => renameRowKeys(row, autoMapping)));
      setStep(STEP.MAPPING);
    } catch (error) {
      setFileErrorMessage(error.message);
      setStep(STEP.FILE_ERROR);
    }
  }, [config.fields, runValidation]);

  const handleMappingChange = useCallback((header, target) => {
    setMapping((prev) => ({ ...prev, [header]: target }));
  }, []);

  // Reuses the already-resolved fkResolutions from runValidation (not a fresh empty Map)
  // so undoing an edit back to an already-resolved raw value is recognized immediately.
  // Deliberately does NOT re-run resolveForeignKeyColumn here — this fires on every
  // keystroke (wired to the row input's onChange), and a SimSearch call per keystroke
  // would be both wasteful and slow. An edited FK value only gets re-resolved once the
  // row is applied via handleApplyFkValue (the FK-mismatch popover), not on every keystroke.
  const handleEditField = useCallback((index, targetField, value) => {
    setEntries((prev) => {
      const next = [...prev];
      const row = { ...next[index].row, [targetField]: value };
      const { valid, errors } = validateRow(row, { requiredTargets, emailTargets, fkTargets, fkResolutions });
      next[index] = { ...next[index], row, errors: valid ? [] : errors };
      return next;
    });
  }, [requiredTargets, emailTargets, fkTargets, fkResolutions]);

  // A candidate picked (or freeform text accepted) from the FK-mismatch popover — applies
  // it to one or more rows in one shot: merges the resolution into fkResolutions and
  // revalidates every affected row synchronously, so the error clears immediately without
  // a separate "Re-validate" click. A known `resolvedId` (the user picked an exact
  // SimSearch candidate) skips the network round-trip entirely; freeform typed text still
  // needs a fresh SimSearch lookup, same as the explicit Re-validate action.
  const handleApplyFkValue = useCallback(async ({ indices, field, value, resolvedId }) => {
    let resolution;
    if (resolvedId != null) {
      resolution = { status: 'auto-resolved', id: resolvedId, name: value };
    } else {
      const valueMap = await resolveForeignKeyColumn({
        values: [value],
        matchEntity: field.matchEntity,
        simSearchFn,
        token,
        qtyResults: field.qtyResults,
      });
      resolution = valueMap.get(value);
    }
    const nextResolutions = new Map(fkResolutions);
    const columnMap = new Map(nextResolutions.get(field.target) ?? []);
    columnMap.set(value, resolution);
    nextResolutions.set(field.target, columnMap);
    setFkResolutions(nextResolutions);
    const indexSet = new Set(indices);
    setEntries((prev) => prev.map((entry, i) => {
      if (!indexSet.has(i)) return entry;
      const row = { ...entry.row, [field.target]: value };
      const { valid, errors } = validateRow(row, { requiredTargets, emailTargets, fkTargets, fkResolutions: nextResolutions });
      return { ...entry, row, errors: valid ? [] : errors };
    }));
  }, [fkResolutions, requiredTargets, emailTargets, fkTargets, simSearchFn, token]);

  const handleSkipEntry = useCallback((index) => {
    setEntries((prev) => prev.map((e, i) => (i === index ? { ...e, status: 'skipped' } : e)));
  }, []);

  // Brings a skipped row back into the editable queue (e.g. a false-positive
  // in-file duplicate the user wants to review and import after all). Errors
  // recorded at skip time (a dedupe row-level error, or a prior send failure)
  // are left untouched, so it reappears exactly where the normal error/OK
  // branches already know how to render and act on it.
  const handleUnskipEntry = useCallback((index) => {
    setEntries((prev) => prev.map((e, i) => (i === index ? { ...e, status: 'pending' } : e)));
  }, []);

  const validCount = entries.filter((e) => e.status === 'pending' && e.errors.length === 0).length;
  const skipCount = entries.length - validCount;

  const handleSend = useCallback(async () => {
    setStep(STEP.SENDING);
    setProgress(0);
    const toSend = entries.filter((e) => e.status === 'pending' && e.errors.length === 0);
    // runImport isolates per-row build/send failures on its own (a bad row surfaces as
    // that row's FAILED result, not a thrown exception) — this catch is a last-resort
    // safety net for anything genuinely unexpected escaping that isolation, so the dialog
    // never again gets stuck on "Importing… 0%" forever with no way for the user to see
    // what happened or retry (reproduced via a real browser run before runImport's own
    // per-row try/catch was added).
    let results;
    try {
      ({ results } = await runImport(toSend.map((e) => e.row), {
        buildRowOperations: (row) => buildOperations(row, operationsConfig),
        postBatch,
        concurrency: config.concurrency,
        maxRows: config.maxRows,
        onProgress: (completed, total) => setProgress(Math.round((completed / total) * 100)),
      }));
    } catch (error) {
      setFileErrorMessage(error.message || 'Unknown error while sending the import.');
      setStep(STEP.FILE_ERROR);
      return;
    }
    const okCount = results.filter((r) => r.status === 'ok').length;
    // A DUPLICATE result (the row's record already exists server-side, a unique-constraint
    // rejection — see importEngine.js's isDuplicateKeyError) is not an actionable failure:
    // retrying would only repeat the identical rejection, and there's nothing for the user
    // to fix. Reported as a skipped entry (same treatment the pre-send in-file dedupe
    // already uses — greyed out, no retry/skip buttons, per ImportReviewQueue) rather than
    // lumped in with genuine failures that still need the user's attention.
    const duplicateResults = results.filter((r) => r.status === SEND_STATUS.DUPLICATE);
    const trueFailures = results.filter((r) => r.status !== 'ok' && r.status !== SEND_STATUS.DUPLICATE);
    const resultEntries = [
      ...duplicateResults.map((r) => ({ row: r.row, errors: [{ target: '', message: r.error?.message || 'Already exists' }], status: 'skipped' })),
      ...trueFailures.map((r) => ({ row: r.row, errors: [{ target: '', message: r.error?.message || 'Unknown error' }], status: 'pending' })),
    ];
    setEntries(resultEntries);
    setStep(STEP.RESULT);
    // The last TRUE failure of this run, front-and-center with its row data, the exact
    // request that was sent, and the full raw trace — see the systemError state comment
    // above for why this exists alongside the review queue. A duplicate is expected,
    // benign server behavior, not worth a blocking "system error" dialog.
    const lastFailure = trueFailures.at(-1);
    setSystemError(lastFailure ? {
      message: lastFailure.error?.message || 'Unknown error',
      raw: lastFailure.error?.raw,
      row: lastFailure.row,
      operations: lastFailure.operations,
    } : null);
    // Reports failedCount alongside okCount (not just a bare success count) so the caller
    // can decide whether it's actually safe to close the dialog. The design spec is
    // explicit that the Result step must show "the same review queue pattern applied to
    // server-rejected rows" — a caller that unconditionally closes on every onImported
    // call (as ListView.jsx originally did) unmounts this whole dialog the instant it
    // renders the RESULT step, hiding every failed row's real error message the very
    // moment it becomes visible. Confirmed via a real browser run: a batch that failed
    // outright (a genuine 500) still closed the dialog immediately, so nothing ever
    // reached the screen even though sendRow was correctly surfacing the real message.
    // failedCount only counts trueFailures — duplicates alone should not keep the dialog
    // forced open, since there's nothing left for the user to act on.
    onImported({ okCount, failedCount: trueFailures.length });
    if (okCount > 0) toast.success(`${okCount} records imported successfully`);
    if (duplicateResults.length > 0) toast.info(`${duplicateResults.length} row(s) skipped — already exist`);
  }, [entries, operationsConfig, config.concurrency, config.maxRows, postBatch, onImported]);

  const handleRetryEntryPostSend = useCallback(async (index) => {
    const entry = entries[index];
    const operations = await buildOperations(entry.row, operationsConfig);
    const result = await sendRow(operations, { postBatch });
    setEntries((prev) => {
      const next = [...prev];
      if (result.status === 'ok') {
        next.splice(index, 1);
      } else if (result.status === SEND_STATUS.DUPLICATE) {
        // Same treatment as the initial send — nothing for the user to fix, not worth
        // re-flagging as an actionable failure.
        next[index] = { ...next[index], errors: [{ target: '', message: result.error?.message || 'Already exists' }], status: 'skipped' };
      } else {
        next[index] = { ...next[index], errors: [{ target: '', message: result.error?.message || 'Unknown error' }] };
      }
      return next;
    });
    if (result.status !== 'ok' && result.status !== SEND_STATUS.DUPLICATE) {
      setSystemError({ message: result.error?.message || 'Unknown error', raw: result.error?.raw, row: entry.row, operations });
    }
  }, [entries, operationsConfig, postBatch]);

  const handleRetryFile = useCallback(() => {
    setFileErrorMessage(null);
    setStep(STEP.DROPZONE);
  }, []);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange} data-testid="Dialog__38a6c3">
        <DialogContent className="w-[90vw] max-w-[1200px] max-h-[90vh] overflow-y-auto" data-testid="DialogContent__38a6c3">
          <DialogHeader data-testid="DialogHeader__38a6c3">
            <DialogTitle data-testid="DialogTitle__38a6c3">{text.title}</DialogTitle>
          </DialogHeader>

          {step === STEP.DROPZONE && <ImportDropzone onFileSelected={handleFileSelected} data-testid="ImportDropzone__38a6c3" />}

          {step === STEP.FILE_ERROR && (
            <ImportFileErrorDialog
              message={fileErrorMessage}
              onCancel={() => onOpenChange(false)}
              onRetry={handleRetryFile}
              data-testid="ImportFileErrorDialog__38a6c3" />
          )}

          {step === STEP.MAPPING && (
            <div className="flex min-h-0 max-h-[70vh] min-w-0 flex-col gap-4">
              <ImportColumnMapping
                headers={headers}
                importFields={config.fields}
                mapping={mapping}
                onMappingChange={handleMappingChange}
                data-testid="ImportColumnMapping__38a6c3" />
              <ImportReviewQueue
                entries={entries}
                fields={config.fields}
                statusFilter={statusFilterPreSend}
                onStatusFilterChange={setStatusFilterPreSend}
                onEditField={handleEditField}
                showRetry={false}
                onSkipEntry={handleSkipEntry}
                onUnskipEntry={handleUnskipEntry}
                onApplyFkValue={handleApplyFkValue}
                onDownloadErrors={() => downloadCsv(buildErrorsCsv(entries), 'import-errors.csv')}
                simSearchFn={simSearchFn}
                token={token}
                data-testid="ImportReviewQueue__38a6c3" />
              <div className="flex justify-end">
                <Button
                  type="button"
                  onClick={() => setStep(STEP.CONFIRM)}
                  disabled={validCount === 0}
                  data-testid="ImportDialog__importButton"
                >
                  {`Import ${validCount}`}
                </Button>
              </div>
            </div>
          )}

          {step === STEP.CONFIRM && (
            <ImportConfirmStep
              importCount={validCount}
              skipCount={skipCount}
              onCancel={() => setStep(STEP.MAPPING)}
              onConfirm={handleSend}
              data-testid="ImportConfirmStep__38a6c3" />
          )}

          {step === STEP.SENDING && <ImportProgressStep percent={progress} data-testid="ImportProgressStep__38a6c3" />}

          {step === STEP.RESULT && (
            <div className="flex min-h-0 max-h-[70vh] min-w-0 flex-col gap-4">
              {entries.length > 0 && (
                <ImportReviewQueue
                  entries={entries}
                  fields={config.fields}
                  statusFilter={statusFilterPostSend}
                  onStatusFilterChange={setStatusFilterPostSend}
                  onEditField={handleEditField}
                  onRetryEntry={handleRetryEntryPostSend}
                  onSkipEntry={handleSkipEntry}
                  onUnskipEntry={handleUnskipEntry}
                  onApplyFkValue={handleApplyFkValue}
                  onDownloadErrors={() => downloadCsv(buildErrorsCsv(entries), 'import-errors.csv')}
                  retryLabel="Retry"
                  simSearchFn={simSearchFn}
                  token={token}
                  data-testid="ImportReviewQueue__38a6c3" />
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
      <ImportSystemErrorDialog
        open={Boolean(systemError)}
        message={systemError?.message}
        row={systemError?.row}
        operations={systemError?.operations}
        raw={systemError?.raw}
        onClose={() => setSystemError(null)}
        data-testid="ImportSystemErrorDialog__38a6c3" />
    </>
  );
}
