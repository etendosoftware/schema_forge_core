import { useState, useEffect } from 'react';

const STATUS_LABELS = {
  RPPC: 'Payment Cleared',
  DR: 'Draft',
  RPAP: 'Awaiting Payment',
  RPR: 'Received',
  RDNC: 'Not Cleared',
  RPVD: 'Voided',
};

function fmtDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function todayFmt() {
  return fmtDate(new Date().toISOString());
}

/**
 * PaymentActivityPanel — Right-column activity chatter for Payment In.
 *
 * Rendered via DetailView's sidePanel prop (React.createElement).
 * Receives: { recordId, data, token, apiBaseUrl, api }
 *
 * - System events use paymentDate as reference date.
 * - User-added notes are appended to local state with yellow bullet.
 * - Layout: flex column filling full panel height; timeline scrolls; input sticks to bottom.
 */
export default function PaymentActivityPanel({ data, recordId, token, apiBaseUrl }) {
  const [linkedInvoices, setLinkedInvoices] = useState([]);
  const [localNotes, setLocalNotes] = useState([]);
  const [noteText, setNoteText] = useState('');

  useEffect(() => {
    if (!recordId || !token || !apiBaseUrl) return;
    const base = (apiBaseUrl || '').replace(/\/[^/]+$/, '');
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    (async () => {
      try {
        const res = await fetch(
          `${base}/payment-in/finPaymentScheduleDetail?parentId=${recordId}&_startRow=0&_endRow=100`,
          { headers },
        );
        if (!res.ok) return;
        const details = (await res.json())?.response?.data || [];
        const scheduleIds = [...new Set(details.map(d => d.invoicePaymentSchedule).filter(Boolean))];
        if (scheduleIds.length === 0) return;

        const invoices = [];
        await Promise.all(scheduleIds.map(async (schedId) => {
          try {
            const r = await fetch(`${base}/sales-invoice/paymentPlan/${schedId}`, { headers });
            if (!r.ok) return;
            const row = (await r.json())?.response?.data?.[0];
            if (row?.invoice) {
              const ident = row['invoice$_identifier'] || '';
              const docNo = ident.split(' - ')[0] || '';
              if (docNo && !invoices.some(i => i.id === row.invoice)) {
                invoices.push({ id: row.invoice, docNo });
              }
            }
          } catch { /* silent */ }
        }));
        setLinkedInvoices(invoices);
      } catch { /* silent */ }
    })();
  }, [recordId, token, apiBaseUrl]);

  if (!data) return null;

  // All system events reference paymentDate; fallback to creationDate
  const systemDate = fmtDate(data.paymentDate || data.creationDate);
  const systemSortDate = new Date(data.paymentDate || data.creationDate || 0);

  const events = [];

  // "Payment created" uses paymentDate as the reference date
  if (data.paymentDate || data.creationDate) {
    events.push({
      key: 'created',
      text: 'Payment created',
      date: fmtDate(data.paymentDate || data.creationDate),
      sortDate: new Date(data.paymentDate || data.creationDate || 0),
      isNote: false,
    });
  }

  for (const inv of linkedInvoices) {
    events.push({
      key: `inv-${inv.id}`,
      text: `Linked to Invoice #${inv.docNo}`,
      date: systemDate,
      sortDate: systemSortDate,
      isNote: false,
    });
  }

  const status = data.status || data.documentStatus;
  if (status && status !== 'DR') {
    const label = STATUS_LABELS[status] || status;
    events.push({
      key: 'status',
      text: `Status → ${label}`,
      date: systemDate,
      sortDate: systemSortDate,
      isNote: false,
    });
  }

  events.sort((a, b) => a.sortDate - b.sortDate);

  const allEntries = [...events, ...localNotes];

  const handleAddNote = () => {
    const text = noteText.trim();
    if (!text) return;
    setLocalNotes(prev => [...prev, {
      key: `note-${Date.now()}`,
      text,
      date: todayFmt(),
      sortDate: new Date(),
      isNote: true,
    }]);
    setNoteText('');
  };

  return (
    // h-full fills the self-stretch sidePanel container; flex-col lets the
    // timeline grow and pushes the input to the bottom via mt-auto.
    <div className="flex flex-col h-full p-6">

      {/* Section title */}
      <span
        className="block text-[11px] font-medium uppercase"
        style={{ color: '#111827', letterSpacing: '0.04em', marginBottom: 16, flexShrink: 0 }}
      >
        Activity
      </span>

      {/* Timeline — grows to fill available space; scrolls when overflowing */}
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, display: 'flex', flexDirection: 'column', gap: 20 }}>
        {allEntries.map((ev) => (
          <div key={ev.key} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            {/* Bullet — 10px, dark grey for system / yellow for user notes */}
            <span
              className={`rounded-full shrink-0 w-2.5 h-2.5 mt-1 ${ev.isNote ? 'bg-amber-400' : 'bg-gray-500'}`}
            />
            {/* Text + date stacked */}
            <div>
              <div
                className="text-sm"
                style={{ color: '#111827', fontWeight: 500, lineHeight: '1.4' }}
              >
                {ev.text}
              </div>
              <div style={{ color: '#9ca3af', fontSize: 12, marginTop: 3 }}>{ev.date}</div>
            </div>
          </div>
        ))}

        {allEntries.length === 0 && (
          <span className="text-sm" style={{ color: '#d1d5db' }}>No activity yet</span>
        )}
      </div>

      {/* Add a note — pushed to bottom of flex column */}
      <div
        style={{
          marginTop: 'auto',
          paddingTop: 16,
          borderTop: '1px solid #e5e7eb',
          display: 'flex',
          gap: 8,
          alignItems: 'center',
          flexShrink: 0,
        }}
      >
        <input
          type="text"
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddNote(); } }}
          placeholder="Add a note..."
          className="flex-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary/30"
          style={{
            padding: '8px 12px',
            border: '1px solid #d1d5db',
            borderRadius: 6,
            backgroundColor: '#ffffff',
            color: '#374151',
          }}
        />
        <button
          type="button"
          onClick={handleAddNote}
          disabled={!noteText.trim()}
          className="shrink-0 flex items-center justify-center text-sm font-bold transition-colors disabled:opacity-40"
          style={{
            width: 30,
            height: 30,
            borderRadius: 6,
            border: 'none',
            backgroundColor: noteText.trim() ? '#f59e0b' : '#e5e7eb',
            color: noteText.trim() ? '#ffffff' : '#9ca3af',
            cursor: noteText.trim() ? 'pointer' : 'default',
          }}
        >
          +
        </button>
      </div>
    </div>
  );
}
