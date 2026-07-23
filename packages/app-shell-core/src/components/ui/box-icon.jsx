/* eslint-disable react/prop-types */

/**
 * Package / box glyph used as the default `fallback: 'box'` media placeholder
 * for `multiField` list columns (and reused by Product gallery cells). Kept as a
 * standalone shared util so every window renders the identical fallback.
 */
export function BoxIcon({ size = 24, color = '#828FA3' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M21 8L12 3L3 8M21 8V16L12 21M21 8L12 13M3 8V16L12 21M3 8L12 13M12 21V13" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
