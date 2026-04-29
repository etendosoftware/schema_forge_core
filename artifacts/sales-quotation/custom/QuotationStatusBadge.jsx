import { useUI } from '@/i18n';

const STATUS_CONFIG = {
  DR:      { key: 'statusDraft',           dot: '#9CA3AF', bg: '#F3F4F6', text: '#6B7280', border: '#E5E7EB' },
  UE:      { key: 'statusUnderEvaluation', dot: '#F59E0B', bg: '#FEF3C7', text: '#92400E', border: '#FDE68A' },
  CO:      { key: 'statusComplete',        dot: '#10B981', bg: '#ECFDF5', text: '#059669', border: '#A7F3D0' },
  CA:      { key: 'statusOrderCreated',    dot: '#10B981', bg: '#ECFDF5', text: '#059669', border: '#A7F3D0' },
  ETGO_CI: { key: 'statusInvoiceCreated',  dot: '#10B981', bg: '#ECFDF5', text: '#059669', border: '#A7F3D0' },
  CL:      { key: 'statusClosed',          dot: '#8B5CF6', bg: '#F5F3FF', text: '#6D28D9', border: '#DDD6FE' },
  VO:      { key: 'statusVoid',            dot: '#EF4444', bg: '#FEE2E2', text: '#DC2626', border: '#FECACA' },
};

export default function QuotationStatusBadge({ data }) {
  const ui = useUI();
  const status = data?.documentStatus;
  if (!status) return null;
  const cfg = STATUS_CONFIG[status];
  if (!cfg) return null;

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      fontSize: 11, fontWeight: 500, padding: '3px 10px', borderRadius: 99,
      background: cfg.bg, color: cfg.text, border: `0.5px solid ${cfg.border}`,
    }}>
      <span style={{
        width: 6, height: 6, borderRadius: '50%', background: cfg.dot, flexShrink: 0,
      }} />
      {ui(cfg.key)}
    </span>
  );
}
