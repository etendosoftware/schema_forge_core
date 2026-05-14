import { useState, useMemo } from 'react';
import { useUI } from '@/i18n';
import { useFiscalConfig } from '@/windows/custom/fiscal-config/useFiscalConfig.js';
import { useAuth } from '@/auth/AuthContext';
import { getPendingSifTargets, getSifBodyKey } from './sifSending.js';
import SifSendingModal from './SifSendingModal.jsx';

export default function SendToSifButton({ data, recordId, token, apiBaseUrl, status }) {
  const ui = useUI();
  const [modalOpen, setModalOpen] = useState(false);
  const specName = apiBaseUrl?.split('/').filter(Boolean).pop() || 'sales-invoice';
  const updateEventName = `${specName}:invoice-updated`;

  const { selectedOrg } = useAuth();
  const orgId = selectedOrg?.id ?? null;
  const base = useMemo(() => (apiBaseUrl || '').replace(/\/[^/]+$/, ''), [apiBaseUrl]);
  const headers = useMemo(() => ({
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  }), [token]);

  const { profile } = useFiscalConfig(orgId, apiBaseUrl);
  const pendingTargets = getPendingSifTargets(specName, profile, data);
  const hasPendingTargets = pendingTargets.sendSii || pendingTargets.sendTbai;

  if (status !== 'CO' || !hasPendingTargets) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setModalOpen(true)}
        className="inline-flex items-center gap-1.5 text-[13px] font-medium hover:opacity-80 cursor-pointer h-9"
        style={{ padding: '0 12px', borderRadius: '8px', border: '1px solid #e2e8f0', color: '#374151', background: '#fff' }}
      >
        {ui('sendToSif')}
      </button>

      {modalOpen && (
        <SifSendingModal
          pendingTargets={pendingTargets}
          bodyKey={getSifBodyKey(pendingTargets)}
          base={base}
          specName={specName}
          recordId={recordId}
          headers={headers}
          onClose={() => setModalOpen(false)}
          onAfterSend={(next) => {
            if (Object.values(next).some(r => r?.ok)) {
              window.dispatchEvent(new CustomEvent(updateEventName, { detail: { invoiceId: recordId } }));
            }
          }}
        />
      )}
    </>
  );
}
