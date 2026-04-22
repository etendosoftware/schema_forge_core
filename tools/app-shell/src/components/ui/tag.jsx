/**
 * Generic Tag component for non-status classifications (contact types,
 * categories, boolean type markers, etc.).
 *
 * NOT to be used for document statuses — use <StatusTag> for those.
 *
 * Palette (ETP-3835): design system tokens for tipo/category tags.
 */

const VARIANT_STYLES = {
  blue:    { background: '#DBF3FF', color: '#0075AD' },
  green:   { background: '#DFF8EA', color: '#17663A' },
  purple:  { background: '#F4F1FD', color: '#4316CA' },
  yellow:  { background: '#FFF3D6', color: '#8A6100' },
  pink:    { background: '#FDDDF8', color: '#A5088C' },
  orange:  { background: '#FFE8E1', color: '#B82E00' },
  teal:    { background: '#D5F2EA', color: '#0E6B54' },
  red:     { background: '#FDD8E1', color: '#AF0932' },
  neutral: { background: '#F5F7F9', color: '#3F3F50' },
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
