import { useCallback, useMemo, useRef, useState } from 'react';
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
import { ImportSendingCloseDialog } from './ImportSendingCloseDialog.jsx';
import { decodeCsvBuffer, parseDelimited, ImportParseError } from '../../lib/import/parseDelimited.js';
import { parseXlsx } from '../../lib/import/parseXlsx.js';
import { mapColumns } from '../../lib/import/mapColumns.js';
import { dedupeRows } from '../../lib/import/dedupeRows.js';
import { resolveForeignKeys, resolveForeignKeyColumn } from '../../lib/import/resolveForeignKeys.js';
import { validateRow } from '../../lib/import/validateRows.js';
import { buildOperations } from '../../lib/import/buildOperations.js';
import { runImport, sendRow, SEND_STATUS } from '../../lib/import/importEngine.js';
import { buildTemplateCsv, resolveTemplateHeaders } from '../../lib/import/buildTemplateCsv.js';
import { buildTemplateXlsx } from '../../lib/import/buildTemplateXlsx.js';
import {
  isXlsxFileName, outputFormats, isAcceptedFileName, formatNames,
} from '../../lib/import/importFormats.js';
import { runImportRowValidator } from '../../lib/import/rowValidators.js';
import { findExistingKeys, buildLookupKey } from '../../lib/import/existingRecordLookup.js';

// Root-level labels for ImportDialog's own chrome. `importButton` is a function of the
// valid-row count, mirroring the (n) => string labels the confirm step already uses, so the
// whole flow's button text is translatable rather than the hardcoded `Import ${n}` it was.
const DEFAULT_LABELS = { title: 'Import', revalidating: 'Revalidating rows…', downloadTemplate: 'Download CSV template', downloadTemplateCsv: 'Download CSV template', downloadTemplateXlsx: 'Download Excel template', importButton: (n) => `Import ${n}` };

/**
 * Why a row was skipped. Skipping is not an error — nothing is wrong with the file and
 * there is nothing for the user to fix — so these carry their own wording, separate from
 * the validation messages in `validateRows.js`.
 */
const SKIP_MESSAGES = {
  duplicateInFile: { key: 'importSkipDuplicateInFile', fallback: 'Duplicate row (already in file).' },
  alreadyExists: { key: 'importSkipAlreadyExists', fallback: 'This record already exists and will not be imported again.' },
};

/**
 * Shape of the optional `labels` prop — a NESTED object: root-level keys for this dialog's
 * own chrome, plus one sub-slice per child component, each matching that child's own
 * DEFAULT_LABELS. Every level is optional; any omitted key/slice falls back to the child's
 * hardcoded English DEFAULT_LABELS. The functional app (etendo_schema_forge's ListView)
 * builds this object from its useUI() dictionary and MUST match this shape exactly.
 *
 *   {
 *     title, revalidating, downloadTemplate, importButton: (n) => string,   // this dialog
 *     dropzone:     { dropHere, dropHint },                                  // ImportDropzone
 *     progress:     { title, subtitle },                                     // ImportProgressStep
 *     mapping:      { notImported, mappedSummary, editMatch, editTitle, save, cancel }, // ImportColumnMapping
 *     confirm:      { title, willImport: (n) => string, willSkip: (n) => string, cancel, confirm }, // ImportConfirmStep
 *     fileError:    { title, cancel, retry },                                // ImportFileErrorDialog
 *     reviewQueue:  { filterAll, filterOk, filterError, skip, skipped, unskip, downloadErrors,
 *                     status, statusOk, statusError, fieldErrorsTooltip, bulkApplyTitle,
 *                     bulkApplyDescription, bulkApplyOnlyThis, bulkApplyAll, retry },  // ImportReviewQueue
 *                     // NB: `retry` feeds ImportReviewQueue's separate `retryLabel` prop, not its DEFAULT_LABELS
 *     systemError:  { title, subtitle, copy, copied, copyFailed, close, showReport, hideReport,
 *                     rowData, requestSent, serverResponse },         // ImportSystemErrorDialog
 *     sendingClose: { title, body, keepWatching, closeAnyway },        // ImportSendingCloseDialog
 *   }
 *
 * Templated strings (mappedSummary's {mapped}/{total}, fieldErrorsTooltip's {fields},
 * bulkApplyDescription's {count}/{raw}/{value}) keep their {placeholders} — each child fills
 * them at render time. `translate` is a separate, plain (key, params) => string function
 * (e.g. useUI's `ui`) injected into the send pipeline so backend errors get localized too.
 */

const STEP = { DROPZONE: 'dropzone', MAPPING: 'mapping', CONFIRM: 'confirm', SENDING: 'sending', FILE_ERROR: 'fileError', RESULT: 'result' };

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadCsv(csv, filename) {
  downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), filename);
}

function renameRowKeys(row, mapping) {
  const renamed = {};
  for (const [header, target] of Object.entries(mapping)) {
    if (target) renamed[target] = row[header];
  }
  return renamed;
}

/**
 * @param {(field: object) => string} [fieldLabelFn] Resolves a field's session-language
 *   caption. Used for the downloaded template's headers — without it the template falls back
 *   to the field's first alias, which in every window is the Spanish term, so the template
 *   came out in Spanish no matter what language the session was in — AND (ETP-5223) for the
 *   review grid's column headers and the column-mapping dropdown, which read `field.label`
 *   (the English text in decisions.json) and so stayed English in a Spanish session while
 *   the template beside them was already translated.
 *
 *   Locale keys this dialog resolves through `translate`, beyond the `labels` object:
 *   `importSuccessToast`/`importSkippedToast`/`importFailedToast` (`{count}`), the
 *   `ImportParseError` keys
 *   `importErrorFileEmpty`, `importErrorDuplicateHeader` (`{header}`),
 *   `importErrorUnreadableXlsx` (`{detail}`), `importErrorMultipleSheets` (`{sheets}`),
 *   and `importErrorUnknown`.
 * @param {(criteria: object, keyTargets: string[]) => Promise<Array<object>>} [existingKeyFetchFn]
 *   Queries the entity for records matching the dedupe key, so rows that already exist are
 *   marked Saltada in the review queue instead of being discovered as duplicates after the
 *   send. Only used when `config.dedupe.scope` is `"database"`.
 */
export function ImportDialog({ open, onOpenChange, config, token, postBatch, simSearchFn, onImported, labels, translate, fieldLabelFn, existingKeyFetchFn }) {
  const text = { ...DEFAULT_LABELS, ...labels };
  const [step, setStep] = useState(STEP.DROPZONE);
  const [fileErrorMessage, setFileErrorMessage] = useState(null);
  const [mapping, setMapping] = useState({});
  const [headers, setHeaders] = useState([]);
  const [rawRows, setRawRows] = useState([]);
  const [entries, setEntries] = useState([]);
  const [isRevalidating, setIsRevalidating] = useState(false);
  // Two independent filters, not one shared value — the design spec is explicit that
  // the preview (pre-send) and result (post-send) review queues each remember their own
  // filter state. 'ok' is the default so a newly loaded file opens on the happy
  // path: users can immediately review the rows that will be imported. Errors
  // remain available through the Errors tab and are still highlighted by the
  // row validation state.
  const [statusFilterPreSend, setStatusFilterPreSend] = useState('ok');
  const [statusFilterPostSend, setStatusFilterPostSend] = useState('error');
  const [progress, setProgress] = useState(0);
  // Debug-phase aid (per explicit request while the backend integration is still being
  // stabilized, one error at a time): the last uncontrolled/system-level failure of a
  // send, shown in its own blocking dialog with the full raw trace on top of the normal
  // Result step — not a replacement for the per-row review queue underneath, which stays
  // for retry/skip/download. Null means no system-error dialog is showing.
  const [systemError, setSystemError] = useState(null);
  // ETP-5225: the user tried to close the dialog while the send was running, and has been
  // asked what they actually meant. Null-op outside STEP.SENDING — see `handleOpenChange`.
  const [pendingCloseWhileSending, setPendingCloseWhileSending] = useState(false);
  /**
   * Whether the user confirmed closing mid-send, i.e. whether the RESULT step will have anywhere
   * to render. A ref rather than state on purpose: `handleSend` reads it from inside an async
   * closure that was created before the close happened, so a state value would be the stale
   * `false` captured at send time and the failure toast below would never fire.
   */
  const closedWhileSendingRef = useRef(false);

  const requiredTargets = useMemo(() => config.fields.filter((f) => f.required).map((f) => f.target), [config.fields]);
  const emailTargets = useMemo(() => config.fields.filter((f) => f.isEmail).map((f) => f.target), [config.fields]);
  // Declared in decisions.json as `isNumeric: true`. Drives the review-queue check that a
  // malformed amount ("abc" in a price column) fails its row BEFORE the send rather than
  // inside buildOperations, where the user only saw it after confirming the import.
  const numericTargets = useMemo(() => config.fields.filter((f) => f.isNumeric).map((f) => f.target), [config.fields]);

  // The template is written in the session language, so the header a user gets back in
  // their filled-in file is NOT necessarily the field's first (Spanish) alias. Adding that
  // header to the field's aliases is what keeps the round-trip working in any language:
  // one list feeds both the template writer and the matcher, so they cannot drift.
  const localizedFields = useMemo(() => {
    // Resolved WITHOUT the required marker, since `mapColumns` strips it before matching —
    // the alias must be the bare header. Uses the same collision-safe resolution the
    // template writer uses, so the alias always matches the header actually written.
    const headers = resolveTemplateHeaders(
      config.fields.map((f) => ({ ...f, required: false })),
      { headerFor: fieldLabelFn },
    );
    return config.fields.map((field, i) => (
      headers[i] && !(field.aliases ?? []).includes(headers[i])
        ? { ...field, aliases: [...(field.aliases ?? []), headers[i]] }
        : field
    ));
  }, [config.fields, fieldLabelFn]);
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
  // `translate` is threaded into the descriptor config too — a composite descriptor (e.g.
  // Contacts) throws its own row-level errors (an unresolved country FK) and needs the app's
  // translate fn to localize them, exactly like the send pipeline does for backend errors.
  const operationsConfig = useMemo(() => ({
    spec: config.spec,
    entity: config.entity,
    descriptorName: config.descriptor,
    targets: config.fields.map((f) => f.target),
    token,
    translate,
  }), [config.spec, config.entity, config.descriptor, config.fields, token, translate]);

  // The real config shape (decisions.json → window.import, verified against
  // artifacts/contacts/decisions.json) is `dedupe: { scope, key: string[] }`, not a flat
  // `dedupeKeyTargets` — reading the wrong field silently passed `dedupeRows` an empty
  // key array, which collapses EVERY row to the same blank key and falsely flags all but
  // the first as duplicates (confirmed by reproducing it directly against
  // dedupeRows.js). Guard against that same failure mode for any other future empty/
  // missing config: dedupe only runs when there's an actual non-empty key list.
  const dedupeKeyTargets = config.dedupe?.key ?? [];

  /**
   * ETP-5348: the contract nests these under `limit` — `window.import.limit` in decisions.json,
   * and `frontendContract.window.import.limit` in the generated contract.json, verified against
   * artifacts/product and artifacts/contacts. They were read as `config.maxRows` /
   * `config.concurrency`, which are ALWAYS `undefined`, so `runImport`'s own parameter defaults
   * took over. Those defaults are 5000 and 4 — the same numbers every window happens to declare
   * today — which is exactly why nothing ever looked wrong: a window that declared a different
   * limit would have been ignored in complete silence.
   *
   * The flat `config.maxRows` is still honored as a second choice so a caller (or a test) that
   * passes it directly keeps working; the nested value is the one the pipeline actually produces.
   */
  const maxRows = config.limit?.maxRows ?? config.maxRows ?? 5000;
  const concurrency = config.limit?.concurrency ?? config.concurrency ?? 4;

  /**
   * One locale lookup with an English fallback, the same posture `validateRows.js` and
   * `importEngine.js` take: no translator, an unknown key, or a dictionary that echoes the
   * key back all degrade to the English text rather than printing a raw key at the user.
   */
  const localize = useCallback((key, fallback, params) => {
    if (typeof translate !== 'function') return fallback;
    const translated = translate(key, params);
    return translated && translated !== key ? translated : fallback;
  }, [translate]);

  // The two reasons a row is skipped rather than failed. Both are shown verbatim in the
  // review queue, so both go through `translate` — they were hardcoded English strings
  // sitting in the middle of an app used primarily in Spanish.
  const labelFor = useCallback((which) => {
    const { key, fallback } = SKIP_MESSAGES[which];
    return localize(key, fallback);
  }, [localize]);

  /**
   * ETP-5223: `parseDelimited`/`parseXlsx` are plain modules with no translator, so they
   * throw the English text on `message` plus the locale `messageKey`/`params` to resolve it
   * — "The file is empty." and `Duplicate column header: "…"` reached the user in English
   * even in a fully Spanish session. Anything else thrown here (a genuine runtime fault)
   * has no key and keeps its own message.
   */
  const localizeError = useCallback((error) => {
    if (error?.messageKey) return localize(error.messageKey, error.message, error.params);
    return error?.message || localize('importErrorUnknown', 'Unknown error.');
  }, [localize]);

  // Single definition of "what makes a row valid", shared by the initial pass and by both
  // re-validate-after-edit paths. Kept as one function on purpose: when the edit paths
  // carried their own shorter argument list, fixing an unrelated cell silently cleared a
  // numeric or coded-value error that was still true, and the row went back to Correcta.
  const revalidate = useCallback((row, resolutions) => validateRow(row, {
    requiredTargets,
    emailTargets,
    numericTargets,
    fkTargets,
    fkResolutions: resolutions,
    extraErrors: runImportRowValidator(config.descriptor, row, { translate, config }),
    translate,
  }), [requiredTargets, emailTargets, numericTargets, fkTargets, config, translate]);

  const runValidation = useCallback(async (mappedRows) => {
    const { uniqueRows, duplicates } = dedupeKeyTargets.length > 0
      ? dedupeRows(mappedRows, dedupeKeyTargets)
      : { uniqueRows: mappedRows, duplicates: [] };
    const resolutions = fkColumns.length > 0
      ? await resolveForeignKeys({ rows: uniqueRows, columns: fkColumns, simSearchFn, token })
      : new Map();
    setFkResolutions(resolutions);

    // Rows already present server-side. Checked only when the window opts in with
    // `dedupe.scope: "database"`. A failed batch costs only its own keys (ETP-5374) and never
    // blocks the import — send-time duplicate handling stays the backstop.
    //
    // `findExistingKeys` also reports `complete`, which nothing here reads: a row whose batch
    // failed is presented exactly like one that was checked and found absent.
    const { existing: existingKeys } = config.dedupe?.scope === 'database'
      ? await findExistingKeys({ rows: uniqueRows, keyTargets: dedupeKeyTargets, fetchFn: existingKeyFetchFn })
      : { existing: new Set() };

    const validated = uniqueRows.map((row) => {
      const key = buildLookupKey(row, dedupeKeyTargets);
      if (key !== null && existingKeys.has(key)) {
        return {
          row,
          // ETP-5226: `isSkipReason` marks this as WHY the row was skipped, not as a validation
          // error on the key column. The review queue shows only flagged (or blank-target)
          // messages under the Skipped tag, so an ordinary field error on the same row cannot be
          // mistaken for the reason. The target stays because `buildErrorsCsv` prefixes it in the
          // downloadable error file.
          errors: [{ target: dedupeKeyTargets[0] ?? '', message: labelFor('alreadyExists'), isSkipReason: true }],
          status: 'skipped',
        };
      }
      const { errors } = revalidate(row, resolutions);
      return { row, errors, status: 'pending' };
    });

    const skippedDuplicates = duplicates.map((d) => ({ row: d.row, errors: [{ target: '', message: labelFor('duplicateInFile') }], status: 'skipped' }));
    setEntries([...validated, ...skippedDuplicates]);
  }, [dedupeKeyTargets, fkColumns, revalidate, simSearchFn, token, config, existingKeyFetchFn, labelFor]);

  const handleFileSelected = useCallback(async (file) => {
    try {
      // A new file starts a fresh review session. Do not carry a previous
      // Errors/All selection into the next upload.
      setStatusFilterPreSend('ok');
      // ETP-5348: the FIRST thing that happens to an upload is a format check, because nothing
      // downstream performs one. The dropzone's `accept` attribute only filters the OS picker's
      // default view — drag-and-drop bypasses it — and `parseDelimited` cannot refuse a binary
      // either, since its Windows-1252 fallback decodes any byte sequence without error. So a
      // `.docx` used to parse into one nonsense column and drop the user on a mapping screen
      // with nothing mapped and nothing said. `formatNames` is reused rather than re-listing the
      // extensions here, so the message and the dropzone hint can never disagree.
      if (!isAcceptedFileName(file.name, config.formats)) {
        const accepted = formatNames(config.formats).join(', ');
        throw new ImportParseError(
          `Unsupported file format. Accepted formats: ${accepted}.`,
          { messageKey: 'importErrorUnsupportedFormat', params: { formats: accepted } },
        );
      }
      // One boundary, two parsers. `parseXlsx` is contracted to return exactly what
      // `parseDelimited` returns, so everything from here down — mapColumns, runValidation,
      // the FK resolvers, the dedupe, the review queue — is format-blind and unchanged.
      const { headers: parsedHeaders, rows } = isXlsxFileName(file.name)
        ? await parseXlsx(file)
        : parseDelimited(decodeCsvBuffer(await file.arrayBuffer()));
      // ETP-5348: reject an oversized file HERE, before it is validated, reviewed and confirmed.
      // `runImport` already honored `maxRows`, but it did so with `rows.slice(0, maxRows)` at
      // send time: the extra rows were never attempted, never counted and never reported, so a
      // 5001-row file imported 5000 and lost the last one with no error, no warning and no trace
      // in the summary. The user's only way to notice was to count the records afterwards.
      // Refusing the file is the honest answer — silently importing part of what someone handed
      // us is the behaviour being fixed, and truncating with a nicer notice is still that.
      if (rows.length > maxRows) {
        throw new ImportParseError(
          `The file has ${rows.length} rows, more than the ${maxRows} this import accepts. `
          + 'Split it into smaller files.',
          { messageKey: 'importErrorTooManyRows', params: { count: rows.length, limit: maxRows } },
        );
      }
      const { mapping: autoMapping } = mapColumns(parsedHeaders, localizedFields);
      setHeaders(parsedHeaders);
      setRawRows(rows);
      setMapping(autoMapping);
      await runValidation(rows.map((row) => renameRowKeys(row, autoMapping)));
      setStep(STEP.MAPPING);
    } catch (error) {
      setFileErrorMessage(localizeError(error));
      setStep(STEP.FILE_ERROR);
    }
  }, [localizedFields, runValidation, localizeError, config.formats, maxRows]);

  const handleApplyMapping = useCallback(async (newMapping) => {
    setMapping(newMapping);
    setIsRevalidating(true);
    try {
      await runValidation(rawRows.map((row) => renameRowKeys(row, newMapping)));
    } finally {
      setIsRevalidating(false);
    }
  }, [rawRows, runValidation]);

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
      const { valid, errors } = revalidate(row, fkResolutions);
      next[index] = { ...next[index], row, errors: valid ? [] : errors };
      return next;
    });
  }, [revalidate, fkResolutions]);

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
      const { valid, errors } = revalidate(row, nextResolutions);
      return { ...entry, row, errors: valid ? [] : errors };
    }));
  }, [fkResolutions, revalidate, simSearchFn, token]);

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
    // A previous run's unanswered question must not resurface over this one.
    setPendingCloseWhileSending(false);
    closedWhileSendingRef.current = false;
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
        translate,
        concurrency,
        maxRows,
        onProgress: (completed, total) => setProgress(Math.round((completed / total) * 100)),
      }));
    } catch (error) {
      setFileErrorMessage(localizeError(error));
      setStep(STEP.FILE_ERROR);
      return;
    }
    const okCount = results.filter((r) => r.status === 'ok').length;
    // A DUPLICATE result (the row's record already exists server-side, a unique-constraint
    // rejection — see importEngine.js's classifyImportError) is not an actionable failure:
    // retrying would only repeat the identical rejection, and there's nothing for the user
    // to fix. Reported as a skipped entry (same treatment the pre-send in-file dedupe
    // already uses — greyed out, no retry/skip buttons, per ImportReviewQueue) rather than
    // lumped in with genuine failures that still need the user's attention.
    const duplicateResults = results.filter((r) => r.status === SEND_STATUS.DUPLICATE);
    const trueFailures = results.filter((r) => r.status !== 'ok' && r.status !== SEND_STATUS.DUPLICATE);
    const resultEntries = [
      ...duplicateResults.map((r) => ({ row: r.row, errors: [{ target: '', message: r.error?.message || labelFor('alreadyExists') }], status: 'skipped' })),
      ...trueFailures.map((r) => ({ row: r.row, errors: [{ target: '', message: r.error?.message || localize('importErrorUnknown', 'Unknown error.') }], status: 'pending' })),
    ];
    setEntries(resultEntries);
    setStep(STEP.RESULT);
    // The last TRUE failure of this run, front-and-center with its row data, the exact
    // request that was sent, and the full raw trace — see the systemError state comment
    // above for why this exists alongside the review queue. A duplicate is expected,
    // benign server behavior, not worth a blocking "system error" dialog.
    const lastFailure = trueFailures.at(-1);
    // A descriptor/build failure (operations === null) is actionable row data,
    // not an unexpected backend/system failure. Keep it in the result queue so
    // users get the row-specific message without a misleading support dialog.
    const lastSystemFailure = lastFailure?.operations !== null ? lastFailure : null;
    setSystemError(lastSystemFailure ? {
      message: lastSystemFailure.error?.message || 'Unknown error',
      raw: lastSystemFailure.error?.raw,
      row: lastSystemFailure.row,
      operations: lastSystemFailure.operations,
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
    // ETP-5223: both toasts are the LAST thing a user sees after a successful import, and
    // both were hardcoded English template literals — the one place where "N records
    // imported successfully" greeted a Spanish user at the end of an otherwise Spanish flow.
    if (okCount > 0) {
      toast.success(localize('importSuccessToast', `${okCount} records imported successfully`, { count: okCount }));
    }
    if (duplicateResults.length > 0) {
      toast.info(localize(
        'importSkippedToast',
        `${duplicateResults.length} row(s) skipped — already exist`,
        { count: duplicateResults.length },
      ));
    }
    // ETP-5225 — the failure counterpart, and ONLY when the user closed mid-send.
    //
    // Failures are normally reported by the RESULT step's review queue, row by row with the
    // reason and a retry. Closing the dialog unmounts that, so a run where 3 of 10 rows failed
    // announced "7 records imported successfully" and nothing else: the smaller-than-expected
    // number was the only hint anything had gone wrong. The success toast survives the unmount
    // because `<Toaster>` is mounted at the app root, so this one does too.
    //
    // Guarded on the close because with the dialog still open the queue IS on screen and this
    // would only restate, less usefully, what it already shows in full.
    if (closedWhileSendingRef.current && trueFailures.length > 0) {
      toast.error(localize(
        'importFailedToast',
        `${trueFailures.length} row(s) could not be imported`,
        { count: trueFailures.length },
      ));
    }
  }, [entries, operationsConfig, concurrency, maxRows, postBatch, onImported, translate, localize, labelFor, localizeError]);

  const handleRetryEntryPostSend = useCallback(async (index) => {
    const entry = entries[index];
    const operations = await buildOperations(entry.row, operationsConfig);
    const result = await sendRow(operations, { postBatch, translate });
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
  }, [entries, operationsConfig, postBatch, translate]);

  // Which template formats to offer. Derived from the window's `formats` declaration, never
  // declared separately, so the dialog can only hand out a file the same dialog can read back.
  // `txt` is filtered out by `outputFormats`: it is an input convenience (Excel's tab-delimited
  // save), and a `.txt` template would be absurd.
  const templateFormats = useMemo(() => outputFormats(config.formats), [config.formats]);

  /**
   * Caption for one template control.
   *
   * Precedence matters for back-compatibility: a caller that predates xlsx passes only
   * `downloadTemplate` (already localized). Reading `text.downloadTemplateCsv` instead would
   * silently fall through to the English DEFAULT_LABELS entry and render an English caption in
   * a Spanish session — the ETP-4669 failure mode, which is why this consults `labels` directly
   * rather than the merged `text`.
   */
  const templateCaption = useCallback((format) => {
    if (format === 'csv') {
      return labels?.downloadTemplateCsv ?? labels?.downloadTemplate ?? DEFAULT_LABELS.downloadTemplateCsv;
    }
    return labels?.[`downloadTemplate${format.charAt(0).toUpperCase()}${format.slice(1)}`]
      ?? DEFAULT_LABELS[`downloadTemplate${format.charAt(0).toUpperCase()}${format.slice(1)}`]
      ?? format.toUpperCase();
  }, [labels]);

  const downloadTemplate = useCallback(async (format) => {
    const base = `${config.spec}-import-template`;
    if (format === 'xlsx') {
      // Async because the writer zips the workbook; the CSV branch stays synchronous.
      downloadBlob(await buildTemplateXlsx(localizedFields, { headerFor: fieldLabelFn }), `${base}.xlsx`);
      return;
    }
    downloadCsv(buildTemplateCsv(localizedFields, { headerFor: fieldLabelFn }), `${base}.csv`);
  }, [config.spec, localizedFields, fieldLabelFn]);

  const handleRetryFile = useCallback(() => {
    setFileErrorMessage(null);
    setStep(STEP.DROPZONE);
  }, []);

  /**
   * ETP-5225: closing MID-SEND used to go straight through to `onOpenChange`, so the dialog
   * disappeared while `handleSend` kept creating records. Nothing said so, and a user who
   * closed it to abort a mistaken import found the products there after a reload — the modal
   * read as a cancel button that silently was not one.
   *
   * The send cannot actually be stopped (each row is its own committed `/batch` call), so the
   * close is intercepted and the user is told what it does, rather than offered a cancel that
   * would be a lie. Every other step closes as before — this only guards the one window where
   * closing means something different from what it looks like.
   */
  const handleOpenChange = useCallback((next) => {
    if (!next && step === STEP.SENDING) {
      setPendingCloseWhileSending(true);
      return;
    }
    onOpenChange(next);
  }, [step, onOpenChange]);

  const closeAnyway = useCallback(() => {
    setPendingCloseWhileSending(false);
    closedWhileSendingRef.current = true;
    onOpenChange(false);
  }, [onOpenChange]);

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange} data-testid="Dialog__38a6c3">
        <DialogContent className="w-[90vw] max-w-[1200px] max-h-[90vh] overflow-y-auto" data-testid="DialogContent__38a6c3">
          <DialogHeader data-testid="DialogHeader__38a6c3">
            <DialogTitle data-testid="DialogTitle__38a6c3">{text.title}</DialogTitle>
          </DialogHeader>

          {step === STEP.DROPZONE && (
            <div className="flex flex-col gap-2">
              <ImportDropzone
                onFileSelected={handleFileSelected}
                formats={config.formats}
                labels={labels?.dropzone}
                data-testid="ImportDropzone__38a6c3" />
              <div className="flex flex-wrap items-center justify-center gap-3">
                {templateFormats.map((format) => (
                  <button
                    key={format}
                    type="button"
                    className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
                    onClick={() => downloadTemplate(format)}
                    data-testid={format === 'csv' ? 'ImportDialog__downloadTemplate' : `ImportDialog__downloadTemplate_${format}`}
                  >
                    {templateCaption(format)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === STEP.FILE_ERROR && (
            <ImportFileErrorDialog
              message={fileErrorMessage}
              onCancel={() => onOpenChange(false)}
              onRetry={handleRetryFile}
              labels={labels?.fileError}
              data-testid="ImportFileErrorDialog__38a6c3" />
          )}

          {step === STEP.MAPPING && (
            <div className="flex min-h-0 max-h-[70vh] min-w-0 flex-col gap-4">
              <ImportColumnMapping
                headers={headers}
                importFields={config.fields}
                mapping={mapping}
                onApplyMapping={handleApplyMapping}
                labels={labels?.mapping}
                fieldLabelFn={fieldLabelFn}
                data-testid="ImportColumnMapping__38a6c3" />
              <div className="relative flex min-h-0 flex-1 flex-col">
                {isRevalidating && (
                  <div
                    className="absolute inset-0 z-20 flex items-center justify-center bg-background/70"
                    data-testid="ImportDialog__revalidatingOverlay"
                  >
                    <span className="text-sm text-muted-foreground">{text.revalidating}</span>
                  </div>
                )}
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
                  onDownloadErrors={() => downloadCsv(buildErrorsCsv(entries, headers, mapping, labels?.reviewQueue?.statusError, labels?.reviewQueue?.skippedByUser), 'import-errors.csv')}
                  labels={labels?.reviewQueue}
                  simSearchFn={simSearchFn}
                  fieldLabelFn={fieldLabelFn}
                  token={token}
                  data-testid="ImportReviewQueue__38a6c3" />
              </div>
              <div className="flex justify-end">
                <Button
                  type="button"
                  onClick={() => setStep(STEP.CONFIRM)}
                  disabled={validCount === 0}
                  data-testid="ImportDialog__importButton"
                >
                  {text.importButton(validCount)}
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
              labels={labels?.confirm}
              data-testid="ImportConfirmStep__38a6c3" />
          )}

          {step === STEP.SENDING && <ImportProgressStep percent={progress} labels={labels?.progress} data-testid="ImportProgressStep__38a6c3" />}

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
                  onDownloadErrors={() => downloadCsv(buildErrorsCsv(entries, headers, mapping, labels?.reviewQueue?.statusError, labels?.reviewQueue?.skippedByUser), 'import-errors.csv')}
                  retryLabel={labels?.reviewQueue?.retry ?? 'Retry'}
                  labels={labels?.reviewQueue}
                  simSearchFn={simSearchFn}
                  fieldLabelFn={fieldLabelFn}
                  token={token}
                  data-testid="ImportReviewQueue__38a6c3" />
              )}
              <div className="flex justify-end">
                <Button
                  type="button"
                  onClick={handleSend}
                  disabled={validCount === 0}
                  data-testid="ImportDialog__importButton"
                >
                  {text.importButton(validCount)}
                </Button>
              </div>
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
        labels={labels?.systemError}
        data-testid="ImportSystemErrorDialog__38a6c3" />
      <ImportSendingCloseDialog
        // The `step` half is what dismisses the question on its own when the import finishes
        // while it is still on screen: there is nothing left to warn about, and leaving it up
        // would ask the user to decide about a send that already ended.
        open={pendingCloseWhileSending && step === STEP.SENDING}
        onKeepWatching={() => setPendingCloseWhileSending(false)}
        onCloseAnyway={closeAnyway}
        labels={labels?.sendingClose}
        data-testid="ImportSendingCloseDialog__38a6c3" />
    </>
  );
}
