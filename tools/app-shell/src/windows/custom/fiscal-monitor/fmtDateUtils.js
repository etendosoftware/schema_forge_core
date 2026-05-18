export function fmtDate(raw) {
  if (!raw) return '—';
  const parts = String(raw).split(/[-/]/);
  if (parts.length !== 3) return raw;
  const [a, b, c] = parts.map(p => p.trim());
  return a.length === 4 ? `${c}/${b}/${a}` : `${a}/${b}/${c}`;
}
