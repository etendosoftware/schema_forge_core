import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { ImportProgressStep } from '../ImportProgressStep.jsx';

afterEach(() => {
  cleanup();
});

describe('ImportProgressStep', () => {
  it('shows the percent value', () => {
    render(<ImportProgressStep percent={42} />);
    expect(screen.getByText('42%')).toBeDefined();
  });

  it('sets the progress bar width to the percent value', () => {
    render(<ImportProgressStep percent={42} />);
    expect(screen.getByTestId('ImportProgressStep__bar').style.width).toBe('42%');
  });
});
