import { Button } from '../ui/button.jsx';

const DEFAULT_LABELS = {
  title: 'Confirm import',
  willImport: (n) => `${n} records will be imported`,
  willSkip: (n) => `${n} rows will be skipped due to errors`,
  cancel: 'Cancel',
  confirm: 'Confirm import',
};

export function ImportConfirmStep({ importCount, skipCount, onCancel, onConfirm, labels }) {
  const text = { ...DEFAULT_LABELS, ...labels };
  return (
    <div className="flex flex-col gap-3 py-2">
      <h3 className="text-base font-semibold">{text.title}</h3>
      <p className="text-sm text-muted-foreground">{text.willImport(importCount)}</p>
      {skipCount > 0 && <p className="text-sm text-muted-foreground">{text.willSkip(skipCount)}</p>}
      <div className="flex justify-end gap-2 mt-2">
        <Button type="button" variant="secondary" onClick={onCancel}>{text.cancel}</Button>
        <Button type="button" onClick={onConfirm}>{text.confirm}</Button>
      </div>
    </div>
  );
}
