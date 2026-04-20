import React, { useState } from 'react';
import { useLookup } from '../hooks/useLookup.js';

const BP_LOOKUP_PATH = '/neo/bp-location/business-partner';

export default function OrderForm({ shell, cfg, onSave }) {
  const [bpId, setBpId] = useState('');
  const [orderDate, setOrderDate] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const bps = useLookup(shell, { path: BP_LOOKUP_PATH, criteria: cfg.bpCriteria });

  async function handleSave(e) {
    e.preventDefault();
    if (!bpId) { setError('Select a business partner'); return; }
    setSaving(true); setError(null);
    try {
      const body = {
        data: {
          businessPartner: bpId,
          orderDate,
          documentStatus: 'DR', // Draft
        },
      };
      const result = await shell.fetch(cfg.headerPath, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      onSave?.(result.response?.data?.[0]?.id || null);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSave} style={{ display: 'grid', gap: 12, maxWidth: 480 }}>
      <label style={{ display: 'grid', gap: 4 }}>
        <span>Business partner</span>
        <select value={bpId} onChange={(e) => setBpId(e.target.value)} disabled={bps.loading}>
          <option value="">— select —</option>
          {bps.items.map((bp) => (
            <option key={bp.id} value={bp.id}>{bp._identifier || bp.name}</option>
          ))}
        </select>
      </label>
      <label style={{ display: 'grid', gap: 4 }}>
        <span>Order date</span>
        <input type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} />
      </label>
      {error && <div style={{ color: '#b91c1c' }}>{error}</div>}
      <button type="submit" disabled={saving}>
        {saving ? 'Saving…' : 'Save draft'}
      </button>
    </form>
  );
}
