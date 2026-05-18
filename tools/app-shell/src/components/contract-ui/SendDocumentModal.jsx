import { useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import { Mail, Search } from 'lucide-react';
import { useUI } from '@/i18n';

const isValidEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

function getContactLabel(c) {
  const full = [c.etgoFirstname, c.etgoLastname].filter(Boolean).join(' ') || c.name || '';
  return full ? `${full} <${c.etgoEmail}>` : c.etgoEmail;
}

function contactMatchesQuery(c, q) {
  return (c.etgoEmail || '').toLowerCase().includes(q)
    || (c.etgoFirstname || '').toLowerCase().includes(q)
    || (c.etgoLastname || '').toLowerCase().includes(q)
    || (c.name || '').toLowerCase().includes(q);
}

async function renderPdfIntoIframe(node, reportId, documentId, token, setPdfLoading, setPdfError) {
  setPdfLoading(true);
  setPdfError(null);
  try {
    const res = await fetch(`/api/reports/${reportId}/render`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ format: 'html', params: { documentId } }),
    });
    if (!res.ok) throw new Error(`Preview failed (${res.status})`);
    const html = await res.text();
    node.src = 'about:blank';
    node.onload = () => {
      try { const doc = node.contentDocument; doc.open(); doc.write(html); doc.close(); } catch {}
      node.onload = null;
    };
  } catch (err) {
    setPdfError(err.message);
  }
  setPdfLoading(false);
}

async function fetchAndDownloadPdf(reportId, documentId, windowName, documentNo, token) {
  const res = await fetch(`/api/reports/${reportId}/render`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ format: 'html', params: { documentId } }),
  });
  if (!res.ok) throw new Error('Failed to render');
  const html = await res.text();
  const pdfRes = await fetch('/jsreport/api/report', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ template: { content: html, engine: 'none', recipe: 'chrome-pdf', chrome: { format: 'A4', marginTop: '10mm', marginBottom: '10mm', marginLeft: '10mm', marginRight: '10mm' } }, data: {} }),
  });
  if (!pdfRes.ok) throw new Error('PDF generation failed');
  const blob = await pdfRes.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${windowName}-${documentNo}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Reusable Send/Download modal for any document (invoice, order, quotation, shipment).
 *
 * Props:
 * - documentType: display label e.g. "Invoice", "Order", "Quotation", "Shipment"
 * - documentNo: document number
 * - bpName: business partner name
 * - bpEmail: pre-filled email (optional, falls back to fetched email if absent)
 * - bPartnerId: business partner record id; used to fetch etgoEmail from /contacts
 * - apiBaseUrl: NEO Headless API base URL (required if bPartnerId is provided)
 * - documentId: record ID for PDF rendering
 * - windowName: for report ID resolution (e.g. "sales-invoice")
 * - token: auth token
 * - onClose: callback to close modal
 *
 * pdfBlobUrl — optional blob URL from jsreport (e.g. from useInvoicePdf).
 * When provided, the preview uses it directly and download triggers on the blob,
 * bypassing the /api/reports render endpoint entirely.
 */
export default function SendDocumentModal({ documentType = 'Document', documentNo, bpName, bpEmail, bPartnerId, apiBaseUrl, documentId, windowName, token, onClose, pdfBlobUrl, pdfBlobLoading = false, isClosing = false, allowEmail = true }) {
  const ui = useUI();
  const hasEmail = bpEmail && bpEmail.includes('@');
  const [to, setTo] = useState(hasEmail ? bpEmail : '');
  const [emailLoading, setEmailLoading] = useState(false);
  const [contacts, setContacts] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [toPristine, setToPristine] = useState(true);

  // Fetch all contacts for the current BP to populate the "Para" search dropdown.
  useEffect(() => {
    if (!bPartnerId || !apiBaseUrl || !token) return;
    let cancelled = false;
    setEmailLoading(true);
    const contactsBaseUrl = apiBaseUrl.replace(/\/[^/]+$/, '/contacts');
    fetch(`${contactsBaseUrl}/businessPartner/${bPartnerId}`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled) return;
        const records = d?.response?.data ?? d?.data ?? [];
        const withEmail = records.filter(r => r?.etgoEmail?.includes('@'));
        setContacts(withEmail);
        if (!hasEmail && withEmail.length > 0) setTo(withEmail[0].etgoEmail);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setEmailLoading(false); });
    return () => { cancelled = true; };
  }, [hasEmail, bPartnerId, apiBaseUrl, token]);

  const q = to.toLowerCase();
  const filteredContacts = contacts.filter(c => contactMatchesQuery(c, q));

  const [subject, setSubject] = useState(`${documentType} #${documentNo} — ${bpName}`);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(!pdfBlobUrl);
  // True while the parent is still generating the blob via useInvoicePdf — suppress
  // the fallback report-render fetch and show a spinner instead of the error card.
  const waitingForBlob = pdfBlobLoading && !pdfBlobUrl;
  const [pdfError, setPdfError] = useState(null);
  const [downloading, setDownloading] = useState(false);

  const reportId = `print-${windowName}`;

  const iframeRef = useCallback(node => {
    if (!node) return;

    // If a pre-rendered blob URL is provided, use it directly
    if (pdfBlobUrl) {
      node.src = `${pdfBlobUrl}#toolbar=0&navpanes=0&scrollbar=1`;
      setPdfError(null);
      setPdfLoading(false);
      return;
    }

    // Parent indicated a blob is being generated — wait for it instead of falling
    // back to /api/reports which would set pdfError and show the sad-page card.
    if (pdfBlobLoading) {
      setPdfError(null);
      setPdfLoading(true);
      return;
    }

    if (!documentId || !token) return;
    renderPdfIntoIframe(node, reportId, documentId, token, setPdfLoading, setPdfError);
  }, [documentId, token, reportId, pdfBlobUrl, pdfBlobLoading]);

  const handleDownload = async () => {
    if (downloading) return;

    // If a blob URL is already available, download it directly
    if (pdfBlobUrl) {
      const a = document.createElement('a');
      a.href = pdfBlobUrl;
      a.download = `${windowName || 'invoice'}-${documentNo}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      return;
    }

    setDownloading(true);
    try {
      await fetchAndDownloadPdf(reportId, documentId, windowName, documentNo, token);
    } catch (err) {
      toast.error(err.message);
    }
    setDownloading(false);
  };

  const handleSend = () => {
    setSending(true);
    setTimeout(() => {
      toast.success(ui('sendModalSentSuccess', { documentType }));
      setSending(false);
      onClose();
    }, 800);
  };

  return (
    <>
      <style>{`
        @keyframes sfSlideDownIn { from { transform: translateY(-40px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes sfSlideUpOut  { from { transform: translateY(0); opacity: 1; } to { transform: translateY(-40px); opacity: 0; } }
        @keyframes sfSpin { to { transform: rotate(360deg); } }
      `}</style>
      <div onClick={onClose} className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
        <div onClick={e => e.stopPropagation()} style={{ width: 800, height: 560, display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRadius: 12, backgroundColor: '#fff', boxShadow: '0 8px 30px rgba(0,0,0,0.12)', border: '0.5px solid #E5E7EB', animation: isClosing ? 'sfSlideUpOut 280ms ease-in forwards' : 'sfSlideDownIn 280ms ease-out' }}>
          <div style={{ padding: '12px 16px', background: '#F5F5F5', borderBottom: '1px solid #E5E5E5', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Mail size={16} strokeWidth={1.5} color="#374151" />
              <span style={{ fontSize: 15, fontWeight: 600, color: '#111827' }}>{ui('sendModalTitle', { documentType, documentNo })}</span>
            </div>
            <button type="button" onClick={onClose} style={{ fontSize: 18, lineHeight: 1, padding: '2px 6px', borderRadius: 4, background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}>&times;</button>
          </div>

        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          <div style={{ width: allowEmail ? '60%' : '100%', display: 'flex', flexDirection: 'column', borderRight: allowEmail ? '0.5px solid #E5E7EB' : 'none' }}>
            <div style={{ flex: 1, position: 'relative', background: '#EFEFEF' }}>
              {pdfLoading && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontSize: 13, gap: 10 }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'sfSpin 0.9s linear infinite' }}>
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                  </svg>
                  <span>{ui('sendModalLoadingPreview')}</span>
                </div>
              )}
              {pdfError && !waitingForBlob && !pdfLoading && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', padding: 24, textAlign: 'center', gap: 8 }}>
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                  <span style={{ fontSize: 14, fontWeight: 500, color: '#6B7280' }}>{ui('sendModalPdfPreview')}</span>
                  <span style={{ fontSize: 13, color: '#9ca3af', maxWidth: 220 }}>{ui('sendModalPdfNotConfigured')}</span>
                </div>
              )}
              <iframe ref={iframeRef} style={{ width: '100%', height: '100%', border: 'none', opacity: pdfLoading ? 0 : 1 }} title="Document preview" />
            </div>
            <button
              type="button"
              onClick={handleDownload}
              disabled={downloading}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px 16px', background: '#fff', border: 'none', borderTop: '0.5px solid #E5E7EB', fontSize: 13, color: '#374151', cursor: downloading ? 'wait' : 'pointer', flexShrink: 0 }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              {downloading ? ui('sendModalDownloading') : ui('downloadPdf')}
            </button>
          </div>

          {allowEmail && (
          <div style={{ width: '40%', padding: 16, display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto' }}>
            <div style={{ position: 'relative' }}>
              <label style={{ fontSize: 12, fontWeight: 500, color: '#6B7280', display: 'block', marginBottom: 4 }}>{ui('sendModalTo')}</label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  value={to}
                  onChange={e => { setTo(e.target.value); setShowDropdown(true); setToPristine(false); }}
                  onFocus={() => { contacts.length > 0 && setShowDropdown(true); setToPristine(false); }}
                  onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
                  placeholder={emailLoading ? '' : 'email@company.com'}
                  style={{ width: '100%', fontSize: 13, padding: '8px 32px 8px 10px', border: `0.5px solid ${!isValidEmail(to) && !emailLoading && !toPristine && !showDropdown ? '#ef4444' : '#d1d5db'}`, borderRadius: 6, outline: 'none', color: '#111827', boxSizing: 'border-box' }}
                />
                <Search size={13} strokeWidth={1.5} color="#9ca3af" style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
              </div>
              {showDropdown && filteredContacts.length > 0 && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100, background: '#fff', border: '0.5px solid #d1d5db', borderRadius: 6, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', maxHeight: 160, overflowY: 'auto', marginTop: 2 }}>
                  {filteredContacts.map(c => (
                    <button
                      key={c.id}
                      type="button"
                      onMouseDown={() => { setTo(c.etgoEmail); setShowDropdown(false); }}
                      style={{ display: 'block', width: '100%', textAlign: 'left', padding: '7px 10px', fontSize: 12, color: '#111827', background: 'none', border: 'none', borderBottom: '0.5px solid #f3f4f6', cursor: 'pointer' }}
                      onMouseEnter={e => { e.currentTarget.style.background = '#F3F4F6'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}
                    >
                      {getContactLabel(c)}
                    </button>
                  ))}
                </div>
              )}
              {!isValidEmail(to) && !emailLoading && !toPristine && !showDropdown && (
                <span style={{ fontSize: 11, color: '#ef4444', marginTop: 3, display: 'block' }}>{ui('sendModalNoEmail')}</span>
              )}
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 500, color: '#6B7280', display: 'block', marginBottom: 4 }}>{ui('sendModalSubject')}</label>
              <input
                type="text"
                value={subject}
                onChange={e => setSubject(e.target.value)}
                style={{ width: '100%', fontSize: 13, padding: '8px 10px', border: '0.5px solid #d1d5db', borderRadius: 6, outline: 'none', color: '#111827', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <label style={{ fontSize: 12, fontWeight: 500, color: '#6B7280', display: 'block', marginBottom: 4 }}>{ui('sendModalMessage')}</label>
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder={ui('sendModalMessagePlaceholder')}
                style={{ width: '100%', flex: 1, minHeight: 80, fontSize: 13, padding: '8px 10px', border: '0.5px solid #d1d5db', borderRadius: 6, outline: 'none', color: '#111827', resize: 'none', boxSizing: 'border-box' }}
              />
            </div>
          </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: allowEmail ? 'space-between' : 'flex-end', background: '#F5F5F5', borderTop: '1px solid #E5E5E5', padding: '10px 16px', flexShrink: 0 }}>
          <button type="button" onClick={onClose} style={{ fontSize: 13, padding: '6px 14px', borderRadius: 6, border: '1px solid #E5E7EB', background: 'transparent', color: '#6B7280', cursor: 'pointer' }}>{allowEmail ? ui('cancel') : ui('close')}</button>
          {allowEmail && (
          <button
            type="button"
            onClick={handleSend}
            disabled={!isValidEmail(to) || sending}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 500, padding: '6px 16px', borderRadius: 6, border: 'none', background: '#18181b', color: '#fff', cursor: (!isValidEmail(to) || sending) ? 'not-allowed' : 'pointer', opacity: (!isValidEmail(to) || sending) ? 0.4 : 1 }}
          >
            {sending ? ui('sendModalSending') : (
              <>
                {ui('sendModalSend')}
                <Mail size={14} strokeWidth={1.5} />
              </>
            )}
          </button>
          )}
        </div>
      </div>
    </div>
    </>
  );
}

/**
 * Reusable Send button with instant tooltip. Place in topbarRight components.
 */
export function SendDocumentButton({ onClick }) {
  const ui = useUI();
  const label = ui('quickAction.email');
  return (
    <div style={{ position: 'relative' }} className="group">
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        className="flex items-center justify-center p-[7px] rounded-md bg-white border border-[#D1D4DB] shadow-[0px_1px_2px_0px_#1212170D] text-muted-foreground hover:bg-[#F1F5F9] hover:text-foreground transition-colors"
      >
        <Mail className="h-[15px] w-[15px]" />
      </button>
      <span className="pointer-events-none absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-zinc-800 px-2 py-1 text-[11px] text-white opacity-0 group-hover:opacity-100 transition-opacity" style={{ zIndex: 50 }}>
        {label}
      </span>
    </div>
  );
}
