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
 * (8 → 46 → 82 → 92) WITHOUT ever hitting 100%; when `active` flips false we
 * snap to 100%.
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

// view → stepper index (0=upload, 1=review, 2=done)
const VIEW_TO_STEP = {
  empty:     0,
  analyzing: 0,
  selected:  0,
  error:     0,
  preview:   1,
  importing: 1,
  success:   2,
};

// view → subtitle i18n key. Values are i18n KEYS resolved via ui(...) at render;
// the `error` view name collides with a scanned property name, so allowlist it.
// i18n-allowlist: ["financeAccountStatementsImportSubtitleUpload"]
const VIEW_TO_SUBTITLE_KEY = {
  empty:     'financeAccountStatementsImportSubtitleUpload',
  analyzing: 'financeAccountStatementsImportSubtitleUpload',
  selected:  'financeAccountStatementsImportSubtitleUpload',
  error:     'financeAccountStatementsImportSubtitleUpload',
  preview:   'financeAccountStatementsImportSubtitleReview',
  importing: 'financeAccountStatementsImportSubtitleReview',
  success:   'financeAccountStatementsImportSubtitleDone',
};

function formatPeriod(from, to, bcpLocale) {
  if (from === to) return formatDate(from, bcpLocale);
  return `${formatDate(from, bcpLocale)} – ${formatDate(to, bcpLocale)}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Stepper
// ─────────────────────────────────────────────────────────────────────────────

function Stepper({ step, ui }) {
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
            <StepperItem
              label={label}
              isActive={isActive}
              isDone={isDone}
              index={i}
              data-testid="StepperItem__de9647" />
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

function StepperItem({ label, isActive, isDone, index }) {
  let textClass = 'text-[#A8AAB8]';
  if (isActive) textClass = 'text-[#121217]';
  else if (isDone) textClass = 'text-[#3F3F50]';

  let badgeClass = 'border-transparent bg-[#F0F2F5] text-[#6C6C89]';
  if (isActive) badgeClass = 'border-[#FAD75A] bg-[#FFF7E0] text-[#7A5A00]';
  else if (isDone) badgeClass = 'border-transparent bg-[#EEFBF4] text-[#17663A]';

  return (
    <div className={cn('flex items-center gap-2 text-[12.5px] font-medium', textClass)}>
      <span
        className={cn(
          'flex h-[22px] w-[22px] items-center justify-center rounded-full border-[1.5px] text-[11px] font-semibold',
          badgeClass,
        )}
      >
        {isDone ? <Check className="h-3 w-3" data-testid="Check__de9647" /> : index + 1}
      </span>
      <span>{label}</span>
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
        <UploadCloud className="h-[26px] w-[26px]" data-testid="UploadCloud__de9647" />
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
        <FileText className="h-5 w-5" data-testid="FileText__de9647" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="truncate text-sm font-semibold text-[#121217]">{file.name}</div>
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-[#6C6C89]">
          <span>{formatBytes(file.size)}</span>
          <span className="h-1 w-1 rounded-full bg-[#D1D4DB]" />
          {analyzing ? (
            <span className="inline-flex items-center gap-1.5 font-medium text-[#7A5A00]">
              <Spinner size={12} data-testid="Spinner__de9647" />
              {ui('financeAccountStatementsImportDetecting')}
            </span>
          ) : (
            <>
              <span className="inline-flex items-center gap-1 rounded-full bg-[#EEFBF4] px-2 py-0.5 font-semibold text-[#17663A]">
                <Check className="h-3 w-3" data-testid="Check__de9647" />
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
        className="flex h-8 w-8 items-center justify-center rounded-full text-[#6C6C89] transition-colors hover:bg-[#FEF0F4] hover:text-[#9A1B1B]"
      >
        <Trash2 className="h-4 w-4" data-testid="Trash2__de9647" />
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

function AmountCell({ value, sign, toneClass, currency, bcpLocale }) {
  if (value > 0) {
    return <span className={toneClass}>{sign}{formatMoney(value, currency, bcpLocale)}</span>;
  }
  return <span className="text-[#C1C3CC]">—</span>;
}

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
              <AmountCell
                value={dr}
                sign="−"
                toneClass="font-semibold text-red-700"
                currency={currency}
                bcpLocale={bcpLocale}
                data-testid="AmountCell__de9647" />
            </span>
            <span className="text-right tabular-nums">
              <AmountCell
                value={cr}
                sign="+"
                toneClass="font-semibold text-green-700"
                currency={currency}
                bcpLocale={bcpLocale}
                data-testid="AmountCell__de9647" />
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
// Body subcomponents (one per view) — extracted to keep the main render's
// cognitive complexity below Sonar's threshold.
// ─────────────────────────────────────────────────────────────────────────────

function EmptyOrErrorBody({ view, ui, inputRef, dragging, setDragging, handlePickFile }) {
  return (
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
        data-testid="Dropzone__de9647" />
      {view === 'error' ? (
        <div className="mt-3 rounded-lg border border-[#FAD9D9] bg-[#FEF0F4] p-3 text-sm text-[#9A1B1B]">
          {ui('financeAccountStatementsImportErrorBody')}
        </div>
      ) : null}
    </>
  );
}

function AnalyzingOrSelectedBody({ view, file, previewData, previewing, reset, ui }) {
  return (
    <div className="flex flex-col gap-3">
      <FileRow
        file={file}
        format={previewData?.format}
        lineCount={previewData?.lineCount ?? 0}
        analyzing={view === 'analyzing' || previewing}
        onRemove={view === 'analyzing' ? undefined : reset}
        ui={ui}
        data-testid="FileRow__de9647" />
      {view === 'analyzing' ? (
        <div className="flex flex-col gap-3 rounded-xl border border-[#E8EAEF] bg-[#FAFBFC] p-4">
          <div className="flex items-center gap-3 text-sm text-[#3F3F50]">
            <Spinner size={20} data-testid="Spinner__de9647" />
            <span>{ui('financeAccountStatementsImportAnalyzing')}</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function PreviewBody({ previewData, totalIn, totalOut, accountCurrency, bcpLocale, ui }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiTile
          label={ui('financeAccountStatementsImportKpiLines')}
          value={previewData.lineCount}
          data-testid="KpiTile__de9647" />
        <KpiTile
          label={ui('financeAccountStatementsImportKpiCredits')}
          value={`+${formatMoney(totalIn, accountCurrency, bcpLocale)}`}
          tone="pos"
          data-testid="KpiTile__de9647" />
        <KpiTile
          label={ui('financeAccountStatementsImportKpiDebits')}
          value={`−${formatMoney(totalOut, accountCurrency, bcpLocale)}`}
          tone="neg"
          data-testid="KpiTile__de9647" />
        <KpiTile
          label={ui('financeAccountStatementsImportKpiPeriod')}
          value={formatPeriod(previewData.periodFrom, previewData.periodTo, bcpLocale)}
          tone="sm"
          data-testid="KpiTile__de9647" />
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
        data-testid="PreviewLines__de9647" />
    </div>
  );
}

function ImportingBody({ previewData, ui }) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-[#E8EAEF] bg-[#FAFBFC] p-4">
      <div className="flex items-center gap-3 text-sm text-[#3F3F50]">
        <Spinner size={20} data-testid="Spinner__de9647" />
        <span>
          {ui('financeAccountStatementsImportImporting', {
            count: previewData?.lineCount ?? 0,
          })}
        </span>
      </div>
      <ProgressBar active data-testid="ProgressBar__de9647" />
    </div>
  );
}

function SuccessBody({ previewData, importResult, totalIn, accountCurrency, bcpLocale, ui }) {
  const lineCount = previewData?.lineCount ?? importResult?.lineCount ?? 0;
  return (
    <div className="flex flex-col items-center gap-3 py-2 text-center">
      <div className="imp-pop-in flex h-14 w-14 items-center justify-center rounded-full bg-[#EEFBF4] text-[#17663A]">
        <CheckCircle2 className="h-8 w-8" data-testid="CheckCircle2__de9647" />
      </div>
      <h3 className="text-base font-semibold text-[#121217]">
        {ui('financeAccountStatementsImportSuccessTitle')}
      </h3>
      <p className="max-w-md text-sm text-[#6C6C89]">
        {ui('financeAccountStatementsImportSuccessBody', { count: lineCount })}
      </p>
      <div className="mt-2 flex w-full max-w-md items-center justify-between gap-4 rounded-xl border border-[#E8EAEF] bg-[#FAFBFC] px-4 py-3">
        <SuccessKpi
          label={ui('financeAccountStatementsImportKpiLines')}
          value={lineCount}
          data-testid="SuccessKpi__de9647" />
        <span className="h-8 w-px bg-[#E8EAEF]" />
        <SuccessKpi
          label={ui('financeAccountStatementsImportKpiCredits')}
          value={`+${formatMoney(totalIn, accountCurrency, bcpLocale)}`}
          valueClass="text-green-700"
          data-testid="SuccessKpi__de9647" />
        <span className="h-8 w-px bg-[#E8EAEF]" />
        <SuccessKpi
          label={ui('financeAccountStatementsImportKpiPeriod')}
          value={formatPeriod(previewData?.periodFrom, previewData?.periodTo, bcpLocale)}
          valueClass="text-[13px] text-[#121217]"
          data-testid="SuccessKpi__de9647" />
      </div>
    </div>
  );
}

function SuccessKpi({ label, value, valueClass = 'text-[#121217]' }) {
  return (
    <div className="flex flex-col items-start">
      <span className="text-[10.5px] font-semibold uppercase tracking-[.04em] text-[#6C6C89]">
        {label}
      </span>
      <span className={cn('text-sm font-semibold', valueClass)}>
        {value}
      </span>
    </div>
  );
}

/**
 * Renders the body slot based on the current view. Keeps the main modal's
 * cognitive complexity below Sonar's S3776 threshold by encapsulating each
 * branch behind a small helper.
 */
function ModalBody({
  view, file, previewData, importResult, previewing, totalIn, totalOut,
  accountCurrency, bcpLocale, ui, inputRef, dragging, setDragging, handlePickFile, reset,
}) {
  if (view === 'empty' || view === 'error') {
    return (
      <EmptyOrErrorBody
        view={view}
        ui={ui}
        inputRef={inputRef}
        dragging={dragging}
        setDragging={setDragging}
        handlePickFile={handlePickFile}
        data-testid="EmptyOrErrorBody__de9647" />
    );
  }
  if ((view === 'analyzing' || view === 'selected') && file) {
    return (
      <AnalyzingOrSelectedBody
        view={view}
        file={file}
        previewData={previewData}
        previewing={previewing}
        reset={reset}
        ui={ui}
        data-testid="AnalyzingOrSelectedBody__de9647" />
    );
  }
  if (view === 'preview' && previewData) {
    return (
      <PreviewBody
        previewData={previewData}
        totalIn={totalIn}
        totalOut={totalOut}
        accountCurrency={accountCurrency}
        bcpLocale={bcpLocale}
        ui={ui}
        data-testid="PreviewBody__de9647" />
    );
  }
  if (view === 'importing') {
    return <ImportingBody previewData={previewData} ui={ui} data-testid="ImportingBody__de9647" />;
  }
  if (view === 'success') {
    return (
      <SuccessBody
        previewData={previewData}
        importResult={importResult}
        totalIn={totalIn}
        accountCurrency={accountCurrency}
        bcpLocale={bcpLocale}
        ui={ui}
        data-testid="SuccessBody__de9647" />
    );
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Footer per view
// ─────────────────────────────────────────────────────────────────────────────

function SuccessFooterButtons({ ui, importResult, onOpenStatement, handleClose, handleOpenStatement }) {
  return (
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
          <ExternalLink className="h-4 w-4" data-testid="ExternalLink__de9647" />
          {ui('financeAccountStatementsImportViewStatement')}
        </button>
      ) : null}
    </>
  );
}

function PreviewFooterButton({ ui, importing, previewData, handleConfirmImport }) {
  return (
    <button
      type="button"
      onClick={handleConfirmImport}
      disabled={importing}
      className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-[#121217] px-3 text-sm font-medium text-white hover:bg-[#FFD500] hover:text-[#121217] disabled:cursor-not-allowed disabled:opacity-50"
    >
      <Check className="h-4 w-4" data-testid="Check__de9647" />
      {ui('financeAccountStatementsImportConfirm', {
        count: previewData?.lineCount ?? 0,
      })}
    </button>
  );
}

function DefaultFooterButtons({ ui, view, previewing, handleClose, handleContinue }) {
  return (
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
  );
}

function ModalFooter({
  view, ui, importing, importResult, previewing, previewData, onOpenStatement,
  setView, handleClose, handleConfirmImport, handleContinue, handleOpenStatement,
}) {
  let rightButtons;
  if (view === 'success') {
    rightButtons = (
      <SuccessFooterButtons
        ui={ui}
        importResult={importResult}
        onOpenStatement={onOpenStatement}
        handleClose={handleClose}
        handleOpenStatement={handleOpenStatement}
        data-testid="SuccessFooterButtons__de9647" />
    );
  } else if (view === 'preview') {
    rightButtons = (
      <PreviewFooterButton
        ui={ui}
        importing={importing}
        previewData={previewData}
        handleConfirmImport={handleConfirmImport}
        data-testid="PreviewFooterButton__de9647" />
    );
  } else {
    rightButtons = (
      <DefaultFooterButtons
        ui={ui}
        view={view}
        previewing={previewing}
        handleClose={handleClose}
        handleContinue={handleContinue}
        data-testid="DefaultFooterButtons__de9647" />
    );
  }

  return (
    <div className="flex items-center justify-between px-6 py-4">
      {view === 'preview' ? (
        <button
          type="button"
          onClick={() => setView('selected')}
          className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-[#D1D4DB] bg-white px-3 text-sm font-medium text-[#121217] hover:bg-[#F5F7F9]"
        >
          <ArrowLeft className="h-4 w-4" data-testid="ArrowLeft__de9647" />
          {ui('financeAccountStatementsImportBack')}
        </button>
      ) : <span />}
      <div className="ml-auto flex items-center gap-2">
        {rightButtons}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main modal — orchestrates Upload → Preview → Done
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Multi-step "Importar extracto bancario" dialog. Flow:
 *   1. User picks a file → POST ?action=preview (parses in-memory, returns
 *      lines + totals + detected format).
 *   2. Show the preview (KPIs + lines table); user confirms.
 *   3. POST ?action=import which actually persists the statement.
 *
 * Props:
 *   open, accountId, accountCurrency, onClose, onSuccess, onOpenStatement?
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

  const stepIndex = VIEW_TO_STEP[view] ?? 0;

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
    <Dialog
      open={open}
      onOpenChange={(v) => { if (!v) handleClose(); }}
      data-testid="Dialog__de9647">
      <DialogContent
        className={cn(
          'imp-modal-enter overflow-hidden p-0',
          wide ? 'max-w-[720px]' : 'max-w-[600px]',
        )}
        style={{ background: 'var(--surface-overlay, #FFFFFF)' }}
        onPointerDownOutside={(e) => e.preventDefault()}
        data-testid="DialogContent__de9647">
        <style>{ANIMATIONS_CSS}</style>

        {/* Header */}
        <div className="flex items-start gap-4 px-6 pt-6">
          <div className="flex-1">
            <h2 className="text-lg font-semibold leading-6 text-[#121217]">
              {ui('financeAccountStatementsImportTitle')}
            </h2>
            <p className="mt-1 text-[13px] leading-[19px] text-[#6C6C89]">
              {ui(VIEW_TO_SUBTITLE_KEY[view] ?? VIEW_TO_SUBTITLE_KEY.empty)}
            </p>
          </div>
        </div>

        {/* Stepper — hidden on success per the design */}
        {view !== 'success' ? <Stepper step={stepIndex} ui={ui} data-testid="Stepper__de9647" /> : null}

        {/* Body */}
        <div className="px-6 py-4">
          <ModalBody
            view={view}
            file={file}
            previewData={previewData}
            importResult={importResult}
            previewing={previewing}
            totalIn={totalIn}
            totalOut={totalOut}
            accountCurrency={accountCurrency}
            bcpLocale={bcpLocale}
            ui={ui}
            inputRef={inputRef}
            dragging={dragging}
            setDragging={setDragging}
            handlePickFile={handlePickFile}
            reset={reset}
            data-testid="ModalBody__de9647" />
        </div>

        {/* Footer */}
        <ModalFooter
          view={view}
          ui={ui}
          importing={importing}
          importResult={importResult}
          previewing={previewing}
          previewData={previewData}
          onOpenStatement={onOpenStatement}
          setView={setView}
          handleClose={handleClose}
          handleConfirmImport={handleConfirmImport}
          handleContinue={handleContinue}
          handleOpenStatement={handleOpenStatement}
          data-testid="ModalFooter__de9647" />
      </DialogContent>
    </Dialog>
  );
}
