import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ImportSendingCloseDialog } from '../ImportSendingCloseDialog.jsx';

afterEach(() => {
  cleanup();
});

describe('ImportSendingCloseDialog', () => {
  it('renders nothing (dialog closed) when open is false', () => {
    render(<ImportSendingCloseDialog open={false} onKeepWatching={() => {}} onCloseAnyway={() => {}} />);
    expect(screen.queryByTestId('ImportSendingCloseDialog__title')).toBeNull();
  });

  it('spells out that closing does not cancel the send, with both ways out', () => {
    render(<ImportSendingCloseDialog open onKeepWatching={() => {}} onCloseAnyway={() => {}} />);
    expect(screen.getByTestId('ImportSendingCloseDialog__title').textContent).toBe('The import is still running');
    expect(screen.getByTestId('ImportSendingCloseDialog__body').textContent).toMatch(/does not cancel it/);
    expect(screen.getByTestId('ImportSendingCloseDialog__keepWatching').textContent).toBe('Keep watching');
    expect(screen.getByTestId('ImportSendingCloseDialog__closeAnyway').textContent).toBe('Close anyway');
  });

  it('lets labels override every string', () => {
    const labels = {
      title: 'La importación sigue en curso',
      body: 'Cerrar esta ventana no la cancela.',
      keepWatching: 'Seguir viendo',
      closeAnyway: 'Cerrar igualmente',
    };
    render(<ImportSendingCloseDialog open labels={labels} onKeepWatching={() => {}} onCloseAnyway={() => {}} />);
    expect(screen.getByTestId('ImportSendingCloseDialog__title').textContent).toBe('La importación sigue en curso');
    expect(screen.getByTestId('ImportSendingCloseDialog__body').textContent).toBe('Cerrar esta ventana no la cancela.');
    expect(screen.getByTestId('ImportSendingCloseDialog__keepWatching').textContent).toBe('Seguir viendo');
    expect(screen.getByTestId('ImportSendingCloseDialog__closeAnyway').textContent).toBe('Cerrar igualmente');
  });

  // A caller that translates only part of the dialog must still get a complete dialog: a missing
  // key falls back to its default, it does not blank the button that carries the warning.
  it('merges a partial labels object over the defaults instead of replacing them', () => {
    render(
      <ImportSendingCloseDialog
        open
        labels={{ closeAnyway: 'Cerrar igualmente' }}
        onKeepWatching={() => {}}
        onCloseAnyway={() => {}}
      />,
    );
    expect(screen.getByTestId('ImportSendingCloseDialog__closeAnyway').textContent).toBe('Cerrar igualmente');
    expect(screen.getByTestId('ImportSendingCloseDialog__keepWatching').textContent).toBe('Keep watching');
    expect(screen.getByTestId('ImportSendingCloseDialog__title').textContent).toBe('The import is still running');
    expect(screen.getByTestId('ImportSendingCloseDialog__body').textContent).toMatch(/does not cancel it/);
  });

  it('calls only onCloseAnyway when the user confirms the close', () => {
    const onKeepWatching = vi.fn();
    const onCloseAnyway = vi.fn();
    render(<ImportSendingCloseDialog open onKeepWatching={onKeepWatching} onCloseAnyway={onCloseAnyway} />);
    fireEvent.click(screen.getByTestId('ImportSendingCloseDialog__closeAnyway'));
    expect(onCloseAnyway).toHaveBeenCalledTimes(1);
    expect(onKeepWatching).not.toHaveBeenCalled();
  });

  it('calls only onKeepWatching when the user backs out', () => {
    const onKeepWatching = vi.fn();
    const onCloseAnyway = vi.fn();
    render(<ImportSendingCloseDialog open onKeepWatching={onKeepWatching} onCloseAnyway={onCloseAnyway} />);
    fireEvent.click(screen.getByTestId('ImportSendingCloseDialog__keepWatching'));
    expect(onKeepWatching).toHaveBeenCalledTimes(1);
    expect(onCloseAnyway).not.toHaveBeenCalled();
  });

  /**
   * The question can also be dismissed without touching either answer — Esc, the overlay, the
   * corner X — and that path must resolve to the cautious answer. If an accidental Esc counted
   * as "close anyway", the guard would hand the send exactly the silent teardown it exists to
   * prevent: the caller unmounts the import dialog, the review queue goes with it, and the rows
   * that failed are never reported. Wiring this callback to onCloseAnyway must fail here.
   */
  // The corner X and Escape are the two ways out that answer neither button, and both MUST
  // resolve to "keep watching". Wiring them to onCloseAnyway would look like a reasonable
  // shortcut and would quietly undo the whole point of ETP-5225: a stray Escape would confirm
  // a close the user never chose, unmounting the review queue and leaving the failed rows
  // reported as nothing but a smaller-than-expected success count — exactly the bug this
  // dialog exists to prevent. Asserting the call COUNT (1, then 2) as well as the absence of
  // onCloseAnyway is deliberate: a handler that fired both would still pass the `not` check
  // alone.
  it('treats a dismissal that answers neither question as "keep watching"', () => {
    const onKeepWatching = vi.fn();
    const onCloseAnyway = vi.fn();
    render(<ImportSendingCloseDialog open onKeepWatching={onKeepWatching} onCloseAnyway={onCloseAnyway} />);

    fireEvent.click(screen.getByLabelText('Close'));
    expect(onKeepWatching).toHaveBeenCalledTimes(1);
    expect(onCloseAnyway).not.toHaveBeenCalled();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onKeepWatching).toHaveBeenCalledTimes(2);
    expect(onCloseAnyway).not.toHaveBeenCalled();
  });
});
