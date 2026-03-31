import { useState } from 'react';

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
 * PaymentOutActivityPanel — Right-column activity chatter for Payment Out.
 *
 * Rendered via DetailView's sidePanel prop (React.createElement).
 * Receives: { recordId, data, token, apiBaseUrl, api }
 *
 * Basic version: shows created + status events. No invoice-linking fetch.
 */
export default function PaymentOutActivityPanel({ data }) {
  const [localNotes, setLocalNotes] = useState([]);
  const [noteText, setNoteText] = useState('');

  if (!data) return null;

  const systemDate = fmtDate(data.paymentDate || data.creationDate);
  const systemSortDate = new Date(data.paymentDate || data.creationDate || 0);

  const events = [];

  if (data.paymentDate || data.creationDate) {
    events.push({
      key: 'created',
      text: 'Payment created',
      date: fmtDate(data.paymentDate || data.creationDate),
      sortDate: new Date(data.paymentDate || data.creationDate || 0),
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
    <div className="flex flex-col h-full p-6">

      <span
        className="block text-[11px] font-medium uppercase"
        style={{ color: '#111827', letterSpacing: '0.04em', marginBottom: 16, flexShrink: 0 }}
      >
        Activity
      </span>

      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, display: 'flex', flexDirection: 'column', gap: 20 }}>
        {allEntries.map((ev) => (
          <div key={ev.key} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <span
              className={`rounded-full shrink-0 w-2.5 h-2.5 mt-1 ${ev.isNote ? 'bg-amber-400' : 'bg-gray-500'}`}
            />
            <div>
              <div className="text-sm" style={{ color: '#111827', fontWeight: 500, lineHeight: '1.4' }}>
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
