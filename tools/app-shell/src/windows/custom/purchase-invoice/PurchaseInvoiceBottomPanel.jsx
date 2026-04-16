import { useUI } from '@/i18n';
import RelatedDocuments from './RelatedDocuments.jsx';

/* eslint-disable react/prop-types */

function fmt(val, curr) {
  const n = typeof val === 'string' ? parseFloat(val) : (val ?? 0);
  const s = n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return curr ? `${s} ${curr}` : s;
}

/**
 * PurchaseInvoiceBottomPanel — two-column bottom block for Purchase Invoice detail.
 *
 * Left:  Related Docs chips + Notes text field (secondary background)
 * Right: Subtotal / Tax / Total
 *
 * Mirrors the layout of InvoiceBottomPanel (sales-invoice) but uses the
 * purchase-invoice RelatedDocuments component.
 */
export default function PurchaseInvoiceBottomPanel({
  recordId, data, token, apiBaseUrl, api, summary,
  notesField, onFieldChange, notesFocused, setNotesFocused,
}) {
  const ui = useUI();
  const currency = data?.['currency$_identifier'] || '';

  const subtotalField = summary?.find(f => f.type === 'amount' && (
    f.key.toLowerCase().includes('summed') ||
    f.key.toLowerCase().includes('totallines') ||
    f.key.toLowerCase().includes('lineamount')
  ));
  const totalField = summary?.find(f => f.type === 'amount' && (
    f.key.toLowerCase().includes('grand') ||
    (f.key.toLowerCase().includes('total') && !f.key.toLowerCase().includes('line'))
  ));
  const subtotal = subtotalField ? data?.[subtotalField.key] : null;
  const total = totalField ? data?.[totalField.key] : null;
  const taxes = (subtotal != null && total != null) ? total - subtotal : null;

  return (
    <div className="flex flex-col">
      <div className="flex">
        {/* ── Left column: Docs + Notes ── */}
        <div className="flex-1 min-w-0 py-4 px-1 bg-muted/30 rounded-bl-lg">
          {/* DOCS */}
          <div className="flex items-start gap-3 px-3 pb-3">
            <span
              className="text-[11px] font-medium text-foreground uppercase shrink-0 w-24 pt-0.5"
              style={{ letterSpacing: '0.04em' }}
            >
              {ui('docs')}
            </span>
            <div className="flex-1">
              <RelatedDocuments
                recordId={recordId}
                data={data}
                token={token}
                apiBaseUrl={apiBaseUrl}
                api={api}
                layout="chips"
              />
            </div>
          </div>

          {/* NOTES */}
          {notesField && (
            <div
              className="flex items-start gap-3 px-3 mt-3 pt-3 border-t border-border/40"
              style={{ borderTopWidth: '0.5px' }}
            >
              <span
                className="text-[11px] font-medium text-foreground uppercase shrink-0 w-24 pt-1.5"
                style={{ letterSpacing: '0.04em' }}
              >
                {ui('notes')}
              </span>
              <div className="flex-1">
                {notesFocused ? (
                  <textarea
                    value={data?.[notesField] || ''}
                    onChange={(e) => onFieldChange?.(notesField, e.target.value)}
                    onBlur={() => setNotesFocused?.(false)}
                    placeholder={ui('addNoteHint')}
                    rows={2}
                    autoFocus
                    className="w-full text-xs bg-white border border-border/40 rounded px-2.5 py-1.5 resize-none focus:outline-none focus:ring-1 focus:ring-primary/30 placeholder:text-muted-foreground/40"
                    style={{ borderWidth: '0.5px' }}
                  />
                ) : (
                  <div
                    tabIndex={0}
                    role="textbox"
                    onClick={() => setNotesFocused?.(true)}
                    onFocus={() => setNotesFocused?.(true)}
                    className="w-full text-xs px-2.5 py-1.5 cursor-text min-h-[1.5rem] text-foreground/80 border border-transparent rounded hover:border-border/30 transition-colors"
                  >
                    {data?.[notesField] || (
                      <span className="text-muted-foreground/40">{ui('addNoteHint')}</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── Vertical separator ── */}
        <div className="border-l border-border/50" style={{ borderLeftWidth: '0.5px' }} />

        {/* ── Right column: Totals ── */}
        <div className="w-[280px] shrink-0 py-4 px-4">
          <div className="text-sm space-y-0.5">
            {subtotal != null && (
              <div className="flex justify-between py-1 px-1">
                <span className="text-muted-foreground">{ui('subtotal')}</span>
                <span className="tabular-nums">{fmt(subtotal, currency)}</span>
              </div>
            )}
            {taxes != null && taxes !== 0 && (
              <div className="flex justify-between py-1 px-1">
                <span className="text-muted-foreground">{ui('tax')}</span>
                <span className="tabular-nums">{fmt(taxes, currency)}</span>
              </div>
            )}
            {total != null && (
              <div
                className="flex justify-between py-1.5 px-1 border-t border-border/40 font-semibold text-base"
                style={{ borderTopWidth: '0.5px' }}
              >
                <span>{ui('total')}</span>
                <span className="tabular-nums">{fmt(total, currency)}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * PurchaseInvoiceLinesEmptyState — centered empty-state for the Lines tab
 * when no lines have been added yet. Omits "Import from Shipment" since
 * that flow does not apply to purchase invoices in this UI.
 */
function PurchaseInvoiceLinesEmptyState({ data, onAddLine, canAddLine = true }) {
  const ui = useUI();
  const isDraft = data?.documentStatus === 'DR';

  if (!isDraft) return null;

  return (
    <div style={{
      margin: '24px 16px',
      padding: '32px 24px',
      background: 'var(--color-background-secondary)',
      borderRadius: 'var(--border-radius-lg)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <div style={{
        width: 40,
        height: 40,
        borderRadius: 'var(--border-radius-md)',
        background: 'var(--color-background-tertiary)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
      }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="8" y1="13" x2="16" y2="13" />
          <line x1="8" y1="17" x2="13" y2="17" />
        </svg>
      </div>
      <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-text-primary)', marginBottom: 4 }}>
        {ui('noLinesYet')}
      </span>
      <span style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 20 }}>
        {ui('addLinesManually')}
      </span>
      {canAddLine && (
        <button
          type="button"
          onClick={onAddLine}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            borderRadius: 8,
            padding: '6px 14px',
            fontSize: 13,
            fontWeight: 500,
            background: '#18181b',
            color: '#fff',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          + {ui('addLines')}
        </button>
      )}
    </div>
  );
}

PurchaseInvoiceBottomPanel.linesEmptyState = PurchaseInvoiceLinesEmptyState;
