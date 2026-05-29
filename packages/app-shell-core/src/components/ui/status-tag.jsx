import { getStatusTone } from '../../lib/statusBadge.js';
import { TONE_STYLES, BASE_STYLE } from './status-tag-tokens.js';

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
