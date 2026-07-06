import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ImportFileErrorDialog } from '../ImportFileErrorDialog.jsx';

afterEach(() => {
  cleanup();
});

describe('ImportFileErrorDialog', () => {
  it('shows the error message', () => {
    render(<ImportFileErrorDialog message="Duplicate column header: &quot;Email&quot;" onCancel={() => {}} onRetry={() => {}} />);
    expect(screen.getByText(/Duplicate column header/)).toBeDefined();
  });

  it('calls onCancel and onRetry', () => {
    const onCancel = vi.fn();
    const onRetry = vi.fn();
    render(<ImportFileErrorDialog message="x" onCancel={onCancel} onRetry={onRetry} />);
    fireEvent.click(screen.getByText('Cancel'));
    fireEvent.click(screen.getByText('Retry'));
    expect(onCancel).toHaveBeenCalled();
    expect(onRetry).toHaveBeenCalled();
  });
});
