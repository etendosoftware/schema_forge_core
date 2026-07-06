import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ImportReviewQueue, buildErrorsCsv } from '../ImportReviewQueue.jsx';

afterEach(() => {
  cleanup();
});

const okEntry = { row: { name: 'Lucia', email: 'lucia@x.com' }, errors: [], status: 'pending' };
const errorEntry = {
  row: { name: 'Andres', email: 'not-an-email' },
  errors: [{ target: 'email', message: 'Not a valid email address.' }],
  status: 'pending',
};

describe('buildErrorsCsv', () => {
  it('builds a CSV with row target/value/reason columns for every erroring entry', () => {
    const csv = buildErrorsCsv([errorEntry]);
    expect(csv).toContain('target,value,reason');
    expect(csv).toContain('email,not-an-email,Not a valid email address.');
  });

  it('skips OK entries entirely', () => {
    const csv = buildErrorsCsv([okEntry, errorEntry]);
    expect(csv.split('\n').filter((l) => l.trim()).length).toBe(2); // header + 1 error row
  });
});

describe('ImportReviewQueue', () => {
  it('hides OK entries when showOnlyErrors is true', () => {
    // okEntry is at index 0, errorEntry at index 1 — filtering doesn't renumber, it
    // just removes okEntry (index 0) from what's rendered, so the surviving row keeps
    // its original index 1 in its testids.
    render(<ImportReviewQueue entries={[okEntry, errorEntry]} showOnlyErrors onToggleFilter={() => {}} onEditField={() => {}} onRetryEntry={() => {}} onSkipEntry={() => {}} onDownloadErrors={() => {}} />);
    expect(screen.queryByTestId('ImportReviewQueue__summary-0')).toBeNull();
    expect(screen.getByTestId('ImportReviewQueue__input-1-email')).toBeDefined();
  });

  it('shows all entries when showOnlyErrors is false', () => {
    render(<ImportReviewQueue entries={[okEntry, errorEntry]} showOnlyErrors={false} onToggleFilter={() => {}} onEditField={() => {}} onRetryEntry={() => {}} onSkipEntry={() => {}} onDownloadErrors={() => {}} />);
    expect(screen.getByTestId('ImportReviewQueue__summary-0').textContent).toBe('Lucia · lucia@x.com');
    expect(screen.getByTestId('ImportReviewQueue__input-1-email')).toBeDefined();
  });

  it('renders the error message and an editable input for the flagged field', () => {
    render(<ImportReviewQueue entries={[errorEntry]} showOnlyErrors onToggleFilter={() => {}} onEditField={() => {}} onRetryEntry={() => {}} onSkipEntry={() => {}} onDownloadErrors={() => {}} />);
    expect(screen.getByTestId('ImportReviewQueue__fieldError-0-email').textContent).toBe('Not a valid email address.');
    expect(screen.getByTestId('ImportReviewQueue__input-0-email').value).toBe('not-an-email');
  });

  it('calls onEditField with the entry index, target, and new value', () => {
    const onEditField = vi.fn();
    render(<ImportReviewQueue entries={[errorEntry]} showOnlyErrors onToggleFilter={() => {}} onEditField={onEditField} onRetryEntry={() => {}} onSkipEntry={() => {}} onDownloadErrors={() => {}} />);
    fireEvent.change(screen.getByTestId('ImportReviewQueue__input-0-email'), { target: { value: 'fixed@x.com' } });
    expect(onEditField).toHaveBeenCalledWith(0, 'email', 'fixed@x.com');
  });

  it('renders an input for every declared field (not just one blank one) when an error has no specific target — the post-send, row-level case', () => {
    const rowLevelEntry = {
      row: { name: 'Lucia', email: 'lucia@x.com' },
      errors: [{ target: '', message: 'Rejected by server' }],
      status: 'pending',
    };
    render(
      <ImportReviewQueue
        entries={[rowLevelEntry]}
        fields={[{ target: 'name', label: 'Name' }, { target: 'email', label: 'Email' }]}
        showOnlyErrors
        onToggleFilter={() => {}}
        onEditField={() => {}}
        onRetryEntry={() => {}}
        onSkipEntry={() => {}}
        onDownloadErrors={() => {}}
      />
    );
    expect(screen.getByTestId('ImportReviewQueue__rowError-0').textContent).toBe('Rejected by server');
    expect(screen.getByTestId('ImportReviewQueue__input-0-name').value).toBe('Lucia');
    expect(screen.getByTestId('ImportReviewQueue__input-0-email').value).toBe('lucia@x.com');
  });

  it('edits the correct field when editing a row-level-error entry\'s full-row inputs', () => {
    const onEditField = vi.fn();
    const rowLevelEntry = {
      row: { name: 'Lucia', email: 'lucia@x.com' },
      errors: [{ target: '', message: 'Rejected by server' }],
      status: 'pending',
    };
    render(
      <ImportReviewQueue
        entries={[rowLevelEntry]}
        fields={[{ target: 'name', label: 'Name' }, { target: 'email', label: 'Email' }]}
        showOnlyErrors
        onToggleFilter={() => {}}
        onEditField={onEditField}
        onRetryEntry={() => {}}
        onSkipEntry={() => {}}
        onDownloadErrors={() => {}}
      />
    );
    fireEvent.change(screen.getByTestId('ImportReviewQueue__input-0-email'), { target: { value: 'fixed@x.com' } });
    expect(onEditField).toHaveBeenCalledWith(0, 'email', 'fixed@x.com');
  });

  it('calls onRetryEntry with the entry index and shows the custom retryLabel', () => {
    const onRetryEntry = vi.fn();
    render(<ImportReviewQueue entries={[errorEntry]} showOnlyErrors onToggleFilter={() => {}} onEditField={() => {}} onRetryEntry={onRetryEntry} onSkipEntry={() => {}} onDownloadErrors={() => {}} retryLabel="Retry" />);
    expect(screen.getByTestId('ImportReviewQueue__retry-0').textContent).toBe('Retry');
    fireEvent.click(screen.getByTestId('ImportReviewQueue__retry-0'));
    expect(onRetryEntry).toHaveBeenCalledWith(0);
  });

  it('calls onSkipEntry with the entry index', () => {
    const onSkipEntry = vi.fn();
    render(<ImportReviewQueue entries={[errorEntry]} showOnlyErrors onToggleFilter={() => {}} onEditField={() => {}} onRetryEntry={() => {}} onSkipEntry={onSkipEntry} onDownloadErrors={() => {}} />);
    fireEvent.click(screen.getByTestId('ImportReviewQueue__skip-0'));
    expect(onSkipEntry).toHaveBeenCalledWith(0);
  });

  it('marks a skipped entry distinctly and does not offer edit/retry for it', () => {
    const skipped = { ...errorEntry, status: 'skipped' };
    render(<ImportReviewQueue entries={[skipped]} showOnlyErrors onToggleFilter={() => {}} onEditField={() => {}} onRetryEntry={() => {}} onSkipEntry={() => {}} onDownloadErrors={() => {}} />);
    expect(screen.getByTestId('ImportReviewQueue__skippedLabel-0').textContent).toBe('Skipped');
    expect(screen.queryByTestId('ImportReviewQueue__input-0-email')).toBeNull();
  });

  it('calls onDownloadErrors when the download button is clicked', () => {
    const onDownloadErrors = vi.fn();
    render(<ImportReviewQueue entries={[errorEntry]} showOnlyErrors onToggleFilter={() => {}} onEditField={() => {}} onRetryEntry={() => {}} onSkipEntry={() => {}} onDownloadErrors={onDownloadErrors} />);
    fireEvent.click(screen.getByTestId('ImportReviewQueue__download'));
    expect(onDownloadErrors).toHaveBeenCalled();
  });

  it('calls onToggleFilter when the filter toggle is clicked', () => {
    const onToggleFilter = vi.fn();
    render(<ImportReviewQueue entries={[errorEntry]} showOnlyErrors onToggleFilter={onToggleFilter} onEditField={() => {}} onRetryEntry={() => {}} onSkipEntry={() => {}} onDownloadErrors={() => {}} />);
    fireEvent.click(screen.getByTestId('ImportReviewQueue__filterToggle'));
    expect(onToggleFilter).toHaveBeenCalled();
  });
});
