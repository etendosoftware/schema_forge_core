import { getCalendarDateRelation, parseCalendarDate } from './dateOnly.js';

export function getLatestInstallmentDueDate(installments = []) {
  const timestamps = installments
    .map((installment) => parseCalendarDate(installment?.dueDate)?.getTime() ?? NaN)
    .filter((timestamp) => !Number.isNaN(timestamp));

  return timestamps.length > 0 ? new Date(Math.max(...timestamps)) : null;
}

export function getDueDateDotColor(raw, reference) {
  const relation = getCalendarDateRelation(raw, reference);
  if (relation === 'past') return 'bg-red-500';
  if (relation === 'today') return 'bg-amber-500';
  return 'bg-emerald-500';
}
