import { useState, useEffect } from 'react';
import RelatedDocuments from './RelatedDocuments';

function fmtAmount(amount, currencyId) {
  const n = typeof amount === 'string' ? parseFloat(amount) : (amount ?? 0);
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: currencyId || 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

/**
 * PaymentBottomPanel — Full-width bottom content for Payment In detail view.
 *
 * Layout (below the header form):
 *   1. Unallocated credit banner (only if remaining > 0)
 *   2. DOCS — related document chips
 *   3. NOTES — inline editable description field
 *
 * Activity is accessible via the topbar toggle (PaymentActivityToggle) which
 * opens a slide-in drawer containing PaymentActivityPanel.
 */
export default function PaymentBottomPanel({
  recordId, data, token, apiBaseUrl, api,
  notesField, onFieldChange, notesFocused, setNotesFocused,
}) {
  const [remaining, setRemaining] = useState(0);

  // Compute unallocated credit
  useEffect(() => {
    if (!data?.id || !token || !apiBaseUrl) return;
    const base = (apiBaseUrl || '').replace(/\/[^/]+$/, '');
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    (async () => {
      try {
        const res = await fetch(
          `${base}/payment-in/finPaymentScheduleDetail?parentId=${data.id}&_startRow=0&_endRow=100`,
          { headers },
        );
        if (!res.ok) return;
        const details = (await res.json())?.response?.data || [];
        const applied = details
          .filter(d => d.invoicePaymentSchedule)
          .reduce((sum, d) => sum + (parseFloat(d.amount) || 0), 0);
        const total = parseFloat(data.amount) || 0;
        setRemaining(Math.max(0, total - applied));
      } catch { /* silent */ }
    })();
  }, [data?.id, data?.amount, token, apiBaseUrl]);

  const currency = data?.['currency$_identifier'] || 'EUR';

  return (
    <div>
      {/* Separator between header form and content sections */}
      <div style={{ borderTop: '1px solid #e5e7eb', margin: '8px 0 20px' }} />

      {/* Unallocated credit banner — only when remaining > 0 */}
      {remaining > 0 && (
        <div
          style={{
            backgroundColor: '#fffbeb',
            border: '1px solid #fde68a',
            borderRadius: 6,
            padding: '8px 14px',
            marginBottom: 20,
          }}
        >
          <span className="text-xs" style={{ color: '#92400e' }}>
            This payment has <strong>{fmtAmount(remaining, currency)}</strong> of unallocated credit
          </span>
        </div>
      )}

      {/* DOCS section — first section, separator above provides the top divider */}
      <SectionBlock label="Docs" noBorder>
        <RelatedDocuments
          recordId={recordId}
          data={data}
          token={token}
          apiBaseUrl={apiBaseUrl}
          api={api}
          layout="chips"
        />
      </SectionBlock>

      {/* NOTES section — inline editable description field */}
      {notesField && (
        <SectionBlock label="Notes">
          {notesFocused ? (
            <textarea
              value={data?.[notesField] || ''}
              onChange={(e) => onFieldChange?.(notesField, e.target.value)}
              onBlur={() => setNotesFocused?.(false)}
              placeholder="Add a note..."
              rows={3}
              autoFocus
              className="w-full text-sm resize-none focus:outline-none focus:ring-1 focus:ring-primary/30"
              style={{
                backgroundColor: '#ffffff',
                border: '1px solid #e5e7eb',
                borderRadius: 6,
                padding: '8px 12px',
              }}
            />
          ) : (
            <div
              tabIndex={0}
              role="textbox"
              onClick={() => setNotesFocused?.(true)}
              onFocus={() => setNotesFocused?.(true)}
              className="w-full text-sm cursor-text"
              style={{
                padding: '7px 0',
                minHeight: 28,
                color: data?.[notesField] ? '#374151' : '#d1d5db',
              }}
            >
              {data?.[notesField] || 'Add a note...'}
            </div>
          )}
        </SectionBlock>
      )}
    </div>
  );
}

/** Reusable section with label + top divider. Pass noBorder to skip the divider. */
function SectionBlock({ label, children, noBorder }) {
  return (
    <div style={{ ...(noBorder ? {} : { borderTop: '1px solid #f3f4f6' }), paddingTop: 16, marginBottom: 16 }}>
      <span
        className="block text-[11px] font-medium uppercase"
        style={{ color: '#111827', letterSpacing: '0.04em', marginBottom: 10 }}
      >
        {label}
      </span>
      {children}
    </div>
  );
}
