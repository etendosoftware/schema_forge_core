import { VARIANT_STYLES } from './tag-tokens.js';

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

export function Tag({ variant = 'neutral', label, children, className = '' }) {
  const styles = VARIANT_STYLES[variant] || VARIANT_STYLES.neutral;
  return (
    <span
      className={`tag tag--${variant}${className ? ` ${className}` : ''}`}
      style={{ ...BASE_STYLE, ...styles }}
    >
      {label ?? children}
    </span>
  );
}
