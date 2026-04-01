import { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';

/**
 * InvoiceBillingAddress — contextual billing address below the BP field.
 *
 * Rendered via formFooter but uses a portal to inject itself under the
 * Business Partner field (found via data-testid="field-businessPartner").
 *
 * Props from DetailView: { data, onChange, catalogs, api, token, apiBaseUrl }
 */
export default function InvoiceBillingAddress({ data, onChange, api, token, apiBaseUrl }) {
  const [addresses, setAddresses] = useState([]);
  const [showPicker, setShowPicker] = useState(false);
  const [portalTarget, setPortalTarget] = useState(null);
  const containerRef = useRef(null);

  const bpId = data?.businessPartner;
  const currentAddressId = data?.partnerAddress;
  const currentAddressName = data?.['partnerAddress$_identifier'] || '';

  const base = useMemo(() => (apiBaseUrl || '').replace(/\/[^/]+$/, ''), [apiBaseUrl]);

  // Find the BP field in the DOM and create a portal target below it
  useEffect(() => {
    const bpField = document.querySelector('[data-testid="field-businessPartner"]');
    if (!bpField) return;

    // Check if we already injected a container
    const existingContainer = bpField.parentElement?.querySelector('[data-billing-address]');
    if (existingContainer) {
      setPortalTarget(existingContainer);
      return;
    }

    // Create container and append after the BP field wrapper
    const container = document.createElement('div');
    container.setAttribute('data-billing-address', 'true');
    bpField.parentElement?.appendChild(container);
    setPortalTarget(container);

    return () => {
      // Cleanup on unmount
      if (container.parentElement) container.parentElement.removeChild(container);
    };
  }, [bpId]); // re-run when BP changes

  // Fetch addresses for the current BP
  useEffect(() => {
    if (!bpId || !token || !base) { setAddresses([]); return; }
    (async () => {
      try {
        const url = `${base}/sales-invoice/header/selectors/partnerAddress?C_BPartner_ID=${bpId}&_startRow=0&_endRow=50`;
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        });
        if (res.ok) {
          const json = await res.json();
          const items = json.items || json?.response?.data || [];
          setAddresses(items.map(a => ({ id: a.id, name: a.label || a._identifier || a.name })));
        }
      } catch { /* silent */ }
    })();
  }, [bpId, token, base]);

  if (!portalTarget) return null;
  if (!currentAddressName && addresses.length === 0) return null;

  const hasMultiple = addresses.length > 1;

  const handleChange = (newId) => {
    if (onChange) onChange('partnerAddress', newId);
    setShowPicker(false);
  };

  const pinIcon = (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );

  const content = (
    <div style={{ marginTop: 4, position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        {pinIcon}
        <span style={{ fontSize: 13, color: '#374151' }}>
          {currentAddressName || 'No billing address'}
        </span>
        {hasMultiple && (
          <button
            type="button"
            onClick={() => setShowPicker(p => !p)}
            className="hover:underline"
            style={{ fontSize: 12, fontWeight: 500, color: '#3b82f6', background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginLeft: 2 }}
          >
            {showPicker ? 'Close' : 'Change \u2192'}
          </button>
        )}
      </div>

      {showPicker && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            marginTop: 4,
            background: '#fff',
            border: '1px solid #E5E7EB',
            borderRadius: 8,
            boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
            zIndex: 20,
            minWidth: 260,
            maxWidth: 360,
            padding: '4px 0',
          }}
        >
          {addresses.map(addr => {
            const isCurrent = addr.id === currentAddressId;
            return (
              <button
                key={addr.id}
                type="button"
                onClick={() => handleChange(addr.id)}
                className="transition-colors"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  width: '100%',
                  fontSize: 13,
                  color: isCurrent ? '#111827' : '#4B5563',
                  fontWeight: isCurrent ? 500 : 400,
                  background: isCurrent ? '#F3F4F6' : 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '8px 12px',
                  textAlign: 'left',
                }}
                onMouseEnter={e => { if (!isCurrent) e.currentTarget.style.background = '#F9FAFB'; }}
                onMouseLeave={e => { if (!isCurrent) e.currentTarget.style.background = 'transparent'; }}
              >
                {isCurrent && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
                {!isCurrent && <span style={{ width: 14, flexShrink: 0 }} />}
                {addr.name}
              </button>
            );
          })}
        </div>
      )}

      {/* Backdrop to close dropdown */}
      {showPicker && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 19 }}
          onClick={() => setShowPicker(false)}
        />
      )}
    </div>
  );

  return createPortal(content, portalTarget);
}
