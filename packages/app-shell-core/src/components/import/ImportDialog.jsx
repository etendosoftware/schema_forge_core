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
import { decodeCsvBuffer, parseDelimited } from '../../lib/import/parseDelimited.js';
import { mapColumns } from '../../lib/import/mapColumns.js';
import { dedupeRows } from '../../lib/import/dedupeRows.js';
import { resolveForeignKeys } from '../../lib/import/resolveForeignKeys.js';
import { validateRow } from '../../lib/import/validateRows.js';
import { buildOperations } from '../../lib/import/buildOperations.js';
import { runImport, sendRow } from '../../lib/import/importEngine.js';

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
  // Two independent toggles, not one shared boolean — the design spec is explicit that
  // the preview (pre-send) and result (post-send) review queues each remember their own
  // filter state.
  const [showOnlyErrorsPreSend, setShowOnlyErrorsPreSend] = useState(true);
  const [showOnlyErrorsPostSend, setShowOnlyErrorsPostSend] = useState(true);
  const [progress, setProgress] = useState(0);

  const requiredTargets = useMemo(() => config.fields.filter((f) => f.required).map((f) => f.target), [config.fields]);
  const emailTargets = useMemo(() => config.fields.filter((f) => f.isEmail).map((f) => f.target), [config.fields]);
  const fkColumns = useMemo(() => config.fields.filter((f) => f.isForeignKey).map((f) => ({ target: f.target, matchEntity: f.matchEntity, qtyResults: f.qtyResults })), [config.fields]);
  const fkTargets = useMemo(() => fkColumns.map((c) => c.target), [fkColumns]);
  // buildOperations (engine) expects { spec, entity, targets: string[], descriptorName? } —
  // config carries `fields` (full descriptor objects, needed by the mapping/validation
  // steps above), so the operations-builder config is derived here rather than passing
  // `config` straight through, which would silently build an empty body.
  const operationsConfig = useMemo(() => ({
    spec: config.spec,
    entity: config.entity,
    descriptorName: config.descriptorName,
    targets: config.fields.map((f) => f.target),
  }), [config.spec, config.entity, config.descriptorName, config.fields]);

  const runValidation = useCallback(async (mappedRows) => {
    const { uniqueRows, duplicates } = dedupeRows(mappedRows, config.dedupeKeyTargets || []);
    const fkResolutions = fkColumns.length > 0
      ? await resolveForeignKeys({ rows: uniqueRows, columns: fkColumns, simSearchFn, token })
      : new Map();
    const validated = uniqueRows.map((row) => ({
      row,
      ...validateRow(row, { requiredTargets, emailTargets, fkTargets, fkResolutions }),
      status: 'pending',
    }));
    const skippedDuplicates = duplicates.map((d) => ({ row: d.row, errors: [{ target: '', message: 'Duplicate row (already in file).' }], status: 'skipped' }));
    setEntries([...validated.map((v) => ({ row: v.row, errors: v.errors, status: 'pending' })), ...skippedDuplicates]);
  }, [config.dedupeKeyTargets, fkColumns, fkTargets, requiredTargets, emailTargets, simSearchFn, token]);

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

  const handleEditField = useCallback((index, targetField, value) => {
    setEntries((prev) => {
      const next = [...prev];
      const row = { ...next[index].row, [targetField]: value };
      const { valid, errors } = validateRow(row, { requiredTargets, emailTargets, fkTargets, fkResolutions: new Map() });
      next[index] = { ...next[index], row, errors: valid ? [] : errors };
      return next;
    });
  }, [requiredTargets, emailTargets, fkTargets]);

  const handleRetryEntryPreSend = useCallback((index) => {
    setEntries((prev) => {
      const next = [...prev];
      const { valid, errors } = validateRow(next[index].row, { requiredTargets, emailTargets, fkTargets, fkResolutions: new Map() });
      next[index] = { ...next[index], errors: valid ? [] : errors };
      return next;
    });
  }, [requiredTargets, emailTargets, fkTargets]);

  const handleSkipEntry = useCallback((index) => {
    setEntries((prev) => prev.map((e, i) => (i === index ? { ...e, status: 'skipped' } : e)));
  }, []);

  const validCount = entries.filter((e) => e.status === 'pending' && e.errors.length === 0).length;
  const skipCount = entries.length - validCount;

  const handleSend = useCallback(async () => {
    setStep(STEP.SENDING);
    setProgress(0);
    const toSend = entries.filter((e) => e.status === 'pending' && e.errors.length === 0);
    const { results } = await runImport(toSend.map((e) => e.row), {
      buildRowOperations: (row) => buildOperations(row, operationsConfig),
      postBatch,
      concurrency: config.concurrency,
      maxRows: config.maxRows,
      onProgress: (completed, total) => setProgress(Math.round((completed / total) * 100)),
    });
    const okCount = results.filter((r) => r.status === 'ok').length;
    const resultEntries = results
      .filter((r) => r.status !== 'ok')
      .map((r) => ({ row: r.row, errors: [{ target: '', message: r.error?.message || 'Unknown error' }], status: 'pending' }));
    setEntries(resultEntries);
    setStep(STEP.RESULT);
    onImported(okCount);
    if (okCount > 0) toast.success(`${okCount} records imported successfully`);
  }, [entries, operationsConfig, config.concurrency, config.maxRows, postBatch, onImported]);

  const handleRetryEntryPostSend = useCallback(async (index) => {
    const entry = entries[index];
    const result = await sendRow(buildOperations(entry.row, operationsConfig), { postBatch });
    setEntries((prev) => {
      const next = [...prev];
      if (result.status === 'ok') {
        next.splice(index, 1);
      } else {
        next[index] = { ...next[index], errors: [{ target: '', message: result.error?.message || 'Unknown error' }] };
      }
      return next;
    });
  }, [entries, operationsConfig, postBatch]);

  const handleRetryFile = useCallback(() => {
    setFileErrorMessage(null);
    setStep(STEP.DROPZONE);
  }, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{text.title}</DialogTitle>
        </DialogHeader>

        {step === STEP.DROPZONE && <ImportDropzone onFileSelected={handleFileSelected} />}

        {step === STEP.FILE_ERROR && (
          <ImportFileErrorDialog message={fileErrorMessage} onCancel={() => onOpenChange(false)} onRetry={handleRetryFile} />
        )}

        {step === STEP.MAPPING && (
          <div className="flex flex-col gap-4">
            <ImportColumnMapping headers={headers} importFields={config.fields} mapping={mapping} onMappingChange={handleMappingChange} />
            <ImportReviewQueue
              entries={entries}
              fields={config.fields}
              showOnlyErrors={showOnlyErrorsPreSend}
              onToggleFilter={() => setShowOnlyErrorsPreSend((v) => !v)}
              onEditField={handleEditField}
              onRetryEntry={handleRetryEntryPreSend}
              onSkipEntry={handleSkipEntry}
              onDownloadErrors={() => downloadCsv(buildErrorsCsv(entries), 'import-errors.csv')}
              retryLabel="Re-validate"
            />
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
          <ImportConfirmStep importCount={validCount} skipCount={skipCount} onCancel={() => setStep(STEP.MAPPING)} onConfirm={handleSend} />
        )}

        {step === STEP.SENDING && <ImportProgressStep percent={progress} />}

        {step === STEP.RESULT && (
          <div className="flex flex-col gap-4">
            {entries.length > 0 && (
              <ImportReviewQueue
                entries={entries}
                fields={config.fields}
                showOnlyErrors={showOnlyErrorsPostSend}
                onToggleFilter={() => setShowOnlyErrorsPostSend((v) => !v)}
                onEditField={handleEditField}
                onRetryEntry={handleRetryEntryPostSend}
                onSkipEntry={handleSkipEntry}
                onDownloadErrors={() => downloadCsv(buildErrorsCsv(entries), 'import-errors.csv')}
                retryLabel="Retry"
              />
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
