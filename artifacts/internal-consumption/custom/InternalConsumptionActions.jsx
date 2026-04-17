import { useState } from 'react';
import { toast } from 'sonner';
import { useUI } from '@/i18n';

/**
 * moreMenuContent for Internal Consumption.
 * Renders a "Process" menu item that calls M_Internal_Consumption_Post with { action: 'CO' }.
 * Only shown when status is not Voided ('VO').
 */
export default function InternalConsumptionActions({ data, recordId, token, apiBaseUrl, onClose, onRefresh }) {
  const ui = useUI();
  const [processing, setProcessing] = useState(false);

  // Hide if already voided
  if (data?.status === 'VO') return null;

  const handleProcess = async () => {
    if (processing) return;
    setProcessing(true);
    try {
      const res = await fetch(`${apiBaseUrl}/internalConsumption/${recordId}/action/processNow`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'CO' }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(text || `${res.status} ${res.statusText}`);
      }
      toast.success(ui('internalConsumptionProcessed'));
      onRefresh?.();
      onClose();
    } catch (err) {
      toast.error(ui('internalConsumptionProcessError').replace('{error}', err.message));
    } finally {
      setProcessing(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleProcess}
      disabled={processing}
      style={{
        display: 'flex', alignItems: 'center', gap: 8, width: '100%',
        padding: '8px 12px', background: 'none', border: 'none',
        textAlign: 'left', cursor: processing ? 'not-allowed' : 'pointer',
        fontSize: 13, color: processing ? '#9CA3AF' : '#111827',
        opacity: processing ? 0.6 : 1,
      }}
      onMouseEnter={e => { if (!processing) e.currentTarget.style.background = '#F3F4F6'; }}
      onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}
    >
      <span style={{ fontSize: 14 }}>✓</span>
      {processing ? ui('internalConsumptionProcessing') : ui('internalConsumptionProcess')}
    </button>
  );
}
