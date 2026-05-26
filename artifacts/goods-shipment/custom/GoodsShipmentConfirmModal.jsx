import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useUI } from '@/i18n';

function Spinner() {
  return (
    <>
      <svg
        style={{ width: 14, height: 14, animation: 'spin 1s linear infinite', flexShrink: 0 }}
        viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      >
        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
      </svg>
      <style>{`@keyframes spin { from { transform:rotate(0deg) } to { transform:rotate(360deg) } }`}</style>
    </>
  );
}

function SoCheckboxCard({ checked, onChange, icon, title, subtitle, disabled }) {
  return (
    <div
      onClick={disabled ? undefined : onChange}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: checked ? '11px 13px' : '12px 14px', borderRadius: 8,
        cursor: disabled ? 'default' : 'pointer',
        border: disabled ? '2px solid #10B981' : (checked ? '2px solid #3B82F6' : '1px solid #E5E7EB'),
        background: disabled ? '#ECFDF5' : (checked ? '#EFF6FF' : '#fff'),
        opacity: disabled ? 0.85 : 1,
        transition: 'border-color 0.15s, background 0.15s',
      }}
    >
      <span style={{ fontSize: 15, lineHeight: 1, flexShrink: 0 }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: disabled ? '#059669' : (checked ? '#2563EB' : '#111827') }}>
          {title}
        </div>
        <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 3, lineHeight: 1.4 }}>
          {subtitle}
        </div>
      </div>
      <div style={{
        width: 18, height: 18, borderRadius: 4, flexShrink: 0,
        border: (checked || disabled) ? 'none' : '1.5px solid #D1D5DB',
        background: disabled ? '#10B981' : (checked ? '#3B82F6' : '#fff'),
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'background 0.15s',
      }}>
        {(checked || disabled) && (
          <svg width="11" height="9" viewBox="0 0 11 9" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="1 4 4 7.5 10 1" />
          </svg>
        )}
      </div>
    </div>
  );
}

export default function GoodsShipmentConfirmModal({ base, headers, recordId, onConfirmed, onClose }) {
  const ui = useUI();
  const [createInvoice, setCreateInvoice] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleConfirm = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `${base}/goods-shipment/goodsShipment/${recordId}/action/documentAction`,
        { method: 'POST', headers, body: JSON.stringify({ docAction: 'CO' }) },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.response?.message || body?.message || `Error (${res.status})`);
      }

      let invoice = null;
      if (createInvoice) {
        const linesRes = await fetch(
          `${base}/goods-shipment/goodsShipmentLine?parentId=${recordId}&_startRow=0&_endRow=200`,
          { headers },
        );
        const lines = linesRes.ok ? (await linesRes.json())?.response?.data || [] : [];
        const payload = lines.map(l => ({
          shipmentLineId: l.id,
          quantity: String(l.movementQuantity || 0),
        }));
        const body = payload.length > 0 ? { lines: payload } : {};
        const invRes = await fetch(
          `${base}/goods-shipment/goodsShipment/${recordId}/action/createDraftInvoice`,
          { method: 'POST', headers, body: JSON.stringify(body) },
        );
        if (!invRes.ok) {
          const err = await invRes.json().catch(() => null);
          throw new Error(err?.response?.message || err?.message || `Error (${invRes.status})`);
        }
        const invJson = await invRes.json();
        const invData = invJson?.response?.data;
        invoice = { id: invData?.id ?? null, documentNo: invData?.documentNo || '', amount: invData?.grandTotalAmount ?? null };
      }

      onConfirmed({ invoice });
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return createPortal(
    <div onClick={onClose} style={overlayStyle}>
      <div onClick={e => e.stopPropagation()} style={{ ...cardStyle, width: 460 }}>

        <div style={{ padding: '16px 20px 14px', borderBottom: '0.5px solid #E5E7EB', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#111827' }}>
            {ui('shipmentConfirmModalTitle')}
          </div>
          <button type="button" onClick={onClose} style={closeBtnStyle}>&times;</button>
        </div>

        <div style={{ padding: '16px 20px 8px' }}>
          <p style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.5, margin: 0 }}>
            {ui('shipmentConfirmModalDesc')}
          </p>
        </div>

        <div style={{ padding: '8px 20px 16px' }}>
          <SoCheckboxCard
            checked={createInvoice}
            onChange={() => setCreateInvoice(v => !v)}
            icon="🧾"
            title={ui('shipmentConfirmCardTitle')}
            subtitle={ui('shipmentConfirmCardSubtitle')}
          />
        </div>

        {error && (
          <div style={{ padding: '8px 20px', fontSize: 12, color: '#DC2626', background: '#FEF2F2', borderTop: '0.5px solid #FECACA' }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 20px', borderTop: '0.5px solid #E5E7EB' }}>
          <button type="button" onClick={onClose} disabled={loading} style={{ ...btnSecondaryStyle, opacity: loading ? 0.5 : 1 }}>
            {ui('cancel')}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={loading}
            style={{ ...btnPrimaryStyle, opacity: loading ? 0.6 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}
          >
            {loading && <Spinner />}
            {ui('Confirm')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

const overlayStyle = {
  position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 50,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  backgroundColor: 'rgba(0,0,0,0.3)',
};

const cardStyle = {
  width: 480, maxHeight: '85vh', display: 'flex', flexDirection: 'column',
  overflow: 'hidden', borderRadius: 12, backgroundColor: '#fff',
  boxShadow: '0 8px 30px rgba(0,0,0,0.12)', border: '0.5px solid #E5E7EB',
};

const btnPrimaryStyle = {
  padding: '5px 14px', borderRadius: 6, border: 'none',
  background: '#185FA5', color: '#fff', fontWeight: 500, fontSize: 13,
  cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5,
};

const btnSecondaryStyle = {
  fontSize: 12, padding: '7px 14px', borderRadius: 6,
  border: '1px solid #D1D5DB', background: 'transparent', color: '#6B7280', cursor: 'pointer',
};

const closeBtnStyle = {
  fontSize: 18, lineHeight: 1, padding: '2px 6px', borderRadius: 4,
  background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF',
};
