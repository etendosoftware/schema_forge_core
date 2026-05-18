import { render, screen } from '@testing-library/react';
import { StatusTag } from '../status-tag';

describe('StatusTag', () => {
  it('renders label text', () => {
    render(<StatusTag status="CO" label="Completed" />);
    expect(screen.getByText('Completed')).toBeInTheDocument();
  });

  it('falls back to status as text when no label', () => {
    render(<StatusTag status="CO" />);
    expect(screen.getByText('CO')).toBeInTheDocument();
  });

  it.each([
    ['CO', 'success'],
    ['completed', 'success'],
    ['true', 'success'],
    ['IP', 'warning'],
    ['in process', 'warning'],
    ['VO', 'destructive'],
    ['voided', 'destructive'],
    ['DR', 'neutral'],
    ['unknown-status', 'neutral'],
  ])('maps status="%s" to tone="%s"', (status, expectedTone) => {
    render(<StatusTag status={status} label={`s-${status}`} />);
    const el = screen.getByText(`s-${status}`);
    expect(el.className).toContain(`status-tag--${expectedTone}`);
  });

  it('accepts explicit tone prop that overrides status-derived tone', () => {
    // CO would normally map to "success", but explicit tone overrides
    render(<StatusTag status="CO" tone="destructive" label="Override" />);
    const el = screen.getByText('Override');
    expect(el.className).toContain('status-tag--destructive');
    expect(el.className).not.toContain('status-tag--success');
  });

  it('applies correct CSS classes per tone', () => {
    const { rerender } = render(<StatusTag status="CO" label="s" />);
    expect(screen.getByText('s').className).toContain('status-tag--success');

    rerender(<StatusTag status="VO" label="d" />);
    expect(screen.getByText('d').className).toContain('status-tag--destructive');
  });

  it('merges custom className', () => {
    render(<StatusTag status="CO" label="cls" className="my-cls" />);
    const el = screen.getByText('cls');
    expect(el.className).toContain('my-cls');
  });
});