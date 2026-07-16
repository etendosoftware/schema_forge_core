import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ImportSystemErrorDialog } from '../ImportSystemErrorDialog.jsx';

afterEach(() => {
  cleanup();
  delete navigator.clipboard;
});

describe('ImportSystemErrorDialog', () => {
  it('renders nothing (dialog closed) when open is false', () => {
    render(<ImportSystemErrorDialog open={false} message="boom" onClose={() => {}} />);
    expect(screen.queryByTestId('ImportSystemErrorDialog__title')).toBeNull();
  });

  it('shows the message up front', () => {
    render(<ImportSystemErrorDialog open message="Operation 'bp' rejected by server" raw='{"status":500,"detail":"..."}' onClose={() => {}} />);
    expect(screen.getByTestId('ImportSystemErrorDialog__message').textContent).toBe("Operation 'bp' rejected by server");
  });

  it('keeps the full report (row, request, trace) collapsed by default', () => {
    render(
      <ImportSystemErrorDialog
        open
        message="Operation 'bp' rejected by server"
        row={{ name: 'Andres' }}
        operations={[{ id: 'bp', body: { name: 'Andres' } }]}
        raw='{"status":500}'
        onClose={() => {}}
      />
    );
    expect(screen.queryByTestId('ImportSystemErrorDialog__report')).toBeNull();
    expect(screen.queryByTestId('ImportSystemErrorDialog__row')).toBeNull();
    expect(screen.queryByTestId('ImportSystemErrorDialog__request')).toBeNull();
    expect(screen.queryByTestId('ImportSystemErrorDialog__trace')).toBeNull();
  });

  it('reveals row data, the request sent, and the trace after clicking "View full report"', () => {
    const row = { name: 'Andres', country: 'España' };
    const operations = [{ id: 'bp', spec: 'contacts', entity: 'businessPartner', body: { name: 'Andres' } }];
    render(
      <ImportSystemErrorDialog
        open
        message="Operation 'bp' rejected by server"
        row={row}
        operations={operations}
        raw='{"status":500,"detail":"..."}'
        onClose={() => {}}
      />
    );
    fireEvent.click(screen.getByTestId('ImportSystemErrorDialog__toggleReport'));
    expect(screen.getByTestId('ImportSystemErrorDialog__row').textContent).toContain('España');
    expect(screen.getByTestId('ImportSystemErrorDialog__request').textContent).toContain('businessPartner');
    expect(screen.getByTestId('ImportSystemErrorDialog__trace').textContent).toBe('{"status":500,"detail":"..."}');
    // Toggling again hides it — it's a show/hide toggle, not a one-way reveal.
    fireEvent.click(screen.getByTestId('ImportSystemErrorDialog__toggleReport'));
    expect(screen.queryByTestId('ImportSystemErrorDialog__report')).toBeNull();
  });

  it('omits the row/request/trace sub-sections that have no data, even with the report expanded', () => {
    render(<ImportSystemErrorDialog open message="boom" onClose={() => {}} />);
    fireEvent.click(screen.getByTestId('ImportSystemErrorDialog__toggleReport'));
    expect(screen.queryByTestId('ImportSystemErrorDialog__row')).toBeNull();
    expect(screen.queryByTestId('ImportSystemErrorDialog__request')).toBeNull();
    expect(screen.queryByTestId('ImportSystemErrorDialog__trace')).toBeNull();
  });

  it('calls onClose when Close is clicked', () => {
    const onClose = vi.fn();
    render(<ImportSystemErrorDialog open message="boom" onClose={onClose} />);
    fireEvent.click(screen.getByTestId('ImportSystemErrorDialog__close'));
    expect(onClose).toHaveBeenCalled();
  });

  it('copies a full report — message, row data, request sent, and server response — regardless of whether it is currently expanded on screen', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    const row = { name: 'Andres', country: 'España' };
    const operations = [{ id: 'bp', body: { name: 'Andres' } }];
    render(<ImportSystemErrorDialog open message="Operation 'bp' rejected by server" row={row} operations={operations} raw="the trace" onClose={() => {}} />);
    // Deliberately do NOT expand the report first — copy must work whether or not the
    // user ever clicked "View full report".
    fireEvent.click(screen.getByTestId('ImportSystemErrorDialog__copy'));
    await Promise.resolve();
    const copied = writeText.mock.calls[0][0];
    expect(copied).toContain("Operation 'bp' rejected by server");
    expect(copied).toContain('España');
    expect(copied).toContain('"id": "bp"');
    expect(copied).toContain('the trace');
  });

  it('copies just the message when there is no row, request, or trace at all', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    render(<ImportSystemErrorDialog open message="boom" onClose={() => {}} />);
    fireEvent.click(screen.getByTestId('ImportSystemErrorDialog__copy'));
    await Promise.resolve();
    expect(writeText).toHaveBeenCalledWith('Error: boom');
  });
});
