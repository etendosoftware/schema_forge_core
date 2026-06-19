import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';
import { Check, ChevronDown, FileText, Pencil, Plus, Trash2 } from 'lucide-react';
import { useUI, useLocaleSwitch } from '@/i18n';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { DateField } from '@/components/ui/date-field';
import { cn } from '@/lib/utils';
import { useCreateStatement } from '@/hooks/useCreateStatement';
import { useStatementActions } from '@/hooks/useStatementActions';
import { useBankStatementLines } from '@/hooks/useBankStatementLines';
import { useBPartnerLookup, useGLItemLookup } from '@/hooks/useMovementLookups';
import { AddLineButton } from '@/components/ui/add-line-button';
import { LookupPicker } from './LookupPicker';
import { FieldRow, inputClass } from './formFields';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

// Amounts (out / in) default to "0,00" so the required amount fields already
// carry a value — a new line then only needs a Reference No to be complete.
let lineSeq = 0;
const newLine = () => {
  lineSeq += 1;
  return {
    id: `l${lineSeq}`,
    // Pre-fill the line date with today; it is excluded from the blank-line check
    // so a row with only the default date still counts as empty.
    date: toLocalIso(new Date()), reference: '', description: '', contactName: '', contact: null, glItem: null,
    // Empty so the amount fields show "0,00" as a placeholder (not a real value
    // the user must clear). parseAmount('') → 0; a line needs at least one amount.
    out: '', in: '',
  };
};

/** Browser-native date input yields `YYYY-MM-DD`. */
function toLocalIso(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/** Sends UTC midnight so the backend parses the same calendar day regardless of TZ. */
function toIsoUtc(localDate) {
  return localDate ? `${localDate}T00:00:00Z` : '';
}

/** "2026-06-07T00:00:00Z" (or any ISO) → local "YYYY-MM-DD". Blank-safe. */
function isoToLocal(iso) {
  if (!iso) return '';
  return String(iso).split('T')[0];
}

/**
 * Maps a backend statement line (from `?action=lines`) into the editable row
 * shape used by the grid. The committed FK pickers need a `{ id, name }`; the
 * line carries both the id and the joined name (bpartnerFkName / glItemName).
 */
function lineToRow(l) {
  lineSeq += 1;
  return {
    id: `e${lineSeq}`,
    date: isoToLocal(l.date) || toLocalIso(new Date()),
    reference: l.reference && l.reference !== '**' ? l.reference : '',
    description: l.description || '',
    contactName: l.bpartnerName || '',
    contact: l.bpartnerId ? { id: l.bpartnerId, name: l.bpartnerFkName || l.bpartnerName || '' } : null,
    glItem: l.glItemId ? { id: l.glItemId, name: l.glItemName || '' } : null,
    // Show the zero side as empty (placeholder) — a statement line is an inflow
    // OR an outflow, so the unused side reads "0,00" as a hint, not a real 0.
    out: l.out ? String(l.out) : '',
    in: l.in ? String(l.in) : '',
  };
}

/**
 * Parses a user-typed amount that may use either `,` or `.` as decimal
 * separator (Spanish operators type `3.500,00`). When both are present the
 * rightmost is treated as the decimal separator — same rule the backend CSV
 * importer applies. Returns a finite Number (0 on blank/invalid).
 */
function parseAmount(v) {
  if (v == null) return 0;
  let s = String(v).trim();
  if (!s) return 0;
  const hasComma = s.includes(',');
  const hasDot = s.includes('.');
  if (hasComma && hasDot) {
    s = s.lastIndexOf(',') > s.lastIndexOf('.')
      ? s.replace(/\./g, '').replace(',', '.')
      : s.replace(/,/g, '');
  } else if (hasComma) {
    s = s.replace(',', '.');
  }
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

function isBlankLine(r) {
  // The auto-filled date is ignored: a row with only the default date is empty.
  return !r.reference.trim() && !r.description.trim() && !r.contactName.trim() && !r.contact && !r.glItem
    && parseAmount(r.in) === 0 && parseAmount(r.out) === 0;
}

/**
 * A line is "complete" (committable / saveable) when it has its transaction date,
 * a Reference No, and at least one amount entered (a statement line is an inflow
 * OR an outflow, so the other side is left empty = 0). The contact / G/L item are
 * optional. Empty amount fields count as 0.
 */
function isLineComplete(r) {
  return !!r.date
    && r.reference.trim() !== ''
    && (parseAmount(r.out) > 0 || parseAmount(r.in) > 0);
}

function computeTotals(rows) {
  let tin = 0;
  let tout = 0;
  let n = 0;
  rows.forEach((r) => {
    if (isBlankLine(r)) return;
    tin += parseAmount(r.in);
    tout += parseAmount(r.out);
    n += 1;
  });
  return { tin, tout, bal: tin - tout, n };
}

function makeMoneyFormatter(currency, bcpLocale) {
  return (amount) => {
    try {
      return new Intl.NumberFormat(bcpLocale, {
        style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2,
      }).format(Number(amount) || 0);
    } catch {
      return `${(Number(amount) || 0).toFixed(2)} ${currency}`;
    }
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Header fields
// ─────────────────────────────────────────────────────────────────────────────

function HeaderFields({ form, setForm, ui }) {
  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="col-span-2">
        <FieldRow label={ui('financeAccountStatementsManualName')} required>
          <input
            type="text" value={form.name} onChange={set('name')}
            placeholder={ui('financeAccountStatementsManualNamePlaceholder')}
            data-testid="manual-statement-name" className={inputClass}
          />
        </FieldRow>
      </div>
      <FieldRow label={ui('financeAccountStatementsManualTrxDate')} required>
        <DateField
          value={form.transactionDate}
          onChange={(iso) => setForm((f) => ({ ...f, transactionDate: iso }))}
          data-testid="manual-statement-trxdate"
        />
      </FieldRow>
      <FieldRow label={ui('financeAccountStatementsManualImportDate')} required>
        <DateField
          value={form.importDate}
          onChange={(iso) => setForm((f) => ({ ...f, importDate: iso }))}
          data-testid="manual-statement-importdate"
        />
      </FieldRow>
      <FieldRow label={ui('financeAccountStatementsManualFileName')}>
        <input type="text" value={form.fileName} onChange={set('fileName')}
          placeholder={ui('financeAccountStatementsManualFileNamePlaceholder')}
          data-testid="manual-statement-filename" className={inputClass} />
      </FieldRow>
      <FieldRow label={ui('financeAccountStatementsManualNotes')}>
        <input type="text" value={form.notes} onChange={set('notes')}
          placeholder={ui('financeAccountStatementsManualNotesPlaceholder')}
          data-testid="manual-statement-notes" className={inputClass} />
      </FieldRow>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Editable line card
// ─────────────────────────────────────────────────────────────────────────────

// One CSS grid track set shared by the header, the read-only display rows and
// the editable row so every column lines up. `fr` units let the row fill the
// modal width without a horizontal scrollbar (which would clip lookup dropdowns).
const LINES_GRID =
  'grid grid-cols-[130px_minmax(110px,0.8fr)_minmax(180px,1.6fr)_minmax(140px,1.1fr)_minmax(150px,1.2fr)_minmax(150px,1.2fr)_110px_110px_72px] gap-2';

const cellInput = cn(inputClass, 'w-full');
const cellAmount = cn(inputClass, 'w-full tabular-nums');
const MUTED = 'text-[#A8AAB8]';

/** Formats a date-only ISO ("YYYY-MM-DD") for display in the committed rows. */
function formatDisplayDate(iso, bcpLocale) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return '—';
  try {
    return new Intl.DateTimeFormat(bcpLocale, { day: '2-digit', month: '2-digit', year: 'numeric' })
      .format(new Date(y, m - 1, d));
  } catch {
    return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
  }
}

// Column header styled like the invoices table in the New movement modal:
// normal case (no uppercase), small semibold dark labels on a white row with a
// bottom border.
/** A column header label with an optional red required asterisk. */
function ColHead({ label, required }) {
  return (
    <span>
      {label}{required ? <span className="text-[#9A1B1B]"> *</span> : null}
    </span>
  );
}

function LinesHeader({ ui }) {
  return (
    <div className={cn(LINES_GRID, 'items-center rounded-t-xl border-b border-[#E8EAEF] bg-white px-3 py-2.5 text-xs font-semibold tracking-normal text-[#121217]')}>
      <ColHead label={ui('financeAccountStatementsManualColDate')} required />
      <ColHead label={ui('financeAccountStatementsManualColReference')} required />
      <ColHead label={ui('financeAccountStatementsManualColDesc')} />
      <ColHead label={ui('financeAccountStatementsManualColContactName')} />
      <ColHead label={ui('financeAccountStatementsManualColContact')} />
      <ColHead label={ui('financeAccountStatementsManualColGlItem')} />
      <ColHead label={ui('financeAccountStatementsManualColOut')} required />
      <ColHead label={ui('financeAccountStatementsManualColIn')} required />
      <span />
    </div>
  );
}

/** Read-only summary of a committed line (text, not inputs) + edit / delete. */
function DisplayRow({ row, money, bcpLocale, onEdit, onRemove, ui }) {
  const out = parseAmount(row.out);
  const inc = parseAmount(row.in);
  return (
    <div className={cn(LINES_GRID, 'items-center px-3 py-2.5 text-[13px] text-[#121217] hover:bg-[#FAFBFC]')}
      data-testid="manual-line-row">
      <span className="truncate">{formatDisplayDate(row.date, bcpLocale)}</span>
      <span className={cn('truncate', !row.reference && MUTED)}>{row.reference || '—'}</span>
      <span className={cn('truncate', !row.description && MUTED)} title={row.description || ''}>{row.description || '—'}</span>
      <span className={cn('truncate', !row.contactName && MUTED)}>{row.contactName || '—'}</span>
      <span className={cn('truncate', !row.contact && MUTED)}>{row.contact?.name || '—'}</span>
      <span className={cn('truncate', !row.glItem && MUTED)}>{row.glItem?.name || '—'}</span>
      <span className={cn('truncate font-medium tabular-nums', out > 0 ? 'text-red-700' : MUTED)}>
        {out > 0 ? `−${money(out)}` : '—'}
      </span>
      <span className={cn('truncate font-medium tabular-nums', inc > 0 ? 'text-green-700' : MUTED)}>
        {inc > 0 ? `+${money(inc)}` : '—'}
      </span>
      <span className="flex items-center justify-end gap-1">
        <button type="button" onClick={() => onEdit(row.id)}
          aria-label={ui('financeAccountStatementsManualEditLine')} data-testid="manual-line-edit"
          className="flex h-7 w-7 items-center justify-center rounded-full text-[#6C6C89] hover:bg-[#F0F2F5] hover:text-[#121217]">
          <Pencil className="h-4 w-4" />
        </button>
        <button type="button" onClick={() => onRemove(row.id)}
          aria-label={ui('financeAccountStatementsManualRemoveLine')} data-testid="manual-line-remove"
          className="flex h-7 w-7 items-center justify-center rounded-full text-[#D50B3E] hover:bg-[#FEF0F4]">
          <Trash2 className="h-4 w-4" />
        </button>
      </span>
    </div>
  );
}

/** The single line currently being edited — full input row, lightly highlighted. */
function EditRow({ row, onChange, onRemove, ui, rowRef }) {
  const set = (field) => (e) => onChange(row.id, field, e.target.value);
  const setVal = (field) => (value) => onChange(row.id, field, value);
  return (
    <div ref={rowRef} className={cn(LINES_GRID, 'items-center bg-white px-3 py-2.5')} data-testid="manual-line-editrow">
      <DateField value={row.date} onChange={setVal('date')} data-testid="manual-line-date" className="w-full" />
      <input type="text" value={row.reference} onChange={set('reference')} className={cellInput} data-testid="manual-line-ref" />
      <input type="text" value={row.description} onChange={set('description')}
        placeholder={ui('financeAccountStatementsManualDescPlaceholder')}
        className={cellInput} data-testid="manual-line-description" />
      <input type="text" value={row.contactName} onChange={set('contactName')}
        placeholder={ui('financeAccountStatementsManualCounterpartyPlaceholder')}
        className={cellInput} data-testid="manual-line-contactname" />
      <LookupPicker value={row.contact} onSelect={(it) => setVal('contact')(it)} onClear={() => setVal('contact')(null)}
        placeholder={ui('financeAccountStatementsManualContactPlaceholder')} useLookup={useBPartnerLookup}
        dataTestId="manual-line-contact" className={cellInput} search />
      <LookupPicker value={row.glItem} onSelect={(it) => setVal('glItem')(it)} onClear={() => setVal('glItem')(null)}
        placeholder={ui('financeAccountStatementsManualGlItemPlaceholder')} useLookup={useGLItemLookup}
        dataTestId="manual-line-glitem" className={cellInput} search />
      <input type="text" inputMode="decimal" value={row.out} onChange={set('out')} placeholder={ui('financeAccountAmountPlaceholder')}
        className={cellAmount} data-testid="manual-line-out" />
      <input type="text" inputMode="decimal" value={row.in} onChange={set('in')} placeholder={ui('financeAccountAmountPlaceholder')}
        className={cellAmount} data-testid="manual-line-in" />
      <span className="flex items-center justify-end">
        <button type="button" onClick={() => onRemove(row.id)}
          aria-label={ui('financeAccountStatementsManualRemoveLine')} data-testid="manual-line-remove"
          className="flex h-9 w-8 items-center justify-center rounded-full text-[#D50B3E] hover:bg-[#FEF0F4]">
          <Trash2 className="h-4 w-4" />
        </button>
      </span>
    </div>
  );
}

function EditableLines({ rows, setRows, money, bcpLocale, ui }) {
  const [editingId, setEditingId] = useState(null);
  const editRowRef = useRef(null);

  const change = (id, field, value) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, [field]: value } : r)));

  const remove = (id) => {
    setRows((rs) => rs.filter((r) => r.id !== id));
    setEditingId((cur) => (cur === id ? null : cur));
  };

  // Commit the row being edited: a blank draft is discarded, a complete one
  // becomes a read-only display row, and an incomplete one stays in edit mode
  // (the user must finish its required fields — date, Reference No, both amounts).
  const commitDraft = () => {
    if (editingId == null) return;
    const current = rows.find((r) => r.id === editingId);
    if (!current) { setEditingId(null); return; }
    if (isBlankLine(current)) {
      setRows((rs) => rs.filter((r) => r.id !== editingId));
      setEditingId(null);
    } else if (isLineComplete(current)) {
      setEditingId(null);
    }
    // incomplete → keep editing
  };

  // Clicking outside the edit row commits it (same rules as commitDraft). The
  // lookup dropdowns are portalled out of the row, so clicks inside them must NOT
  // count as "outside" — they're part of editing the row.
  useEffect(() => {
    if (editingId == null) return undefined;
    const onDown = (e) => {
      const t = e.target;
      if (editRowRef.current?.contains(t)) return;
      if (t?.closest?.('[data-lookup-dropdown]')) return;
      // The date-field calendar (and any other popover) is portalled out of the row via a Radix
      // popper; clicking inside it is still editing the row, so it must NOT commit/discard it.
      if (t?.closest?.('[data-radix-popper-content-wrapper]')) return;
      commitDraft();
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingId, rows]);

  // Add a fresh editable line. Refuses while the current draft is incomplete so
  // the user finishes (or empties) it first; an empty draft is reused as-is.
  const add = () => {
    const current = rows.find((r) => r.id === editingId);
    if (current && isBlankLine(current)) return;
    if (current && !isLineComplete(current)) return;
    const nl = newLine();
    setRows((rs) => [...rs, nl]);
    setEditingId(nl.id);
  };

  // Reopen a committed row for editing. Discards the current draft if it is blank;
  // refuses to switch away from an incomplete (non-blank) draft.
  const edit = (id) => {
    const current = rows.find((r) => r.id === editingId);
    if (current && current.id !== id) {
      if (isBlankLine(current)) {
        setRows((rs) => rs.filter((r) => r.id !== current.id));
      } else if (!isLineComplete(current)) {
        return;
      }
    }
    setEditingId(id);
  };

  // Empty state: a single call-to-action card (mirrors the "Añadir comisiones y
  // conceptos (GL)" affordance in the New movement modal).
  if (rows.length === 0) {
    return (
      <button
        type="button"
        onClick={add}
        data-testid="manual-statement-add-lines"
        className="flex w-full items-center gap-3 rounded-xl border border-dashed border-[#D1D4DB] bg-[#F5F7F9] px-4 py-3.5 text-left hover:border-[#A9A9BC]"
      >
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-[#121217] text-white">
          <Plus className="h-[18px] w-[18px]" />
        </span>
        <span className="flex flex-col gap-px">
          <span className="text-sm font-semibold text-[#121217]">
            {ui('financeAccountStatementsManualAddLinesCta')}
          </span>
          <span className="text-xs text-[#6C6C89]">
            {ui('financeAccountStatementsManualAddLinesCtaDesc')}
          </span>
        </span>
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="overflow-hidden rounded-xl border border-[#E8EAEF]">
        <LinesHeader ui={ui} />
        <div className="divide-y divide-[#F0F2F5]">
          {rows.map((r) => (
            r.id === editingId
              ? <EditRow key={r.id} row={r} onChange={change} onRemove={remove} ui={ui} rowRef={editRowRef} />
              : <DisplayRow key={r.id} row={r} money={money} bcpLocale={bcpLocale} onEdit={edit} onRemove={remove} ui={ui} />
          ))}
        </div>
      </div>
      <div className="w-fit">
        <AddLineButton onClick={add} label={ui('financeAccountStatementsManualAddLine')} hideChevron />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Totals bar
// ─────────────────────────────────────────────────────────────────────────────

function TotalsBar({ rows, money, ui }) {
  const t = computeTotals(rows);
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
      <Total label={ui('financeAccountStatementsManualTotalLines')} value={t.n} />
      <Total label={ui('financeAccountStatementsManualTotalIn')} value={`+${money(t.tin)}`} valueClass="text-green-700" />
      <Total label={ui('financeAccountStatementsManualTotalOut')} value={`−${money(t.tout)}`} valueClass="text-red-700" />
      <Total label={ui('financeAccountStatementsManualTotalBalance')} value={money(t.bal)} valueClass="text-[#121217]" />
    </div>
  );
}

function Total({ label, value, valueClass = 'text-[#121217]' }) {
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span className="text-xs text-[#6C6C89]">{label}</span>
      <span className={cn('font-semibold tabular-nums', valueClass)}>{value}</span>
    </span>
  );
}

function SectionLabel({ children, count }) {
  return (
    <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[.04em] text-[#6C6C89]">
      <span>{children}</span>
      {count != null ? (
        <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#F0F2F5] px-1.5 text-[11px] font-semibold text-[#3F3F50]">
          {count}
        </span>
      ) : null}
    </div>
  );
}

/**
 * Split save button: the primary action saves + processes the statement; the ▾
 * menu offers "save as draft" (persist without processing). The menu is
 * portalled below the button so it isn't clipped by the dialog's overflow, with
 * `pointerEvents:auto` so it stays clickable inside the Radix modal.
 */
function SaveSplitButton({ creating, onProcess, onDraft, ui }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const wrapRef = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const update = () => {
      const el = wrapRef.current;
      if (el) {
        const r = el.getBoundingClientRect();
        setPos({ top: r.bottom + 6, left: Math.max(8, r.right - 256) });
      }
    };
    update();
    const onDoc = (e) => {
      if (wrapRef.current?.contains(e.target) || menuRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [open]);

  const btnBase = 'inline-flex h-10 items-center bg-[#121217] text-white transition-colors hover:bg-[#FFD500] hover:text-[#121217] disabled:cursor-not-allowed disabled:opacity-50';

  return (
    <div ref={wrapRef} className="relative flex items-stretch">
      <button
        type="button"
        onClick={onProcess}
        disabled={creating}
        data-testid="manual-statement-save"
        className={cn(btnBase, 'gap-1.5 rounded-l-lg px-3 text-sm font-medium')}
      >
        <Check className="h-4 w-4" />
        {creating ? ui('financeAccountStatementsManualSaving') : ui('financeAccountStatementsManualSaveProcess')}
      </button>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={creating}
        aria-label={ui('financeAccountStatementsManualSaveMore')}
        aria-haspopup="menu"
        aria-expanded={open}
        data-testid="manual-statement-save-split"
        className={cn(btnBase, 'w-9 justify-center rounded-r-lg border-l border-white/20')}
      >
        <ChevronDown className={cn('h-4 w-4 transition-transform', open && 'rotate-180')} />
      </button>
      {open && pos ? createPortal(
        <div
          ref={menuRef}
          role="menu"
          style={{ position: 'fixed', top: pos.top, left: pos.left, width: 256, zIndex: 9999, pointerEvents: 'auto' }}
          className="overflow-hidden rounded-lg border border-[#E8EAEF] bg-white shadow-lg"
        >
          <button
            type="button"
            role="menuitem"
            data-testid="manual-statement-save-draft"
            onClick={() => { setOpen(false); onDraft(); }}
            className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-[#F5F7F9]"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#F0F2F5] text-[#121217]">
              <FileText className="h-4 w-4" />
            </span>
            <span className="text-sm font-semibold text-[#121217]">
              {ui('financeAccountStatementsManualSaveDraft')}
            </span>
          </button>
        </div>,
        document.body,
      ) : null}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Modal
// ─────────────────────────────────────────────────────────────────────────────

const initialForm = (today) => ({ name: '', transactionDate: today, importDate: today, fileName: '', notes: '' });

/**
 * "Crear extracto" — modal to create a bank statement by hand (header + lines)
 * without a file. Mirrors the Classic manual bank-statement form (header: name,
 * dates, file name, notes; lines: date, reference, counterparty name + FK, G/L
 * item, amounts, description) and reuses the same field primitives as the Create
 * movement modal. On save it POSTs to `bank-statements?action=create` which
 * persists the statement + lines and processes it so the lines become
 * available for reconciliation.
 *
 * @param {{
 *   open: boolean;
 *   accountId: string;
 *   accountCurrency?: string;
 *   onClose: () => void;
 *   onSuccess: () => void;
 * }} props
 */
export function ManualStatementModal({
  open, accountId, accountCurrency = 'EUR', statement = null, onClose, onSuccess,
}) {
  const ui = useUI();
  const { locale: appLocale } = useLocaleSwitch();
  const bcpLocale = (appLocale || 'es_ES').replace('_', '-');
  const money = useMemo(() => makeMoneyFormatter(accountCurrency, bcpLocale), [accountCurrency, bcpLocale]);

  const editing = !!statement;
  const { createStatement, creating } = useCreateStatement();
  const { updateStatement, busy } = useStatementActions();
  // Only fetch lines while editing an open draft.
  const { lines: loadedLines, loading: linesLoading } =
    useBankStatementLines(editing && open ? statement.id : null);
  const saving = creating || busy;

  const today = useMemo(() => toLocalIso(new Date()), []);
  const [form, setForm] = useState(() => initialForm(today));
  const [rows, setRows] = useState(() => []);
  // Tracks whether the user has touched anything since opening (drives the
  // discard-changes prompt) and whether that prompt is currently shown.
  const [dirty, setDirty] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  // Guards single hydration per open so user edits aren't clobbered on re-render.
  const hydratedRef = useRef(false);

  // setForm/setRows variants that flag the form as dirty. Hydration/reset use the
  // raw setters so seeding the modal never counts as a user edit.
  const setFormDirty = (updater) => { setDirty(true); setForm(updater); };
  const setRowsDirty = (updater) => { setDirty(true); setRows(updater); };

  // Reset everything when the modal closes. Deps are stable (open/today) so this
  // never re-runs on every render — keeping `loadedLines` out avoids an update loop
  // (the lines hook returns a fresh [] each render when there's no data).
  useEffect(() => {
    if (open) return;
    hydratedRef.current = false;
    setForm(initialForm(today));
    setRows([]);
    setDirty(false);
    setConfirmClose(false);
  }, [open, today]);

  // Hydrate once per open. In edit mode, seed the header + lines from the draft
  // (after they load). The hydratedRef guard makes re-runs (e.g. loadedLines
  // getting a new reference) a no-op, so there's no render loop.
  useEffect(() => {
    if (!open || hydratedRef.current) return;
    if (editing) {
      if (linesLoading) return;
      setForm({
        name: statement.name || '',
        transactionDate: isoToLocal(statement.transactionDate) || today,
        importDate: isoToLocal(statement.importDate) || today,
        fileName: statement.fileName || '',
        notes: statement.notes || '',
      });
      setRows(loadedLines.map(lineToRow));
    }
    hydratedRef.current = true;
  }, [open, editing, linesLoading, loadedLines, statement, today]);

  const handleSave = async (process) => {
    if (!form.name.trim()) {
      toast.error(ui('financeAccountStatementsManualErrorName'));
      return;
    }
    const usable = rows.filter((r) => !isBlankLine(r));
    if (usable.length === 0) {
      toast.error(ui('financeAccountStatementsManualErrorLines'));
      return;
    }
    // Every non-blank line must have its required fields (date, Reference No,
    // both amounts) — an incomplete line cannot be saved.
    if (usable.some((r) => !isLineComplete(r))) {
      toast.error(ui('financeAccountStatementsManualErrorIncompleteLine'));
      return;
    }
    const payloadLines = usable.map((r) => ({
      date: toIsoUtc(r.date),
      reference: r.reference.trim(),
      description: r.description.trim(),
      bpartnerName: r.contactName.trim(),
      bpartnerId: r.contact?.id ?? null,
      glItemId: r.glItem?.id ?? null,
      in: parseAmount(r.in),
      out: parseAmount(r.out),
    }));
    const header = {
      name: form.name.trim(),
      transactionDate: toIsoUtc(form.transactionDate),
      importDate: toIsoUtc(form.importDate),
      fileName: form.fileName.trim(),
      notes: form.notes.trim(),
      process,
      lines: payloadLines,
    };
    try {
      if (editing) {
        await updateStatement({ id: statement.id, ...header });
      } else {
        await createStatement({ accountId, ...header });
      }
      toast.success(ui(editing
        ? 'financeAccountStatementsManualUpdateSuccess'
        : 'financeAccountStatementsManualSuccess'));
      onSuccess();
      onClose();
    } catch {
      toast.error(ui('financeAccountStatementsManualError'));
    }
  };

  // Closing (X / Escape / Cancel) with unsaved edits asks for confirmation first.
  const requestClose = () => {
    if (dirty) setConfirmClose(true);
    else onClose();
  };

  return (
    <>
    <Dialog open={open} onOpenChange={(v) => { if (!v) requestClose(); }}>
      <DialogContent
        className="w-[96vw] max-w-[1680px] overflow-hidden p-0"
        style={{ background: 'var(--surface-overlay, #FFFFFF)' }}
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => { e.preventDefault(); requestClose(); }}
      >
        <div className="bg-white px-6 pt-6">
          <h2 className="text-lg font-semibold leading-6 text-[#121217]">
            {ui(editing ? 'financeAccountStatementsManualEditTitle' : 'financeAccountStatementsManualTitle')}
          </h2>
          <p className="mt-1 text-[13px] leading-[19px] text-[#6C6C89]">
            {ui(editing ? 'financeAccountStatementsManualEditSubtitle' : 'financeAccountStatementsManualSubtitle')}
          </p>
        </div>

        <div className="max-h-[62vh] overflow-y-auto bg-white px-6 py-4">
          <HeaderFields form={form} setForm={setFormDirty} ui={ui} />

          <div className="mt-6">
            <SectionLabel count={computeTotals(rows).n}>
              {ui('financeAccountStatementsManualSectionLines')}
            </SectionLabel>
          </div>
          <EditableLines rows={rows} setRows={setRowsDirty} money={money} bcpLocale={bcpLocale} ui={ui} />
        </div>

        <div className="flex items-center justify-between gap-4 border-t border-[#E8EAEF] bg-white px-6 py-4">
          <TotalsBar rows={rows} money={money} ui={ui} />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={requestClose}
              data-testid="manual-statement-cancel"
              className="inline-flex h-10 items-center rounded-lg border border-[#D1D4DB] bg-white px-3 text-sm font-medium text-[#121217] hover:bg-[#F5F7F9]"
            >
              {ui('financeAccountStatementsManualCancel')}
            </button>
            <SaveSplitButton
              creating={saving}
              onProcess={() => handleSave(true)}
              onDraft={() => handleSave(false)}
              ui={ui}
            />
          </div>
        </div>

      </DialogContent>
    </Dialog>

    <Dialog open={confirmClose} onOpenChange={(v) => { if (!v) setConfirmClose(false); }}>
      <DialogContent className="max-w-sm bg-white">
        <div data-testid="manual-discard-overlay">
          <h3 className="text-base font-semibold text-[#121217]">
            {ui('financeAccountStatementsManualDiscardTitle')}
          </h3>
          <p className="mt-1 text-sm text-[#6C6C89]">
            {ui('financeAccountStatementsManualDiscardBody')}
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setConfirmClose(false)}
              data-testid="manual-discard-keep"
              className="inline-flex h-10 items-center rounded-lg border border-[#D1D4DB] bg-white px-3 text-sm font-medium text-[#121217] hover:bg-[#F5F7F9]"
            >
              {ui('financeAccountStatementsManualDiscardKeep')}
            </button>
            <button
              type="button"
              onClick={() => { setConfirmClose(false); onClose(); }}
              data-testid="manual-discard-confirm"
              className="inline-flex h-10 items-center rounded-lg bg-[#D50B3E] px-3 text-sm font-medium text-white hover:bg-[#B50934]"
            >
              {ui('financeAccountStatementsManualDiscardConfirm')}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}
