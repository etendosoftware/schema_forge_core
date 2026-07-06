import { CircleAlert } from 'lucide-react';
import { Button } from '../ui/button.jsx';

const DEFAULT_LABELS = {
  title: 'Import could not be completed',
  cancel: 'Cancel',
  retry: 'Retry',
};

export function ImportFileErrorDialog({ message, onCancel, onRetry, labels }) {
  const text = { ...DEFAULT_LABELS, ...labels };
  return (
    <div className="flex flex-col gap-3 py-2">
      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
        <CircleAlert className="h-5 w-5" />
      </span>
      <h3 className="text-base font-semibold" data-testid="ImportFileErrorDialog__title">{text.title}</h3>
      <p className="text-sm text-muted-foreground" data-testid="ImportFileErrorDialog__message">{message}</p>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel} data-testid="ImportFileErrorDialog__cancel">{text.cancel}</Button>
        <Button type="button" onClick={onRetry} data-testid="ImportFileErrorDialog__retry">{text.retry}</Button>
      </div>
    </div>
  );
}
