import { getStoredLocale } from '../../i18n/useLocaleState.js';

const DEFAULT_LABELS = {
  title: 'Importing…',
  subtitle: 'Processing rows',
  counter: '{processed} / {total} processed',
};

// 'always': es-ES drops the separator on four-digit numbers by default ("1234"), which would
// make "1.234 / 2.000" read inconsistently as the count crosses a thousand.
function formatCount(value) {
  const locale = getStoredLocale().replace('_', '-');
  try {
    return new Intl.NumberFormat(locale, { useGrouping: 'always' }).format(value);
  } catch {
    return String(value);
  }
}

/**
 * `processed` / `total` (ETP-5676) are optional: the counter renders only when the caller reports
 * a total. The live region is polite and the caller throttles its updates, so a screen reader is
 * not read every row of a 2,000-row file.
 */
export function ImportProgressStep({ percent, processed, total, labels }) {
  const text = { ...DEFAULT_LABELS, ...labels };
  const counter = total > 0
    ? text.counter.replace('{processed}', formatCount(processed ?? 0)).replace('{total}', formatCount(total))
    : null;
  return (
    <div className="flex flex-col gap-2 py-6">
      <div className="flex justify-between text-sm font-medium">
        <span data-testid="ImportProgressStep__title">{text.title}</span>
        <span className="tabular-nums" data-testid="ImportProgressStep__percent">{percent}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          data-testid="ImportProgressStep__bar"
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${percent}%` }}
        />
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{text.subtitle}</span>
        {counter && (
          <span
            className="tabular-nums"
            role="status"
            aria-live="polite"
            data-testid="ImportProgressStep__counter"
          >
            {counter}
          </span>
        )}
      </div>
    </div>
  );
}
