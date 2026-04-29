/**
 * Map a status code to one of the 4 Figma semantic tones.
 * Used by StatusTag (grid). Does NOT affect DetailView.
 */
export function getStatusTone(status) {
  const s = String(status ?? '').toLowerCase();
  if (
    s === 'co' || s === 'ca' || s === 'etgo_ci' || s === 'pa' || s === 'rppc' || s === 'ppm' ||
    s === 'pwnc' || s === 'rdnc' ||
    s === 'completed' || s === 'complete' || s === 'confirmed' || s === 'booked' ||
    s === 'paid' || s === 'true' || s === 'processed'
  ) return 'success';
  if (
    s === 'ip' || s === 'ue' || s === 'rpae' || s === 'rpap' || s === 'rpr' ||
    s === 'in process' || s === 'under evaluation'
  ) return 'warning';
  if (
    s === 'vo' || s === 'rpvoid' || s === 'rpvd' ||
    s === 'voided' || s === 'cancelled' || s === 'void'
  ) return 'destructive';
  return 'neutral';
}

/**
 * Map a document status string to Badge component props.
 * Shared between DataTable and DetailView.
 */
export function getStatusBadgeProps(status) {
  const s = String(status ?? '').toLowerCase();
  if (s === 'true' || s === 'processed') {
    return { variant: 'default', className: 'bg-emerald-600 hover:bg-emerald-700 border-transparent text-white' };
  }
  if (s === 'false' || s === 'not processed') {
    return { variant: 'secondary' };
  }
  if (s === 'draft' || s === 'dr') {
    return { variant: 'secondary' };
  }
  if (s === 'completed' || s === 'complete' || s === 'booked' || s === 'co' || s === 'ca' || s === 'etgo_ci' || s === 'rppc' || s === 'ppm' || s === 'pwnc' || s === 'rdnc') {
    return { variant: 'default', className: 'bg-emerald-600 hover:bg-emerald-700 border-transparent text-white' };
  }
  if (s === 'closed' || s === 'cl' || s === 'paid' || s === 'pa') {
    return { variant: 'default', className: 'bg-blue-600 hover:bg-blue-700 border-transparent text-white' };
  }
  if (s === 'voided' || s === 'cancelled' || s === 'void' || s === 'vo' || s === 'rpvoid') {
    return { variant: 'destructive' };
  }
  if (s === 'in process' || s === 'ip' || s === 'rpae' || s === 'rpap' || s === 'rpr') {
    return { variant: 'outline', className: 'border-amber-300 bg-amber-50 text-amber-700' };
  }
  if (s === 'under evaluation' || s === 'ue') {
    return { variant: 'outline', className: 'border-purple-300 bg-purple-50 text-purple-700' };
  }
  return { variant: 'outline' };
}

export function getStatusDotColor(status) {
  const s = String(status ?? '').toLowerCase();
  if (s === 'true' || s === 'processed') return 'bg-emerald-500';
  if (s === 'false' || s === 'not processed') return 'bg-gray-400';
  if (s === 'draft' || s === 'dr') return 'bg-gray-400';
  if (s === 'completed' || s === 'complete' || s === 'booked' || s === 'co' || s === 'ca' || s === 'etgo_ci' || s === 'rppc' || s === 'ppm' || s === 'pwnc' || s === 'rdnc') return 'bg-emerald-500';
  if (s === 'closed' || s === 'cl' || s === 'paid' || s === 'pa') return 'bg-blue-500';
  if (s === 'voided' || s === 'cancelled' || s === 'void' || s === 'vo' || s === 'rpvoid') return 'bg-red-500';
  if (s === 'in process' || s === 'ip' || s === 'rpae' || s === 'rpap' || s === 'rpr') return 'bg-amber-400';
  if (s === 'under evaluation' || s === 'ue') return 'bg-purple-500';
  return 'bg-gray-400';
}

export function getStatusPillClass(status) {
  const s = String(status ?? '').toLowerCase();
  if (s === 'true' || s === 'processed') return 'bg-emerald-50 text-emerald-800';
  if (s === 'false' || s === 'not processed') return 'bg-gray-100 text-gray-700';
  if (s === 'draft' || s === 'dr') return 'bg-gray-100 text-gray-700';
  if (s === 'completed' || s === 'complete' || s === 'confirmed' || s === 'booked' || s === 'co' || s === 'ca' || s === 'etgo_ci' || s === 'rppc' || s === 'ppm' || s === 'pwnc' || s === 'rdnc') return 'bg-emerald-50 text-emerald-800';
  if (s === 'closed' || s === 'cl' || s === 'paid' || s === 'pa') return 'bg-blue-50 text-blue-800';
  if (s === 'voided' || s === 'cancelled' || s === 'void' || s === 'vo' || s === 'rpvoid') return 'bg-red-50 text-red-800';
  if (s === 'in process' || s === 'ip' || s === 'rpae' || s === 'rpap' || s === 'rpr') return 'bg-amber-50 text-amber-800';
  if (s === 'under evaluation' || s === 'ue') return 'bg-purple-50 text-purple-800';
  return 'bg-gray-100 text-gray-700';
}

export function getStatusGridPillClass(status) {
  const s = String(status ?? '').toLowerCase();
  if (s === 'true' || s === 'processed') return 'bg-emerald-500 text-white';
  if (s === 'false' || s === 'not processed') return 'bg-gray-200 text-gray-700';
  if (s === 'draft' || s === 'dr') return 'bg-gray-100 text-gray-600 border border-gray-300';
  if (s === 'completed' || s === 'complete' || s === 'confirmed' || s === 'booked' || s === 'co' || s === 'ca' || s === 'etgo_ci' || s === 'rppc' || s === 'ppm' || s === 'pwnc' || s === 'rdnc') return 'bg-emerald-500 text-white';
  if (s === 'closed' || s === 'cl' || s === 'paid' || s === 'pa') return 'bg-slate-500 text-white';
  if (s === 'voided' || s === 'cancelled' || s === 'void' || s === 'vo' || s === 'rpvoid') return 'bg-red-500 text-white';
  if (s === 'in process' || s === 'ip' || s === 'rpae' || s === 'rpap' || s === 'rpr') return 'bg-amber-500 text-white';
  if (s === 'under evaluation' || s === 'ue') return 'bg-purple-500 text-white';
  return 'bg-gray-100 text-gray-600 border border-gray-300';
}

export function statusLabel(status, dictionary, translate) {
  // 1. DB-sourced translation from AD_Ref_List_Trl (via extract-labels.js)
  if (dictionary?.statuses?.[status]?.label) return dictionary.statuses[status].label;

  // 2. Manually authored genericLabels fallback
  const MAP = {
    // Boolean processed fields
    true: 'Processed', false: 'Not Processed',
    // Document statuses
    DR: 'statusDraft', CO: 'statusComplete', VO: 'statusVoid', IP: 'statusInProcess',
    CL: 'statusClosed', PA: 'statusPaid', UE: 'statusUnderEvaluation', CA: 'statusCancelled',
    // Payment statuses
    RPR: 'statusPaymentReceived', RPAE: 'statusAwaitingExecution', RPAP: 'statusAwaitingPayment',
    RPPC: 'statusPaymentCleared', RPVOID: 'statusVoid',
    PPM: 'statusPaymentMade', PWNC: 'statusWithdrawnNotCleared', RDNC: 'statusDepositedNotCleared',
  };
  const key = MAP[status];
  if (!key) return status;
  if (dictionary?.genericLabels?.[key]) return dictionary.genericLabels[key];

  // 3. i18n translate function (e.g. ui() from useUI hook)
  if (translate) {
    const translated = translate(key);
    if (translated && translated !== key) return translated;
  }

  // 4. Last resort: humanize the key name
  return key.replace('status', '').replace(/([A-Z])/g, ' $1').trim();
}
