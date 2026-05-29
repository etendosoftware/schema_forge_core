import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { ArrowLeft, Check, CheckCircle2, ExternalLink, FileText, Trash2, UploadCloud } from 'lucide-react';
import { useUI, useLocaleSwitch } from '@/i18n';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useStatementImport } from '@/hooks/useStatementImport';
import { useStatementPreview } from '@/hooks/useStatementPreview';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

function formatDate(iso, bcpLocale) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat(bcpLocale, {
    day: '2-digit', month: '2-digit', year: 'numeric',
  }).format(d);
}

function formatMoney(amount, currency, bcpLocale) {
  if (amount == null) return '—';
  try {
    return new Intl.NumberFormat(bcpLocale, {
      style: 'currency', currency,
      minimumFractionDigits: 2, maximumFractionDigits: 2,
    }).format(Number(amount));
  } catch {
    return `${Number(amount).toFixed(2)} ${currency}`;
  }
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Spinner — CSS-only ring rotating at constant speed (700ms per turn, no easing).
 * Width/height + border thickness are driven by `size` so the same component
 * works as a 20px standalone loader and as a 12px inline badge accent.
 *
 * The design handoff requires a pure CSS spinner (not `animate-spin`) because
 * the accent ring + tinted soft track only look right with custom border colors.
 */
function Spinner({ size = 20 }) {
  const border = size <= 12 ? 2 : 2.5;
  return (
    <span
      aria-hidden="true"
      className="imp-spin inline-block flex-none rounded-full align-middle"
      style={{
        width: size,
        height: size,
        border: `${border}px solid #FFF7E0`,
        borderTopColor: '#C28800',
      }}
    />
  );
}

/**
 * Local keyframes for the import-modal animations. Scoped via prefixed class
 * names so they don't collide with anything else in the bundle.
 *   - imp-rot:    spinner ring, 700ms linear infinite (constant speed)
 *   - imp-pop:    modal enter, 220ms ease-out (fade + 8px slide + .985 → 1)
 *   - imp-pop-in: success ✓ icon, 350ms ease-out (fade + .7 → 1)
 */
const ANIMATIONS_CSS = `
@keyframes imp-rot { to { transform: rotate(360deg); } }
@keyframes imp-pop { from { opacity: 0; transform: translateY(8px) scale(.985); } to { opacity: 1; transform: none; } }
@keyframes imp-pop-in { from { opacity: 0; transform: scale(.7); } to { opacity: 1; transform: none; } }
.imp-spin { animation: imp-rot .7s linear infinite; }
.imp-modal-enter { animation: imp-pop .22s cubic-bezier(.16,1,.3,1); }
.imp-pop-in { animation: imp-pop-in .35s cubic-bezier(.16,1,.3,1); }
`;

/**
 * Auto-animating progress bar. While `active` we step the width up gradually
 * (8 → 46 → 82 → 92) WITHOUT ever hitting 100%, so a slow backend can keep
 * showing animation without us lying about progress. When the parent flips
 * `active` to false (i.e. the real operation finished) we snap to 100%.
 *
 * Net effect: a fast backend shows a brief animation from 0 → 100; a slow
 * backend keeps the bar climbing while the user waits. No artificial delays.
 */
function ProgressBar({ active }) {
  const [pct, setPct] = useState(0);
  useEffect(() => {
    if (!active) {
      setPct(100);
      return undefined;
    }
    setPct(8);
    const t1 = setTimeout(() => setPct(46), 180);
    const t2 = setTimeout(() => setPct(82), 520);
    const t3 = setTimeout(() => setPct(92), 900);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [active]);

  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#F0F2F5]">
      <div
        className="h-full rounded-full bg-[#FFD500]"
        style={{ width: `${pct}%`, transition: 'width .25s ease' }}
      />
    </div>
  );
}

const FORMAT_LABEL = {
  C43: 'Cuaderno 43 (Norma 43)',
  GENERIC_CSV: 'CSV genérico',
};

// ─────────────────────────────────────────────────────────────────────────────
// Stepper
// ─────────────────────────────────────────────────────────────────────────────

function Stepper({ step, ui }) {
  // step index: 0 = upload, 1 = preview, 2 = done
  const items = [
    ui('financeAccountStatementsImportStep1'),
    ui('financeAccountStatementsImportStep2'),
    ui('financeAccountStatementsImportStep3'),
  ];
  return (
    <div className="flex items-center gap-2.5 px-6 pb-1 pt-4">
      {items.map((label, i) => {
        const isActive = step === i;
        const isDone = step > i;
        return (
          <div key={label} className="flex items-center gap-2.5">
            <div className={cn(
              'flex items-center gap-2 text-[12.5px] font-medium',
              isActive ? 'text-[#121217]' : isDone ? 'text-[#3F3F50]' : 'text-[#A8AAB8]',
            )}>
              <span
                className={cn(
                  'flex h-[22px] w-[22px] items-center justify-center rounded-full border-[1.5px] text-[11px] font-semibold',
                  isActive && 'border-[#FAD75A] bg-[#FFF7E0] text-[#7A5A00]',
                  isDone && 'border-transparent bg-[#EEFBF4] text-[#17663A]',
                  !isActive && !isDone && 'border-transparent bg-[#F0F2F5] text-[#6C6C89]',
                )}
              >
                {isDone ? <Check className="h-3 w-3" /> : i + 1}
              </span>
              <span>{label}</span>
            </div>
            {i < items.length - 1 ? (
              <span
                className={cn(
                  'h-[1.5px] w-16 rounded-sm',
                  isDone ? 'bg-[#C5F0D8]' : 'bg-[#E8EAEF]',
                )}
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Dropzone (Step 1)
// ─────────────────────────────────────────────────────────────────────────────

function Dropzone({ onPick, dragging, onDragOver, onDragLeave, onDrop, ui }) {
  return (
    <div
      tabIndex={0}
      onClick={onPick}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={cn(
        'cursor-pointer rounded-xl border-[1.5px] border-dashed px-6 py-10 text-center transition-colors',
        dragging
          ? 'border-[#FFD500] bg-[#FFF7E0]'
          : 'border-[#D1D4DB] bg-[#FAFBFC] hover:border-[#A8AAB8] hover:bg-[#F5F7F9]',
      )}
    >
      <div
        className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-xl bg-[#FFF7E0] text-[#C28800] shadow-[0_1px_2px_rgba(18,18,23,0.06)]"
        aria-hidden="true"
      >
        <UploadCloud className="h-[26px] w-[26px]" />
      </div>
      <div className="text-sm font-semibold text-[#121217]">
        {dragging ? (
          ui('financeAccountStatementsImportDropDrop')
        ) : (
          <>
            {ui('financeAccountStatementsImportDropTitlePrefix')}{' '}
            <em className="font-semibold not-italic text-[#C28800]">
              {ui('financeAccountStatementsImportDropTitleEm')}
            </em>
          </>
        )}
      </div>
      <div className="mt-1 text-xs text-[#6C6C89]">
        {ui('financeAccountStatementsImportDropHint')}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// File row (Step 1 — selected)
// ─────────────────────────────────────────────────────────────────────────────

function FileRow({ file, format, lineCount, analyzing, onRemove, ui }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-[#E8EAEF] bg-white p-3.5">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#FFF7E0] text-[#C28800]">
        <FileText className="h-5 w-5" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="truncate text-sm font-semibold text-[#121217]">{file.name}</div>
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-[#6C6C89]">
          <span>{formatBytes(file.size)}</span>
          <span className="h-1 w-1 rounded-full bg-[#D1D4DB]" />
          {analyzing ? (
            <span className="inline-flex items-center gap-1.5 font-medium text-[#7A5A00]">
              <Spinner size={12} />
              {ui('financeAccountStatementsImportDetecting')}
            </span>
          ) : (
            <>
              <span className="inline-flex items-center gap-1 rounded-full bg-[#EEFBF4] px-2 py-0.5 font-semibold text-[#17663A]">
                <Check className="h-3 w-3" />
                {FORMAT_LABEL[format] ?? format}
              </span>
              <span className="h-1 w-1 rounded-full bg-[#D1D4DB]" />
              <span>{ui('financeAccountStatementsImportLines', { count: lineCount })}</span>
            </>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={onRemove}
        aria-label={ui('financeAccountStatementsImportRemove')}
        className="flex h-8 w-8 items-center justify-center rounded-md text-[#6C6C89] hover:bg-[#F5F7F9] hover:text-[#121217]"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// KPI tiles (Step 2)
// ─────────────────────────────────────────────────────────────────────────────

function KpiTile({ label, value, tone }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-[#E8EAEF] bg-white px-3.5 py-3">
      <span className="text-[10.5px] font-semibold uppercase tracking-[.04em] text-[#6C6C89]">
        {label}
      </span>
      <span
        className={cn(
          'text-base font-semibold tabular-nums',
          tone === 'pos' && 'text-green-700',
          tone === 'neg' && 'text-red-700',
          tone === 'sm' && 'text-[13px] font-semibold leading-5',
          !tone && 'text-[#121217]',
        )}
      >
        {value}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Preview lines (Step 2)
// ─────────────────────────────────────────────────────────────────────────────

const PREV_GRID = 'grid grid-cols-[100px_minmax(180px,1fr)_120px_120px] gap-3 px-4';

function PreviewLines({ lines, max = 5, currency, bcpLocale, ui }) {
  const shown = lines.slice(0, max);
  const extra = Math.max(0, lines.length - max);
  return (
    <div className="overflow-hidden rounded-xl border border-[#E8EAEF]">
      <div
        className={cn(
          PREV_GRID,
          'h-10 items-center border-b border-[#E8EAEF] bg-[#FAFBFC] text-xs font-semibold uppercase tracking-[.04em] text-[#6C6C89]',
        )}
      >
        <span>{ui('financeAccountStatementLinesColDate')}</span>
        <span>{ui('financeAccountStatementsImportColConcept')}</span>
        <span className="text-right">{ui('financeAccountStatementsImportColCharge')}</span>
        <span className="text-right">{ui('financeAccountStatementsImportColCredit')}</span>
      </div>
      {shown.map((l) => {
        const cr = Number(l.cramount) || 0;
        const dr = Number(l.dramount) || 0;
        return (
          <div
            key={l.lineNo ?? `${l.date}-${l.description}`}
            className={cn(PREV_GRID, 'items-center border-b border-[#F0F2F5] py-3 text-sm last:border-0')}
          >
            <span className="whitespace-nowrap text-[#6C6C89]">{formatDate(l.date, bcpLocale)}</span>
            <div className="flex min-w-0 flex-col">
              <span className="truncate font-medium text-[#121217]">{l.description || '—'}</span>
              {l.bpartnerName ? (
                <span className="truncate text-xs text-[#6C6C89]">{l.bpartnerName}</span>
              ) : null}
            </div>
            <span className="text-right tabular-nums">
              {dr > 0
                ? <span className="font-semibold text-red-700">−{formatMoney(dr, currency, bcpLocale)}</span>
                : <span className="text-[#C1C3CC]">—</span>}
            </span>
            <span className="text-right tabular-nums">
              {cr > 0
                ? <span className="font-semibold text-green-700">+{formatMoney(cr, currency, bcpLocale)}</span>
                : <span className="text-[#C1C3CC]">—</span>}
            </span>
          </div>
        );
      })}
      {extra > 0 ? (
        <div className="border-t border-[#E8EAEF] bg-[#FAFBFC] py-2.5 text-center text-xs text-[#6C6C89]">
          {ui('financeAccountStatementsImportMoreLines', { count: extra })}
        </div>
      ) : null}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main modal — orchestrates Upload → Preview → Done
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Multi-step "Importar extracto bancario" dialog. Flow:
 *   1. User picks a file → we POST to ?action=preview which parses in-memory
 *      and returns lines + totals + detected format (C43 / CSV).
 *   2. We show the preview (KPIs + lines table); the user confirms.
 *   3. We POST to ?action=import which actually persists the statement,
 *      lines and processes the statement. Reload list on success.
 *
 * Props:
 *   open, accountId, accountCurrency: 'EUR'|..., onClose, onSuccess, onOpenStatement?
 */
export function ImportStatementModal({
  open,
  accountId,
  accountCurrency = 'EUR',
  onClose,
  onSuccess,
  onOpenStatement,
}) {
  const ui = useUI();
  const { locale: appLocale } = useLocaleSwitch();
  const bcpLocale = (appLocale || 'es_ES').replace('_', '-');
  const inputRef = useRef(null);

  const { previewStatement, previewing } = useStatementPreview();
  const { importStatement, importing } = useStatementImport();

  // view: empty | analyzing | selected | preview | importing | success | error
  const [view, setView] = useState('empty');
  const [file, setFile] = useState(null);
  const [previewData, setPreviewData] = useState(null);
  const [importResult, setImportResult] = useState(null);
  const [dragging, setDragging] = useState(false);

  const reset = () => {
    setFile(null);
    setPreviewData(null);
    setImportResult(null);
    setView('empty');
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const stepIndex = view === 'success' ? 2
                  : view === 'preview' || view === 'importing' ? 1
                  : 0;

  const handlePickFile = async (selected) => {
    if (!selected) return;
    setFile(selected);
    setView('analyzing');
    try {
      const contentBase64 = await fileToBase64(selected);
      const data = await previewStatement({ accountId, fileName: selected.name, contentBase64 });
      setPreviewData(data);
      setView('selected');
    } catch {
      setView('error');
    }
  };

  const handleContinue = () => {
    if (!previewData) return;
    setView('preview');
  };

  const handleConfirmImport = async () => {
    if (!file || !previewData) return;
    setView('importing');
    try {
      const contentBase64 = await fileToBase64(file);
      const res = await importStatement({ accountId, fileName: file.name, contentBase64 });
      setImportResult(res);
      setView('success');
      onSuccess?.();
    } catch {
      setView('error');
      toast.error(ui('financeAccountStatementsImportError'));
    }
  };

  const handleOpenStatement = () => {
    if (importResult?.id) onOpenStatement?.(importResult.id);
    handleClose();
  };

  const totalIn = Number(previewData?.totalIn) || 0;
  const totalOut = Number(previewData?.totalOut) || 0;
  const wide = view === 'preview' || view === 'importing';

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent
        className={cn(
          'imp-modal-enter overflow-hidden p-0',
          wide ? 'max-w-[720px]' : 'max-w-[600px]',
        )}
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        {/* Scoped keyframes for the import-modal animations */}
        <style>{ANIMATIONS_CSS}</style>

        {/* Header */}
        <div className="flex items-start gap-4 px-6 pt-6">
          <div className="flex-1">
            <h2 className="text-lg font-semibold leading-6 text-[#121217]">
              {ui('financeAccountStatementsImportTitle')}
            </h2>
            <p className="mt-1 text-[13px] leading-[19px] text-[#6C6C89]">
              {view === 'success'
                ? ui('financeAccountStatementsImportSubtitleDone')
                : view === 'preview' || view === 'importing'
                  ? ui('financeAccountStatementsImportSubtitleReview')
                  : ui('financeAccountStatementsImportSubtitleUpload')}
            </p>
          </div>
          {/* DialogContent already renders a built-in close (X) button in the
              top-right corner, so we don't add another one here. */}
        </div>

        {/* Stepper — hidden on success per the design */}
        {view !== 'success' ? <Stepper step={stepIndex} ui={ui} /> : null}

        {/* Body */}
        <div className="px-6 py-4">
          {view === 'empty' || view === 'error' ? (
            <>
              <input
                ref={inputRef}
                type="file"
                accept=".c43,.43,.txt,.nor,.csv,text/csv,text/plain"
                className="sr-only"
                onChange={(e) => handlePickFile(e.target.files?.[0])}
              />
              <Dropzone
                ui={ui}
                dragging={dragging}
                onPick={() => inputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragging(false);
                  const dropped = e.dataTransfer?.files?.[0];
                  if (dropped) handlePickFile(dropped);
                }}
              />
              {view === 'error' ? (
                <div className="mt-3 rounded-lg border border-[#FAD9D9] bg-[#FEF0F4] p-3 text-sm text-[#9A1B1B]">
                  {ui('financeAccountStatementsImportErrorBody')}
                </div>
              ) : null}
            </>
          ) : null}

          {(view === 'analyzing' || view === 'selected') && file ? (
            <div className="flex flex-col gap-3">
              <FileRow
                file={file}
                format={previewData?.format}
                lineCount={previewData?.lineCount ?? 0}
                analyzing={view === 'analyzing' || previewing}
                onRemove={view === 'analyzing' ? undefined : reset}
                ui={ui}
              />
              {view === 'analyzing' ? (
                <div className="flex flex-col gap-3 rounded-xl border border-[#E8EAEF] bg-[#FAFBFC] p-4">
                  <div className="flex items-center gap-3 text-sm text-[#3F3F50]">
                    <Spinner size={20} />
                    <span>{ui('financeAccountStatementsImportAnalyzing')}</span>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {view === 'preview' && previewData ? (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <KpiTile
                  label={ui('financeAccountStatementsImportKpiLines')}
                  value={previewData.lineCount}
                />
                <KpiTile
                  label={ui('financeAccountStatementsImportKpiCredits')}
                  value={`+${formatMoney(totalIn, accountCurrency, bcpLocale)}`}
                  tone="pos"
                />
                <KpiTile
                  label={ui('financeAccountStatementsImportKpiDebits')}
                  value={`−${formatMoney(totalOut, accountCurrency, bcpLocale)}`}
                  tone="neg"
                />
                <KpiTile
                  label={ui('financeAccountStatementsImportKpiPeriod')}
                  value={
                    previewData.periodFrom === previewData.periodTo
                      ? formatDate(previewData.periodFrom, bcpLocale)
                      : `${formatDate(previewData.periodFrom, bcpLocale)} – ${formatDate(previewData.periodTo, bcpLocale)}`
                  }
                  tone="sm"
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-[#121217]">
                  {ui('financeAccountStatementsImportLinesDetected')}
                </span>
                <span className="text-xs text-[#6C6C89]">
                  {FORMAT_LABEL[previewData.format] ?? previewData.format}
                </span>
              </div>
              <PreviewLines
                lines={previewData.lines ?? []}
                currency={accountCurrency}
                bcpLocale={bcpLocale}
                ui={ui}
              />
            </div>
          ) : null}

          {view === 'importing' ? (
            <div className="flex flex-col gap-3 rounded-xl border border-[#E8EAEF] bg-[#FAFBFC] p-4">
              <div className="flex items-center gap-3 text-sm text-[#3F3F50]">
                <Spinner size={20} />
                <span>
                  {ui('financeAccountStatementsImportImporting', {
                    count: previewData?.lineCount ?? 0,
                  })}
                </span>
              </div>
              <ProgressBar active />
            </div>
          ) : null}

          {view === 'success' ? (
            <div className="flex flex-col items-center gap-3 py-2 text-center">
              <div className="imp-pop-in flex h-14 w-14 items-center justify-center rounded-full bg-[#EEFBF4] text-[#17663A]">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <h3 className="text-base font-semibold text-[#121217]">
                {ui('financeAccountStatementsImportSuccessTitle')}
              </h3>
              <p className="max-w-md text-sm text-[#6C6C89]">
                {ui('financeAccountStatementsImportSuccessBody', {
                  count: previewData?.lineCount ?? importResult?.lineCount ?? 0,
                })}
              </p>
              <div className="mt-2 flex w-full max-w-md items-center justify-between gap-4 rounded-xl border border-[#E8EAEF] bg-[#FAFBFC] px-4 py-3">
                <div className="flex flex-col items-start">
                  <span className="text-[10.5px] font-semibold uppercase tracking-[.04em] text-[#6C6C89]">
                    {ui('financeAccountStatementsImportKpiLines')}
                  </span>
                  <span className="text-sm font-semibold text-[#121217]">
                    {previewData?.lineCount ?? importResult?.lineCount ?? 0}
                  </span>
                </div>
                <span className="h-8 w-px bg-[#E8EAEF]" />
                <div className="flex flex-col items-start">
                  <span className="text-[10.5px] font-semibold uppercase tracking-[.04em] text-[#6C6C89]">
                    {ui('financeAccountStatementsImportKpiCredits')}
                  </span>
                  <span className="text-sm font-semibold text-green-700">
                    +{formatMoney(totalIn, accountCurrency, bcpLocale)}
                  </span>
                </div>
                <span className="h-8 w-px bg-[#E8EAEF]" />
                <div className="flex flex-col items-start">
                  <span className="text-[10.5px] font-semibold uppercase tracking-[.04em] text-[#6C6C89]">
                    {ui('financeAccountStatementsImportKpiPeriod')}
                  </span>
                  <span className="text-[13px] font-semibold text-[#121217]">
                    {previewData?.periodFrom === previewData?.periodTo
                      ? formatDate(previewData?.periodFrom, bcpLocale)
                      : `${formatDate(previewData?.periodFrom, bcpLocale)} – ${formatDate(previewData?.periodTo, bcpLocale)}`}
                  </span>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-[#E8EAEF] px-6 py-4">
          {view === 'preview' ? (
            <button
              type="button"
              onClick={() => setView('selected')}
              className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-[#D1D4DB] bg-white px-3 text-sm font-medium text-[#121217] hover:bg-[#F5F7F9]"
            >
              <ArrowLeft className="h-4 w-4" />
              {ui('financeAccountStatementsImportBack')}
            </button>
          ) : <span />}

          <div className="ml-auto flex items-center gap-2">
            {view === 'success' ? (
              <>
                <button
                  type="button"
                  onClick={handleClose}
                  className="inline-flex h-10 items-center rounded-lg border border-[#D1D4DB] bg-white px-3 text-sm font-medium text-[#121217] hover:bg-[#F5F7F9]"
                >
                  {ui('financeAccountStatementsImportCloseBtn')}
                </button>
                {onOpenStatement && importResult?.id ? (
                  <button
                    type="button"
                    onClick={handleOpenStatement}
                    className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-[#FFD500] px-3 text-sm font-semibold text-[#121217] hover:bg-[#F8D414]"
                  >
                    <ExternalLink className="h-4 w-4" />
                    {ui('financeAccountStatementsImportViewStatement')}
                  </button>
                ) : null}
              </>
            ) : view === 'preview' ? (
              <button
                type="button"
                onClick={handleConfirmImport}
                disabled={importing}
                className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-[#121217] px-3 text-sm font-medium text-white hover:bg-[#FFD500] hover:text-[#121217] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Check className="h-4 w-4" />
                {ui('financeAccountStatementsImportConfirm', {
                  count: previewData?.lineCount ?? 0,
                })}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handleClose}
                  className="inline-flex h-10 items-center rounded-lg border border-[#D1D4DB] bg-white px-3 text-sm font-medium text-[#121217] hover:bg-[#F5F7F9]"
                >
                  {ui('financeAccountStatementsImportCancel')}
                </button>
                <button
                  type="button"
                  onClick={handleContinue}
                  disabled={view !== 'selected' || previewing}
                  className="inline-flex h-10 items-center rounded-lg bg-[#121217] px-3 text-sm font-medium text-white hover:bg-[#FFD500] hover:text-[#121217] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {ui('financeAccountStatementsImportContinue')}
                </button>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
