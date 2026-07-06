import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ImportConfirmStep } from '../ImportConfirmStep.jsx';

afterEach(() => {
  cleanup();
});

describe('ImportConfirmStep', () => {
  it('shows the import and skip counts', () => {
    render(<ImportConfirmStep importCount={112} skipCount={8} onCancel={() => {}} onConfirm={() => {}} />);
    expect(screen.getByText(/112/)).toBeDefined();
    expect(screen.getByText(/8/)).toBeDefined();
  });

  it('calls onCancel and onConfirm', () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    render(<ImportConfirmStep importCount={1} skipCount={0} onCancel={onCancel} onConfirm={onConfirm} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm import' }));
    expect(onCancel).toHaveBeenCalled();
    expect(onConfirm).toHaveBeenCalled();
  });
});
