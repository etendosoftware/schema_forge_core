import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ImportConfirmStep } from '../ImportConfirmStep.jsx';

afterEach(() => {
  cleanup();
});

describe('ImportConfirmStep', () => {
  it('shows the import and skip counts', () => {
    render(<ImportConfirmStep importCount={112} skipCount={8} onCancel={() => {}} onConfirm={() => {}} />);
    expect(screen.getByTestId('ImportConfirmStep__importCount').textContent).toMatch(/112/);
    expect(screen.getByTestId('ImportConfirmStep__skipCount').textContent).toMatch(/8/);
  });

  it('calls onCancel and onConfirm', () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    render(<ImportConfirmStep importCount={1} skipCount={0} onCancel={onCancel} onConfirm={onConfirm} />);
    fireEvent.click(screen.getByTestId('ImportConfirmStep__cancel'));
    fireEvent.click(screen.getByTestId('ImportConfirmStep__confirm'));
    expect(onCancel).toHaveBeenCalled();
    expect(onConfirm).toHaveBeenCalled();
  });
});
