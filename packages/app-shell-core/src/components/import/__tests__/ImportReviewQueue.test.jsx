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
    render(<ImportReviewQueue entries={[okEntry, errorEntry]} showOnlyErrors onToggleFilter={() => {}} onEditField={() => {}} onRetryEntry={() => {}} onSkipEntry={() => {}} onDownloadErrors={() => {}} />);
    expect(screen.queryByText('Lucia · lucia@x.com')).toBeNull();
    expect(screen.getByDisplayValue('not-an-email')).toBeDefined();
  });

  it('shows all entries when showOnlyErrors is false', () => {
    render(<ImportReviewQueue entries={[okEntry, errorEntry]} showOnlyErrors={false} onToggleFilter={() => {}} onEditField={() => {}} onRetryEntry={() => {}} onSkipEntry={() => {}} onDownloadErrors={() => {}} />);
    expect(screen.getByText('Lucia · lucia@x.com')).toBeDefined();
    expect(screen.getByDisplayValue('not-an-email')).toBeDefined();
  });

  it('renders the error message and an editable input for the flagged field', () => {
    render(<ImportReviewQueue entries={[errorEntry]} showOnlyErrors onToggleFilter={() => {}} onEditField={() => {}} onRetryEntry={() => {}} onSkipEntry={() => {}} onDownloadErrors={() => {}} />);
    expect(screen.getByText('Not a valid email address.')).toBeDefined();
    expect(screen.getByDisplayValue('not-an-email')).toBeDefined();
  });

  it('calls onEditField with the entry index, target, and new value', () => {
    const onEditField = vi.fn();
    render(<ImportReviewQueue entries={[errorEntry]} showOnlyErrors onToggleFilter={() => {}} onEditField={onEditField} onRetryEntry={() => {}} onSkipEntry={() => {}} onDownloadErrors={() => {}} />);
    fireEvent.change(screen.getByDisplayValue('not-an-email'), { target: { value: 'fixed@x.com' } });
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
    expect(screen.getByText('Rejected by server')).toBeDefined();
    expect(screen.getByDisplayValue('Lucia')).toBeDefined();
    expect(screen.getByDisplayValue('lucia@x.com')).toBeDefined();
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
    fireEvent.change(screen.getByDisplayValue('lucia@x.com'), { target: { value: 'fixed@x.com' } });
    expect(onEditField).toHaveBeenCalledWith(0, 'email', 'fixed@x.com');
  });

  it('calls onRetryEntry with the entry index and shows the custom retryLabel', () => {
    const onRetryEntry = vi.fn();
    render(<ImportReviewQueue entries={[errorEntry]} showOnlyErrors onToggleFilter={() => {}} onEditField={() => {}} onRetryEntry={onRetryEntry} onSkipEntry={() => {}} onDownloadErrors={() => {}} retryLabel="Retry" />);
    fireEvent.click(screen.getByText('Retry'));
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
    expect(screen.getByText('Skipped')).toBeDefined();
    expect(screen.queryByDisplayValue('not-an-email')).toBeNull();
  });

  it('calls onDownloadErrors when the download button is clicked', () => {
    const onDownloadErrors = vi.fn();
    render(<ImportReviewQueue entries={[errorEntry]} showOnlyErrors onToggleFilter={() => {}} onEditField={() => {}} onRetryEntry={() => {}} onSkipEntry={() => {}} onDownloadErrors={onDownloadErrors} />);
    fireEvent.click(screen.getByText('Download errors'));
    expect(onDownloadErrors).toHaveBeenCalled();
  });

  it('calls onToggleFilter when the filter toggle is clicked', () => {
    const onToggleFilter = vi.fn();
    render(<ImportReviewQueue entries={[errorEntry]} showOnlyErrors onToggleFilter={onToggleFilter} onEditField={() => {}} onRetryEntry={() => {}} onSkipEntry={() => {}} onDownloadErrors={() => {}} />);
    fireEvent.click(screen.getByText('Show all'));
    expect(onToggleFilter).toHaveBeenCalled();
  });
});
