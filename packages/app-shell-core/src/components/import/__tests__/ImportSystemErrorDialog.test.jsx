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

  it('shows the message and, when present, the raw trace', () => {
    render(<ImportSystemErrorDialog open message="Operation 'bp' rejected by server" raw='{"status":500,"detail":"..."}' onClose={() => {}} />);
    expect(screen.getByTestId('ImportSystemErrorDialog__message').textContent).toBe("Operation 'bp' rejected by server");
    expect(screen.getByTestId('ImportSystemErrorDialog__trace').textContent).toBe('{"status":500,"detail":"..."}');
  });

  it('omits the trace block entirely when there is no raw detail', () => {
    render(<ImportSystemErrorDialog open message="boom" raw={undefined} onClose={() => {}} />);
    expect(screen.queryByTestId('ImportSystemErrorDialog__trace')).toBeNull();
  });

  it('calls onClose when Close is clicked', () => {
    const onClose = vi.fn();
    render(<ImportSystemErrorDialog open message="boom" onClose={onClose} />);
    fireEvent.click(screen.getByTestId('ImportSystemErrorDialog__close'));
    expect(onClose).toHaveBeenCalled();
  });

  it('copies both the message and the raw trace to the clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    render(<ImportSystemErrorDialog open message="boom" raw="the trace" onClose={() => {}} />);
    fireEvent.click(screen.getByTestId('ImportSystemErrorDialog__copy'));
    await Promise.resolve();
    expect(writeText).toHaveBeenCalledWith('boom\n\nthe trace');
  });

  it('copies just the message when there is no raw trace', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    render(<ImportSystemErrorDialog open message="boom" raw={undefined} onClose={() => {}} />);
    fireEvent.click(screen.getByTestId('ImportSystemErrorDialog__copy'));
    await Promise.resolve();
    expect(writeText).toHaveBeenCalledWith('boom');
  });
});
