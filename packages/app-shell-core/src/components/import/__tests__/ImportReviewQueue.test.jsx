import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ImportReviewQueue, buildErrorsCsv } from '../ImportReviewQueue.jsx';

// cmdk (the FK-mismatch popover's command list) observes its list size via
// ResizeObserver and scrolls the selected item into view — neither of which
// jsdom implements.
if (!global.ResizeObserver) {
  global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

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
  it('hides OK entries when statusFilter is "error"', () => {
    // okEntry is at index 0, errorEntry at index 1 — filtering doesn't renumber, it
    // just removes okEntry (index 0) from what's rendered, so the surviving row keeps
    // its original index 1 in its testids.
    render(<ImportReviewQueue entries={[okEntry, errorEntry]} statusFilter="error" onStatusFilterChange={() => {}} onEditField={() => {}} onRetryEntry={() => {}} onSkipEntry={() => {}} onDownloadErrors={() => {}} />);
    expect(screen.queryByTestId('ImportReviewQueue__summary-0')).toBeNull();
    expect(screen.getByTestId('ImportReviewQueue__input-1-email')).toBeDefined();
  });

  it('shows all entries when statusFilter is "all"', () => {
    render(<ImportReviewQueue entries={[okEntry, errorEntry]} statusFilter="all" onStatusFilterChange={() => {}} onEditField={() => {}} onRetryEntry={() => {}} onSkipEntry={() => {}} onDownloadErrors={() => {}} />);
    expect(screen.getByTestId('ImportReviewQueue__summary-0').textContent).toBe('Lucia · lucia@x.com');
    expect(screen.getByTestId('ImportReviewQueue__input-1-email')).toBeDefined();
  });

  it('shows only OK entries when statusFilter is "ok"', () => {
    render(<ImportReviewQueue entries={[okEntry, errorEntry]} statusFilter="ok" onStatusFilterChange={() => {}} onEditField={() => {}} onRetryEntry={() => {}} onSkipEntry={() => {}} onDownloadErrors={() => {}} />);
    expect(screen.getByTestId('ImportReviewQueue__summary-0')).toBeDefined();
    expect(screen.queryByTestId('ImportReviewQueue__input-1-email')).toBeNull();
  });

  it('treats a skipped entry as needing attention under the "error" filter', () => {
    const skipped = { ...errorEntry, status: 'skipped' };
    render(<ImportReviewQueue entries={[okEntry, skipped]} statusFilter="error" onStatusFilterChange={() => {}} onEditField={() => {}} onRetryEntry={() => {}} onSkipEntry={() => {}} onDownloadErrors={() => {}} />);
    expect(screen.queryByTestId('ImportReviewQueue__summary-0')).toBeNull();
    expect(screen.getByTestId('ImportReviewQueue__skippedLabel-1')).toBeDefined();
  });

  it('renders the error message and an editable input for the flagged field', () => {
    render(<ImportReviewQueue entries={[errorEntry]} statusFilter="error" onStatusFilterChange={() => {}} onEditField={() => {}} onRetryEntry={() => {}} onSkipEntry={() => {}} onDownloadErrors={() => {}} />);
    expect(screen.getByTestId('ImportReviewQueue__fieldError-0-email').textContent).toBe('Not a valid email address.');
    expect(screen.getByTestId('ImportReviewQueue__input-0-email').value).toBe('not-an-email');
  });

  it('calls onEditField with the entry index, target, and new value', () => {
    const onEditField = vi.fn();
    render(<ImportReviewQueue entries={[errorEntry]} statusFilter="error" onStatusFilterChange={() => {}} onEditField={onEditField} onRetryEntry={() => {}} onSkipEntry={() => {}} onDownloadErrors={() => {}} />);
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
        statusFilter="error"
        onStatusFilterChange={() => {}}
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
        statusFilter="error"
        onStatusFilterChange={() => {}}
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
    render(<ImportReviewQueue entries={[errorEntry]} statusFilter="error" onStatusFilterChange={() => {}} onEditField={() => {}} onRetryEntry={onRetryEntry} onSkipEntry={() => {}} onDownloadErrors={() => {}} retryLabel="Retry" />);
    expect(screen.getByTestId('ImportReviewQueue__retry-0').textContent).toBe('Retry');
    fireEvent.click(screen.getByTestId('ImportReviewQueue__retry-0'));
    expect(onRetryEntry).toHaveBeenCalledWith(0);
  });

  it('calls onSkipEntry with the entry index', () => {
    const onSkipEntry = vi.fn();
    render(<ImportReviewQueue entries={[errorEntry]} statusFilter="error" onStatusFilterChange={() => {}} onEditField={() => {}} onRetryEntry={() => {}} onSkipEntry={onSkipEntry} onDownloadErrors={() => {}} />);
    fireEvent.click(screen.getByTestId('ImportReviewQueue__skip-0'));
    expect(onSkipEntry).toHaveBeenCalledWith(0);
  });

  it('marks a skipped entry distinctly and does not offer edit/retry for it', () => {
    const skipped = { ...errorEntry, status: 'skipped' };
    render(<ImportReviewQueue entries={[skipped]} statusFilter="error" onStatusFilterChange={() => {}} onEditField={() => {}} onRetryEntry={() => {}} onSkipEntry={() => {}} onDownloadErrors={() => {}} />);
    expect(screen.getByTestId('ImportReviewQueue__skippedLabel-0').textContent).toBe('Skipped');
    expect(screen.queryByTestId('ImportReviewQueue__input-0-email')).toBeNull();
  });

  it('calls onDownloadErrors when the download button is clicked', () => {
    const onDownloadErrors = vi.fn();
    render(<ImportReviewQueue entries={[errorEntry]} statusFilter="error" onStatusFilterChange={() => {}} onEditField={() => {}} onRetryEntry={() => {}} onSkipEntry={() => {}} onDownloadErrors={onDownloadErrors} />);
    fireEvent.click(screen.getByTestId('ImportReviewQueue__download'));
    expect(onDownloadErrors).toHaveBeenCalled();
  });

  describe('status filter', () => {
    it('calls onStatusFilterChange with "all" when the All button is clicked', () => {
      const onStatusFilterChange = vi.fn();
      render(<ImportReviewQueue entries={[errorEntry]} statusFilter="error" onStatusFilterChange={onStatusFilterChange} onEditField={() => {}} onRetryEntry={() => {}} onSkipEntry={() => {}} onDownloadErrors={() => {}} />);
      fireEvent.click(screen.getByTestId('ImportReviewQueue__statusFilter-all'));
      expect(onStatusFilterChange).toHaveBeenCalledWith('all');
    });

    it('calls onStatusFilterChange with "ok" when the Correct button is clicked', () => {
      const onStatusFilterChange = vi.fn();
      render(<ImportReviewQueue entries={[errorEntry]} statusFilter="error" onStatusFilterChange={onStatusFilterChange} onEditField={() => {}} onRetryEntry={() => {}} onSkipEntry={() => {}} onDownloadErrors={() => {}} />);
      fireEvent.click(screen.getByTestId('ImportReviewQueue__statusFilter-ok'));
      expect(onStatusFilterChange).toHaveBeenCalledWith('ok');
    });

    it('calls onStatusFilterChange with "error" when the Errors button is clicked', () => {
      const onStatusFilterChange = vi.fn();
      render(<ImportReviewQueue entries={[errorEntry]} statusFilter="all" onStatusFilterChange={onStatusFilterChange} onEditField={() => {}} onRetryEntry={() => {}} onSkipEntry={() => {}} onDownloadErrors={() => {}} />);
      fireEvent.click(screen.getByTestId('ImportReviewQueue__statusFilter-error'));
      expect(onStatusFilterChange).toHaveBeenCalledWith('error');
    });
  });

  describe('FK mismatch — apply value', () => {
    const fkFields = [{ target: 'country', label: 'Country', matchEntity: 'Country' }];
    const fkErrorEntry = (rawValue) => ({
      row: { country: rawValue },
      errors: [{
        target: 'country',
        message: `"${rawValue}" could not be matched to an existing record.`,
        candidates: [{ id: 'BR', name: 'Brasil', similarityPercent: 92 }],
      }],
      status: 'pending',
    });

    it('applies a picked candidate immediately, with no prompt, when no other row shares the mismatch', () => {
      const onApplyFkValue = vi.fn();
      render(
        <ImportReviewQueue
          entries={[fkErrorEntry('Brazil')]}
          fields={fkFields}
          statusFilter="error"
          onStatusFilterChange={() => {}}
          onEditField={() => {}}
          onRetryEntry={() => {}}
          onSkipEntry={() => {}}
          onApplyFkValue={onApplyFkValue}
          onDownloadErrors={() => {}}
        />
      );
      fireEvent.click(screen.getByTestId('ImportReviewQueue__fieldError-0-country'));
      fireEvent.click(screen.getByTestId('ImportReviewQueue__fkCandidate-0-country-BR'));
      expect(onApplyFkValue).toHaveBeenCalledWith({ indices: [0], field: fkFields[0], value: 'Brasil', resolvedId: 'BR' });
      expect(screen.queryByTestId('DialogTitle__bulkApplyFk')).toBeNull();
    });

    it('prompts before applying when another row has the same unmatched value', () => {
      const onApplyFkValue = vi.fn();
      render(
        <ImportReviewQueue
          entries={[fkErrorEntry('Brazil'), fkErrorEntry('Brazil')]}
          fields={fkFields}
          statusFilter="error"
          onStatusFilterChange={() => {}}
          onEditField={() => {}}
          onRetryEntry={() => {}}
          onSkipEntry={() => {}}
          onApplyFkValue={onApplyFkValue}
          onDownloadErrors={() => {}}
        />
      );
      fireEvent.click(screen.getByTestId('ImportReviewQueue__fieldError-0-country'));
      fireEvent.click(screen.getByTestId('ImportReviewQueue__fkCandidate-0-country-BR'));
      expect(onApplyFkValue).not.toHaveBeenCalled();
      expect(screen.getByTestId('DialogTitle__bulkApplyFk').textContent).toBe('Apply to similar rows?');
      expect(screen.getByTestId('DialogDescription__bulkApplyFk').textContent).toBe('1 other row(s) also have "Brazil". Apply "Brasil" to all of them too?');
    });

    it('applies only to the picked row when the user declines the bulk prompt', () => {
      const onApplyFkValue = vi.fn();
      render(
        <ImportReviewQueue
          entries={[fkErrorEntry('Brazil'), fkErrorEntry('Brazil')]}
          fields={fkFields}
          statusFilter="error"
          onStatusFilterChange={() => {}}
          onEditField={() => {}}
          onRetryEntry={() => {}}
          onSkipEntry={() => {}}
          onApplyFkValue={onApplyFkValue}
          onDownloadErrors={() => {}}
        />
      );
      fireEvent.click(screen.getByTestId('ImportReviewQueue__fieldError-0-country'));
      fireEvent.click(screen.getByTestId('ImportReviewQueue__fkCandidate-0-country-BR'));
      fireEvent.click(screen.getByTestId('ImportReviewQueue__bulkApplyOnlyThis'));
      expect(onApplyFkValue).toHaveBeenCalledWith({ indices: [0], field: fkFields[0], value: 'Brasil', resolvedId: 'BR' });
      expect(screen.queryByTestId('DialogTitle__bulkApplyFk')).toBeNull();
    });

    it('applies to every matching row when the user confirms "Apply to all"', () => {
      const onApplyFkValue = vi.fn();
      render(
        <ImportReviewQueue
          entries={[fkErrorEntry('Brazil'), fkErrorEntry('Brazil'), fkErrorEntry('Other')]}
          fields={fkFields}
          statusFilter="error"
          onStatusFilterChange={() => {}}
          onEditField={() => {}}
          onRetryEntry={() => {}}
          onSkipEntry={() => {}}
          onApplyFkValue={onApplyFkValue}
          onDownloadErrors={() => {}}
        />
      );
      fireEvent.click(screen.getByTestId('ImportReviewQueue__fieldError-0-country'));
      fireEvent.click(screen.getByTestId('ImportReviewQueue__fkCandidate-0-country-BR'));
      fireEvent.click(screen.getByTestId('ImportReviewQueue__bulkApplyAll'));
      expect(onApplyFkValue).toHaveBeenCalledWith({ indices: [0, 1], field: fkFields[0], value: 'Brasil', resolvedId: 'BR' });
    });

    it('reports a null resolvedId when accepting freeform typed text', () => {
      const onApplyFkValue = vi.fn();
      render(
        <ImportReviewQueue
          entries={[fkErrorEntry('Brazil')]}
          fields={fkFields}
          statusFilter="error"
          onStatusFilterChange={() => {}}
          onEditField={() => {}}
          onRetryEntry={() => {}}
          onSkipEntry={() => {}}
          onApplyFkValue={onApplyFkValue}
          onDownloadErrors={() => {}}
        />
      );
      fireEvent.click(screen.getByTestId('ImportReviewQueue__fieldError-0-country'));
      fireEvent.change(screen.getByTestId('ImportReviewQueue__fkSearch-0-country'), { target: { value: 'Brasil (typed)' } });
      fireEvent.click(screen.getByTestId('ImportReviewQueue__fkUseTyped-0-country'));
      expect(onApplyFkValue).toHaveBeenCalledWith({ indices: [0], field: fkFields[0], value: 'Brasil (typed)', resolvedId: null });
    });
  });

  describe('Copy error', () => {
    // These server-side errors are frequently raw, uncontrolled messages
    // (BatchService's own generic "Operation 'x' rejected by server" wrapper) that the
    // user can't fix themselves — Retry already exists for the transient-failure case;
    // this covers reporting the exact text to support instead of requiring the user to
    // dig it out of the Network tab or select it manually from the on-screen span.
    afterEach(() => {
      delete navigator.clipboard;
    });

    it('copies a single-target error\'s message to the clipboard', async () => {
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, { clipboard: { writeText } });
      render(<ImportReviewQueue entries={[errorEntry]} statusFilter="error" onStatusFilterChange={() => {}} onEditField={() => {}} onRetryEntry={() => {}} onSkipEntry={() => {}} onDownloadErrors={() => {}} />);
      fireEvent.click(screen.getByTestId('ImportReviewQueue__copy-0'));
      await Promise.resolve();
      expect(writeText).toHaveBeenCalledWith('email: Not a valid email address.');
    });

    it('copies a row-level error (no target) without a leading "undefined:" or empty label', async () => {
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, { clipboard: { writeText } });
      const rowLevelEntry = { row: { name: 'Lucia' }, errors: [{ target: '', message: "Operation 'bp' rejected by server" }], status: 'pending' };
      render(<ImportReviewQueue entries={[rowLevelEntry]} fields={[{ target: 'name', label: 'Name' }]} statusFilter="error" onStatusFilterChange={() => {}} onEditField={() => {}} onRetryEntry={() => {}} onSkipEntry={() => {}} onDownloadErrors={() => {}} />);
      fireEvent.click(screen.getByTestId('ImportReviewQueue__copy-0'));
      await Promise.resolve();
      expect(writeText).toHaveBeenCalledWith("Operation 'bp' rejected by server");
    });

    it('does not render a Copy button for an entry with no errors', () => {
      render(<ImportReviewQueue entries={[okEntry]} statusFilter="all" onStatusFilterChange={() => {}} onEditField={() => {}} onRetryEntry={() => {}} onSkipEntry={() => {}} onDownloadErrors={() => {}} />);
      expect(screen.queryByTestId('ImportReviewQueue__copy-0')).toBeNull();
    });
  });
});
