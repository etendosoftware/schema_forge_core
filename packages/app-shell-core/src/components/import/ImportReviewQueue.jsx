import { toast } from 'sonner';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../ui/table.jsx';
import { Input } from '../ui/input.jsx';
import { Button } from '../ui/button.jsx';

const DEFAULT_LABELS = {
  showOnlyErrors: 'Show only errors',
  showAll: 'Show all',
  skip: 'Skip',
  skipped: 'Skipped',
  downloadErrors: 'Download errors',
  copyError: 'Copy error',
  copied: 'Copied to clipboard',
  copyFailed: 'Could not copy to clipboard',
};

/**
 * Plain-text summary of one entry's errors, e.g. for pasting into a support
 * ticket. These are frequently raw, uncontrolled server messages (BatchService's
 * own generic "Operation 'x' rejected by server" wrapper, or a raw unhandled
 * exception) rather than a friendly validation message — the user can't fix
 * those themselves, only retry or hand the exact text to support.
 */
function errorsToText(entry) {
  return entry.errors.map((e) => (e.target ? `${e.target}: ${e.message}` : e.message)).join('\n');
}

function csvEscape(value) {
  const s = String(value ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Builds a CSV of every currently-erroring or skipped entry, one row per
 * (entry, flagged field) pair — additive to the queue, never a replacement
 * for it (the mock's "download once, never revisit" behavior was explicitly
 * NOT adopted; see the design spec's UI divergences).
 */
export function buildErrorsCsv(entries) {
  const lines = ['target,value,reason'];
  for (const entry of entries) {
    for (const error of entry.errors) {
      lines.push([error.target, entry.row[error.target], error.message].map(csvEscape).join(','));
    }
  }
  return lines.join('\n');
}

export function ImportReviewQueue({
  entries,
  fields = [],
  showOnlyErrors,
  onToggleFilter,
  onEditField,
  onRetryEntry,
  onSkipEntry,
  onDownloadErrors,
  retryLabel = 'Retry',
  labels,
}) {
  const text = { ...DEFAULT_LABELS, ...labels };
  const visibleEntries = entries
    .map((entry, index) => ({ entry, index }))
    .filter(({ entry }) => !showOnlyErrors || entry.errors.length > 0 || entry.status === 'skipped');

  const handleCopyError = async (entry) => {
    try {
      await navigator.clipboard.writeText(errorsToText(entry));
      toast.success(text.copied);
    } catch {
      toast.error(text.copyFailed);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <button
          type="button"
          className="text-xs text-primary underline"
          onClick={onToggleFilter}
          data-testid="ImportReviewQueue__filterToggle"
        >
          {showOnlyErrors ? text.showAll : text.showOnlyErrors}
        </button>
        <Button type="button" variant="secondary" size="sm" onClick={onDownloadErrors} data-testid="ImportReviewQueue__download">
          {text.downloadErrors}
        </Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Row</TableHead>
            <TableHead>Errors</TableHead>
            <TableHead className="w-[1%] whitespace-nowrap">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {visibleEntries.map(({ entry, index }) => {
            const isSkipped = entry.status === 'skipped';
            // A blank error.target means BatchService rejected the whole operation, not
            // one field — there is no single cell to flag, so every mapped field becomes
            // editable rather than showing one useless blank-labeled input.
            const rowLevelError = entry.errors.find((e) => !e.target);
            const editableFields = rowLevelError
              ? fields
              : entry.errors.map((e) => ({ target: e.target, label: e.target }));
            return (
              <TableRow key={index}>
                <TableCell>
                  {isSkipped ? (
                    <span className="text-xs text-muted-foreground" data-testid={`ImportReviewQueue__skippedLabel-${index}`}>{text.skipped}</span>
                  ) : entry.errors.length === 0 ? (
                    <span data-testid={`ImportReviewQueue__summary-${index}`}>{Object.values(entry.row).join(' · ')}</span>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {rowLevelError && (
                        <span className="text-xs text-destructive" data-testid={`ImportReviewQueue__rowError-${index}`}>{rowLevelError.message}</span>
                      )}
                      {editableFields.map((field) => {
                        const fieldError = entry.errors.find((e) => e.target === field.target);
                        return (
                          <div key={field.target} className="flex flex-col gap-1">
                            {fieldError && !rowLevelError && (
                              <span className="text-xs text-destructive" data-testid={`ImportReviewQueue__fieldError-${index}-${field.target}`}>{fieldError.message}</span>
                            )}
                            <Input
                              value={entry.row[field.target] ?? ''}
                              onChange={(e) => onEditField(index, field.target, e.target.value)}
                              className="h-8"
                              data-testid={`ImportReviewQueue__input-${index}-${field.target}`}
                            />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </TableCell>
                <TableCell>{entry.errors.length}</TableCell>
                <TableCell>
                  {!isSkipped && (
                    <div className="flex gap-1">
                      <Button type="button" size="sm" onClick={() => onRetryEntry(index)} data-testid={`ImportReviewQueue__retry-${index}`}>
                        {retryLabel}
                      </Button>
                      {entry.errors.length > 0 && (
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          data-testid={`ImportReviewQueue__copy-${index}`}
                          onClick={() => handleCopyError(entry)}
                        >
                          {text.copyError}
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        data-testid={`ImportReviewQueue__skip-${index}`}
                        onClick={() => onSkipEntry(index)}
                      >
                        {text.skip}
                      </Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
