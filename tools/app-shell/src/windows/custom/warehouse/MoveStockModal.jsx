import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useUI } from '@schema-forge/app-shell-core';

async function fetchJson(url, token) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  const json = await res.json();
  return json?.response?.data ?? json?.data ?? [];
}

async function postJson(url, token, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `${res.status} ${res.statusText}`);
  }
  return res.json();
}

async function runTransfer({ apiBaseUrl, token, product, currentWarehouseId, destinationId, qty, organizationId, description }) {
  const neoBase = apiBaseUrl.replace(/\/[^/]+$/, ''); // /sws/neo

  // 1. Fetch source and destination storage bins in parallel
  const [sourceBins, destBins] = await Promise.all([
    fetchJson(`${apiBaseUrl}/storageBin?parentId=${currentWarehouseId}&_startRow=0&_endRow=1`, token),
    fetchJson(`${apiBaseUrl}/storageBin?parentId=${destinationId}&_startRow=0&_endRow=1`, token),
  ]);

  if (sourceBins.length === 0) throw new Error('No storage bin found in source warehouse');
  if (destBins.length === 0) throw new Error('No storage bin found in destination warehouse');

  const sourceBinId = sourceBins[0].id;
  const destBinId = destBins[0].id;

  // 2. Create movement header
  const today = new Date().toISOString().slice(0, 10);
  const movementName = `Transfer: ${product.label}`.slice(0, 60);

  const movementBody = {
    movementDate: today,
    name: movementName,
  };
  if (organizationId) movementBody.organization = organizationId;
  if (description) movementBody.description = description;

  const movementResult = await postJson(`${neoBase}/goods-movements/movement`, token, movementBody);
  const movementData = movementResult?.response?.data ?? movementResult?.data ?? movementResult;
  const movementId = Array.isArray(movementData) ? movementData[0]?.id : movementData?.id;

  if (!movementId) throw new Error('Movement creation did not return an ID');

  // 3. Create movement line
  const lineBody = {
    movement: movementId,
    lineNo: 10,
    product: product.id,
    storageBin: sourceBinId,
    newStorageBin: destBinId,
    movementQuantity: qty,
  };
  if (description) lineBody.description = description;
  await postJson(`${neoBase}/goods-movements/movementLine`, token, lineBody);

  // 4. Process the movement (M_Movement_Post — no parameters needed)
  await postJson(`${neoBase}/goods-movements/movement/${movementId}/action/processNow`, token, {});
}

export default function MoveStockModal({ product, currentWarehouseId, data, token, apiBaseUrl, onSuccess, onClose }) {
  const ui = useUI();
  const [warehouses, setWarehouses] = useState([]);
  const [loadingWarehouses, setLoadingWarehouses] = useState(true);
  const [destinationId, setDestinationId] = useState('');
  const [qty, setQty] = useState(product.qty);
  const [description, setDescription] = useState('');
  const [transferring, setTransferring] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const all = await fetchJson(`${apiBaseUrl}/warehouse?_startRow=0&_endRow=200`, token);
        const others = all.filter(w => w.id !== currentWarehouseId);
        if (!cancelled) {
          setWarehouses(others);
          if (others.length > 0) setDestinationId(others[0].id);
        }
      } catch {
        // shown via warehouseMoveNoWarehouses
      } finally {
        if (!cancelled) setLoadingWarehouses(false);
      }
    })();
    return () => { cancelled = true; };
  }, [apiBaseUrl, token, currentWarehouseId]);

  const handleTransfer = async () => {
    if (transferring) return;
    setTransferring(true);
    try {
      const organizationId = data?.organization?.id ?? data?.organization ?? null;
      await runTransfer({ apiBaseUrl, token, product, currentWarehouseId, destinationId, qty, organizationId, description });
      toast.success(ui('warehouseMoveSuccess'));
      onSuccess?.();
      onClose();
    } catch (err) {
      toast.error(ui('warehouseMoveError').replace('{error}', err.message));
    } finally {
      setTransferring(false);
    }
  };

  const maxQty = product.qty;
  const canTransfer = destinationId && qty > 0 && qty <= maxQty && !transferring;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 420, borderRadius: 12, overflow: 'hidden',
          backgroundColor: '#fff', boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
          border: '0.5px solid #E5E7EB',
        }}
      >
        {/* Header */}
        <div style={{ padding: '14px 16px', borderBottom: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>{ui('warehouseMoveTitle')}</span>
          <button
            type="button"
            onClick={onClose}
            disabled={transferring}
            style={{ fontSize: 18, lineHeight: 1, padding: '2px 6px', borderRadius: 4, background: 'none', border: 'none', cursor: transferring ? 'not-allowed' : 'pointer', color: '#6B7280' }}
          >
            &times;
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Product — readonly */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#6B7280', marginBottom: 4 }}>
              {ui('warehouseProduct')}
            </label>
            <div style={{ fontSize: 14, color: '#111827', padding: '8px 10px', borderRadius: 6, background: '#F9FAFB', border: '0.5px solid #E5E7EB' }}>
              {product.label}
              <span style={{ marginLeft: 8, fontSize: 12, color: '#9CA3AF' }}>{product.uom}</span>
            </div>
          </div>

          {/* Destination warehouse */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#6B7280', marginBottom: 4 }}>
              {ui('warehouseMoveDestinationLabel')}
            </label>
            {loadingWarehouses ? (
              <div style={{ fontSize: 13, color: '#9CA3AF', padding: '8px 10px' }}>{ui('warehouseMoveLoadingWarehouses')}</div>
            ) : warehouses.length === 0 ? (
              <div style={{ fontSize: 13, color: '#9CA3AF', padding: '8px 10px' }}>{ui('warehouseMoveNoWarehouses')}</div>
            ) : (
              <select
                value={destinationId}
                onChange={e => setDestinationId(e.target.value)}
                disabled={transferring}
                style={{
                  width: '100%', fontSize: 14, padding: '8px 10px', borderRadius: 6,
                  border: '0.5px solid #D1D5DB', background: '#fff', color: '#111827', outline: 'none',
                }}
              >
                {warehouses.map(w => (
                  <option key={w.id} value={w.id}>{w.name || w['name$_identifier'] || w.id}</option>
                ))}
              </select>
            )}
          </div>

          {/* Quantity */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#6B7280', marginBottom: 4 }}>
              {ui('warehouseMoveQtyLabel')}
              <span style={{ marginLeft: 6, fontWeight: 400, color: '#9CA3AF' }}>
                {ui('warehouseMoveQtyMax', { n: maxQty.toFixed(2) })}
              </span>
            </label>
            <input
              type="number"
              min={0}
              max={maxQty}
              step="any"
              value={qty}
              disabled={transferring}
              onChange={e => {
                const v = parseFloat(e.target.value);
                setQty(isNaN(v) ? 0 : Math.max(0, Math.min(maxQty, v)));
              }}
              style={{
                width: '100%', fontSize: 14, padding: '8px 10px', borderRadius: 6,
                border: '0.5px solid #D1D5DB', background: '#fff', color: '#111827',
                outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>
          {/* Description — optional */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#6B7280', marginBottom: 4 }}>
              {ui('description')}
              <span style={{ marginLeft: 4, fontWeight: 400, color: '#9CA3AF' }}>({ui('optional')})</span>
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              disabled={transferring}
              rows={2}
              style={{
                width: '100%', fontSize: 14, padding: '8px 10px', borderRadius: 6,
                border: '0.5px solid #D1D5DB', background: '#fff', color: '#111827',
                outline: 'none', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit',
              }}
            />
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 16px', borderTop: '1px solid #E5E7EB', background: '#F8F9FA' }}>
          <button
            type="button"
            onClick={onClose}
            disabled={transferring}
            style={{ fontSize: 13, padding: '6px 14px', borderRadius: 6, border: '1px solid #E5E7EB', background: 'transparent', color: '#6B7280', cursor: transferring ? 'not-allowed' : 'pointer', opacity: transferring ? 0.5 : 1 }}
          >
            {ui('cancel')}
          </button>
          <button
            type="button"
            onClick={handleTransfer}
            disabled={!canTransfer}
            style={{
              fontSize: 13, fontWeight: 500, padding: '6px 16px', borderRadius: 6,
              border: 'none', background: '#18181b', color: '#fff',
              cursor: canTransfer ? 'pointer' : 'not-allowed',
              opacity: canTransfer ? 1 : 0.4,
            }}
          >
            {transferring ? ui('warehouseMoveTransferring') : ui('warehouseMoveConfirm')}
          </button>
        </div>
      </div>
    </div>
  );
}
