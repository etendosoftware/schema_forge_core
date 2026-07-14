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

  it('uses the Ban icon (not SkipForward) for the skip action', () => {
    render(<ImportReviewQueue entries={[okEntry]} statusFilter="all" onStatusFilterChange={() => {}} onEditField={() => {}} onRetryEntry={() => {}} onSkipEntry={() => {}} onDownloadErrors={() => {}} />);
    expect(screen.getByTestId('Ban__a73779')).toBeDefined();
    expect(screen.queryByTestId('SkipForward__a73779')).toBeNull();
  });

  it('uses a Check icon (not Pencil) for the unskip / "Edit again" action', () => {
    const skipped = { row: { name: 'Old', email: 'old@x.com' }, errors: [], status: 'skipped' };
    render(<ImportReviewQueue entries={[skipped]} statusFilter="all" onStatusFilterChange={() => {}} onEditField={() => {}} onRetryEntry={() => {}} onSkipEntry={() => {}} onUnskipEntry={() => {}} onDownloadErrors={() => {}} />);
    expect(screen.getByTestId('Check__a73779')).toBeDefined();
    expect(screen.queryByTestId('Pencil__a73779')).toBeNull();
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

  describe('status filter pill counts', () => {
    it('shows the count of each bucket next to its label', () => {
      const okEntry2 = { row: { name: 'Marta', email: 'marta@x.com' }, errors: [], status: 'pending' };
      const skipped = { row: { name: 'Old', email: 'old@x.com' }, errors: [], status: 'skipped' };
      render(
        <ImportReviewQueue
          entries={[okEntry, okEntry2, errorEntry, skipped]}
          statusFilter="all"
          onStatusFilterChange={() => {}}
          onEditField={() => {}}
          onRetryEntry={() => {}}
          onSkipEntry={() => {}}
          onDownloadErrors={() => {}}
        />,
      );
      expect(screen.getByTestId('ImportReviewQueue__statusFilterCount-all').textContent).toBe('4');
      expect(screen.getByTestId('ImportReviewQueue__statusFilterCount-ok').textContent).toBe('2');
      expect(screen.getByTestId('ImportReviewQueue__statusFilterCount-error').textContent).toBe('2');
    });
  });

  describe('off-screen field-error tooltip', () => {
    it('lists every field-level error by label in the Status cell tooltip', () => {
      const multiFieldError = {
        row: { name: 'Andres', email: 'not-an-email', country: 'Nowhereland' },
        errors: [
          { target: 'email', message: 'Not a valid email address.' },
          { target: 'country', message: 'Could not be matched to an existing record.' },
        ],
        status: 'pending',
      };
      render(
        <ImportReviewQueue
          entries={[multiFieldError]}
          fields={[
            { target: 'name', label: 'Name' },
            { target: 'email', label: 'Email' },
            { target: 'country', label: 'Country' },
          ]}
          statusFilter="error"
          onStatusFilterChange={() => {}}
          onEditField={() => {}}
          onRetryEntry={() => {}}
          onSkipEntry={() => {}}
          onDownloadErrors={() => {}}
        />,
      );
      expect(screen.getByTestId('AlertCircle__a73779').getAttribute('title'))
        .toBe('Errors in: Email, Country — scroll right to see them.');
    });

    it('shows no tooltip when the only error is row-level (blank target)', () => {
      const rowLevelEntry = {
        row: { name: 'Andres' },
        errors: [{ target: '', message: 'Operation rejected by server.' }],
        status: 'pending',
      };
      render(
        <ImportReviewQueue
          entries={[rowLevelEntry]}
          fields={[{ target: 'name', label: 'Name' }]}
          statusFilter="error"
          onStatusFilterChange={() => {}}
          onEditField={() => {}}
          onRetryEntry={() => {}}
          onSkipEntry={() => {}}
          onDownloadErrors={() => {}}
        />,
      );
      expect(screen.getByTestId('AlertCircle__a73779').getAttribute('title')).toBeNull();
    });
  });
});

describe('click-to-scroll to first error', () => {
  it('scrolls the first-in-column-order erroring cell into view when the alert icon is clicked, even if it is not first in the errors array', () => {
    const scrollIntoViewMock = vi.fn();
    const originalScrollIntoView = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = scrollIntoViewMock;
    try {
      const multiFieldError = {
        row: { name: 'Andres', email: 'not-an-email', country: 'Nowhereland' },
        errors: [
          { target: 'country', message: 'Could not be matched to an existing record.' },
          { target: 'email', message: 'Not a valid email address.' },
        ],
        status: 'pending',
      };
      render(
        <ImportReviewQueue
          entries={[multiFieldError]}
          fields={[
            { target: 'name', label: 'Name' },
            { target: 'email', label: 'Email' },
            { target: 'country', label: 'Country' },
          ]}
          statusFilter="error"
          onStatusFilterChange={() => {}}
          onEditField={() => {}}
          onRetryEntry={() => {}}
          onSkipEntry={() => {}}
          onDownloadErrors={() => {}}
        />,
      );
      fireEvent.click(screen.getByTestId('ImportReviewQueue__jumpToFirstError-0'));
      expect(scrollIntoViewMock).toHaveBeenCalledTimes(1);
      const scrolledCell = screen.getByTestId(`ImportReviewQueue__input-0-email`).closest('td');
      expect(scrollIntoViewMock.mock.instances[0]).toBe(scrolledCell);
    } finally {
      Element.prototype.scrollIntoView = originalScrollIntoView;
    }
  });

  it('does not render a jump-to-error button when the only error is row-level', () => {
    const rowLevelEntry = {
      row: { name: 'Andres' },
      errors: [{ target: '', message: 'Operation rejected by server.' }],
      status: 'pending',
    };
    render(
      <ImportReviewQueue
        entries={[rowLevelEntry]}
        fields={[{ target: 'name', label: 'Name' }]}
        statusFilter="error"
        onStatusFilterChange={() => {}}
        onEditField={() => {}}
        onRetryEntry={() => {}}
        onSkipEntry={() => {}}
        onDownloadErrors={() => {}}
      />,
    );
    expect(screen.queryByTestId('ImportReviewQueue__jumpToFirstError-0')).toBeNull();
  });
});

describe('showRetry prop', () => {
  it('hides the Retry button on an OK row when showRetry is false', () => {
    render(<ImportReviewQueue entries={[okEntry]} showRetry={false} statusFilter="all" onStatusFilterChange={() => {}} onEditField={() => {}} onRetryEntry={() => {}} onSkipEntry={() => {}} onDownloadErrors={() => {}} />);
    expect(screen.queryByTestId('ImportReviewQueue__retry-0')).toBeNull();
  });

  it('hides the Retry button on an error row when showRetry is false', () => {
    render(<ImportReviewQueue entries={[errorEntry]} showRetry={false} statusFilter="error" onStatusFilterChange={() => {}} onEditField={() => {}} onRetryEntry={() => {}} onSkipEntry={() => {}} onDownloadErrors={() => {}} />);
    expect(screen.queryByTestId('ImportReviewQueue__retry-0')).toBeNull();
  });

  it('shows the Retry button by default (showRetry defaults to true)', () => {
    render(<ImportReviewQueue entries={[errorEntry]} statusFilter="error" onStatusFilterChange={() => {}} onEditField={() => {}} onRetryEntry={() => {}} onSkipEntry={() => {}} onDownloadErrors={() => {}} />);
    expect(screen.getByTestId('ImportReviewQueue__retry-0')).toBeDefined();
  });
});
