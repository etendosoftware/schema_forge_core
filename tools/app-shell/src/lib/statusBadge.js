/**
 * Map a document status string to Badge component props.
 * Shared between DataTable and DetailView.
 */
export function getStatusBadgeProps(status) {
  const s = String(status ?? '').toLowerCase();
  if (s === 'draft' || s === 'dr') {
    return { variant: 'secondary' };
  }
  if (s === 'completed' || s === 'complete' || s === 'booked' || s === 'co') {
    return { variant: 'default', className: 'bg-emerald-600 hover:bg-emerald-700 border-transparent text-white' };
  }
  if (s === 'voided' || s === 'cancelled' || s === 'void' || s === 'vo') {
    return { variant: 'destructive' };
  }
  if (s === 'in process' || s === 'ip') {
    return { variant: 'outline', className: 'border-amber-300 bg-amber-50 text-amber-700' };
  }
  return { variant: 'outline' };
}

export function statusLabel(status) {
  const MAP = { DR: 'Draft', CO: 'Complete', VO: 'Void', IP: 'In Process' };
  return MAP[status] || status;
}
