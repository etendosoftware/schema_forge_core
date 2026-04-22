import { getStatusTone } from '@/lib/statusBadge';

const TONE_STYLES = {
  success:     { background: '#EEFBF4', color: '#17663A' },
  warning:     { background: '#FFF9EB', color: '#8A6100' },
  destructive: { background: '#FEF0F4', color: '#D50B3E' },
  neutral:     { background: '#F5F7F9', color: '#3F3F50' },
};

const BASE_STYLE = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '4px 8px',
  borderRadius: '9999px',
  fontSize: '12px',
  lineHeight: '16px',
  fontWeight: 400,
  whiteSpace: 'nowrap',
};

export function StatusTag({ status, label, tone: toneProp, className = '' }) {
  const tone = toneProp ?? getStatusTone(status);
  return (
    <span
      className={`status-tag status-tag--${tone}${className ? ` ${className}` : ''}`}
      style={{ ...BASE_STYLE, ...TONE_STYLES[tone] }}
    >
      {label ?? status}
    </span>
  );
}
