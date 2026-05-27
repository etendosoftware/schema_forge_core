import { useState, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useUI } from '@/i18n';
import { ConfirmResultModal } from '@/components/contract-ui/ConfirmResultModal';
import CloneButton from '@/windows/custom/shared/CloneButton';
import CloneOrderModal from '@/components/contract-ui/CloneOrderModal';
import { generateReturnReceiptPdf, getReturnReceiptPdfLabels } from './useReturnReceiptPdf';

const overlayStyle = {
  position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 60,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  backgroundColor: 'rgba(0,0,0,0.3)',
};

const cardStyle = {
  width: 460, maxHeight: '85vh', display: 'flex', flexDirection: 'column',
  overflow: 'hidden', borderRadius: 12, backgroundColor: '#fff',
  boxShadow: '0 8px 30px rgba(0,0,0,0.12)', border: '0.5px solid #E5E7EB',
};

const btnPrimary = {
  padding: '5px 14px', borderRadius: 6, border: 'none',
  background: '#185FA5', color: '#fff', fontWeight: 500, fontSize: 13,
  cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
};

const btnSecondary = {
  fontSize: 12, padding: '7px 14px', borderRadius: 6,
  border: '1px solid #D1D5DB', background: 'transparent', color: '#6B7280', cursor: 'pointer',
};

const closeBtn = {
  fontSize: 18, lineHeight: 1, padding: '2px 6px', borderRadius: 4,
  background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF',
};

function Spinner() {
  return (
    <>
      <svg style={{ width: 14, height: 14, animation: 'spin 1s linear infinite', flexShrink: 0 }}
        viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
      </svg>
      <style>{`@keyframes spin { from { transform:rotate(0deg) } to { transform:rotate(360deg) } }`}</style>
    </>
  );
}

const fmtNum = (v) =>
  Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function ConfirmWithCreditButton({ data, recordId, token, apiBaseUrl }) {
  const ui = useUI();
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);
  const [createInvoice, setCreateInvoice] = useState(true);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [cloneOpen, setCloneOpen] = useState(false);

  const status = data?.documentStatus;
  const currency = data?.['currency$_identifier'] || '';
  const headers = useMemo(() => ({
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  }), [token]);

  const [pdfLoading, setPdfLoading] = useState(false);
  const pdfLabels = getReturnReceiptPdfLabels(ui);

  const handlePrint = useCallback(async () => {
    if (pdfLoading) return;
    setPdfLoading(true);
    try {
      const blob = await generateReturnReceiptPdf(data?.id || recordId, apiBaseUrl, token, pdfLabels);
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    } catch (err) {
      toast.error(err.message || ui('failedToGeneratePdf'));
    } finally {
      setPdfLoading(false);
    }
  }, [pdfLoading, data, recordId, apiBaseUrl, token, pdfLabels, ui]);

  const callCreateInvoice = useCallback(async (id) => {
    const res = await fetch(`${apiBaseUrl}/returnMaterialReceipt/${id}/action/createReturnInvoice`, {
      method: 'POST', headers, body: JSON.stringify({}),
    });
    if (!res.ok) throw new Error(ui('couldNotCreateReturnInvoice'));
    const body = await res.json();
    const inv = body?.response?.data;
    return { id: inv?.id || null, documentNo: inv?.documentNo || '', grandTotal: inv?.grandTotal ?? null };
  }, [apiBaseUrl, headers, ui]);

  const handleConfirmAndClose = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      const id = data?.id || recordId;

      const docRes = await fetch(`${apiBaseUrl}/returnMaterialReceipt/${id}/action/documentAction`, {
        method: 'POST', headers, body: JSON.stringify({ docAction: 'CO' }),
      });
      if (!docRes.ok) {
        const payload = await docRes.json().catch(() => null);
        throw new Error(payload?.response?.message || payload?.message || ui('couldNotConfirmReceipt'));
      }

      setShowModal(false);

      if (createInvoice) {
        const inv = await callCreateInvoice(id);
        setResult({
          title: ui('rmrInvoiceCreatedTitle'),
          cards: inv.id ? [{
            route: `/sales-invoice/${inv.id}`,
            icon: '🧾',
            label: ui('rmrReturnInvoiceDoc').replace('{number}', inv.documentNo),
            amount: inv.grandTotal,
            color: 'green',
          }] : [],
        });
      } else {
        setResult({ title: ui('receiptConfirmed'), cards: [] });
      }
    } catch (err) {
      toast.error(err.message || ui('couldNotConfirmReceipt'));
    } finally {
      setBusy(false);
    }
  }, [busy, data, recordId, apiBaseUrl, headers, createInvoice, callCreateInvoice, ui]);

  if (status === 'DR') {
    return (
      <>
        <button
          type="button"
          data-testid="action-confirm-with-credit"
          onClick={() => setShowModal(true)}
          style={{
            fontSize: 14, fontWeight: 500, padding: '8px 18px', borderRadius: 8,
            background: '#18181b', color: '#fff', border: 'none', cursor: 'pointer',
            lineHeight: 1.4,
          }}
        >
          {ui('processReceipt')}
        </button>
        <PrintButton onClick={handlePrint} loading={pdfLoading} ui={ui} />

        {showModal && createPortal(
          <div
            onClick={() => !busy && setShowModal(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.3)' }}
          >
            <div
              onClick={e => e.stopPropagation()}
              style={{ width: 420, borderRadius: 12, background: '#fff', boxShadow: '0 8px 30px rgba(0,0,0,0.12)', border: '0.5px solid #E5E7EB', padding: '24px' }}
            >
              <h3 style={{ fontSize: 15, fontWeight: 600, margin: '0 0 6px', color: '#111827' }}>
                {ui('manageCreditTitle')}
              </h3>
              <p style={{ fontSize: 13, color: '#6B7280', margin: '0 0 18px', lineHeight: 1.5 }}>
                {ui('manageCreditDescription')}
              </p>

              <label
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer',
                  padding: '12px 14px', borderRadius: 8,
                  border: `1px solid ${createInvoice ? '#93c5fd' : '#E5E7EB'}`,
                  background: createInvoice ? '#eff6ff' : '#fff',
                  transition: 'all 0.15s',
                }}
              >
                <input
                  type="checkbox"
                  checked={createInvoice}
                  onChange={e => setCreateInvoice(e.target.checked)}
                  style={{ accentColor: '#3b82f6', marginTop: 3, flexShrink: 0 }}
                />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: '#111827' }}>
                    {ui('createReturnInvoice')}
                  </div>
                  <div style={{ fontSize: 12, color: '#6B7280', marginTop: 3, lineHeight: 1.4 }}>
                    {ui('createReturnInvoiceDescription')}
                  </div>
                </div>
              </label>

              <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  disabled={busy}
                  style={{ fontSize: 13, padding: '7px 16px', borderRadius: 6, border: '1px solid #E5E7EB', background: '#fff', color: '#6B7280', cursor: busy ? 'not-allowed' : 'pointer' }}
                >
                  {ui('cancel')}
                </button>
                <button
                  type="button"
                  onClick={handleConfirmAndClose}
                  disabled={busy}
                  style={{ fontSize: 13, fontWeight: 500, padding: '7px 16px', borderRadius: 6, border: 'none', background: '#18181b', color: '#fff', cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.7 : 1 }}
                >
                  {busy ? ui('confirming') : ui('confirm')}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

        {result && createPortal(
          <ConfirmResultModal
            title={result.title}
            cards={result.cards}
            currency={currency}
            navigate={navigate}
            ui={ui}
            onClose={() => setResult(null)}
          />,
          document.body,
        )}
      </>
    );
  }

  if (status === 'CO') {
    const hasReturnInvoice = Array.isArray(data?.returnInvoices) ? data.returnInvoices.length > 0 : data?.hasReturnInvoice === true;
    const handleCreateConfirmed = async () => {
      if (busy) return;
      setBusy(true);
      try {
        const inv = await callCreateInvoice(data?.id || recordId);
        setShowModal(false);
        setResult({
          title: ui('rmrInvoiceCreatedTitle'),
          cards: inv.id ? [{
            route: `/sales-invoice/${inv.id}`,
            icon: '🧾',
            label: ui('rmrReturnInvoiceDoc').replace('{number}', inv.documentNo),
            amount: inv.grandTotal,
            color: 'green',
          }] : [],
        });
      } catch (err) {
        toast.error(err.message);
      } finally {
        setBusy(false);
      }
    };

    return (
      <>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {!hasReturnInvoice && (
            <button
              type="button"
              data-testid="action-create-return-invoice"
              onClick={() => setShowModal(true)}
              style={{
                padding: '5px 14px', borderRadius: 6, border: 'none',
                background: '#185FA5', color: '#fff', fontWeight: 500, fontSize: 13,
                cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5,
              }}
            >
              {ui('createReturnInvoice')}
            </button>
          )}
          <CloneButton onClick={() => setCloneOpen(true)} title={ui('cloneOrderBtn')} />
          <PrintButton onClick={handlePrint} loading={pdfLoading} ui={ui} />
        </div>

        {showModal && createPortal(
          <div onClick={() => !busy && setShowModal(false)} style={overlayStyle}>
            <div onClick={e => e.stopPropagation()} style={cardStyle}>

              {/* Title row */}
              <div style={{ padding: '16px 20px 14px', borderBottom: '0.5px solid #E5E7EB', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: '#111827' }}>
                  {ui('createReturnInvoice')}
                </div>
                <button type="button" onClick={() => setShowModal(false)} style={closeBtn}>&times;</button>
              </div>

              {/* Blue summary card */}
              <div style={{ padding: '14px 20px' }}>
                <div style={{ background: '#E6F1FB', border: '0.5px solid #B5D4F4', borderRadius: 10, padding: '14px 16px' }}>
                  {data?.['businessPartner$_identifier'] && (
                    <div style={{ fontSize: 11, color: '#185FA5' }}>
                      {data['businessPartner$_identifier']}
                    </div>
                  )}
                  {data?.documentNo && (
                    <div style={{ fontSize: 22, fontWeight: 500, color: '#042C53', lineHeight: 1, marginTop: 4 }}>
                      #{data.documentNo}
                    </div>
                  )}
                </div>
              </div>

              {/* Description */}
              <div style={{ padding: '0 20px 16px' }}>
                <p style={{ fontSize: 13, color: '#6B7280', margin: 0, lineHeight: 1.5 }}>
                  {ui('rmrCreateInvoiceConfirmDesc')}
                </p>
              </div>

              {/* Footer */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 20px', borderTop: '0.5px solid #E5E7EB' }}>
                <button type="button" onClick={() => setShowModal(false)} disabled={busy}
                  style={{ ...btnSecondary, opacity: busy ? 0.5 : 1 }}>
                  {ui('cancel')}
                </button>
                <button type="button" onClick={handleCreateConfirmed} disabled={busy}
                  style={{ ...btnPrimary, opacity: busy ? 0.6 : 1, cursor: busy ? 'not-allowed' : 'pointer' }}>
                  {busy && <Spinner />}
                  {busy ? ui('creating') : ui('createReturnInvoice')}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}

        {result && createPortal(
          <ConfirmResultModal
            title={result.title}
            cards={result.cards}
            currency={currency}
            navigate={navigate}
            ui={ui}
            onClose={() => setResult(null)}
          />,
          document.body,
        )}

        {cloneOpen && createPortal(
          <CloneOrderModal
            recordId={data?.id || recordId}
            data={data}
            apiBaseUrl={apiBaseUrl}
            headers={headers}
            headerEntity="returnMaterialReceipt"
            routePrefix="/return-material-receipt/"
            onClose={() => setCloneOpen(false)}
          />,
          document.body,
        )}

      </>
    );
  }

  return null;
}

function PrintButton({ onClick, loading, ui }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="inline-flex items-center gap-1.5 text-[13px] font-medium border border-border text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
      style={{ padding: '4px 12px', borderRadius: '6px', borderWidth: '1px', opacity: loading ? 0.6 : 1, cursor: loading ? 'not-allowed' : 'pointer', border: '1px solid #D1D5DB', background: 'transparent', color: '#6B7280', fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 5 }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 9V2h12v7" /><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2" /><rect x="6" y="14" width="12" height="8" />
      </svg>
      {ui('print')}
    </button>
  );
}
