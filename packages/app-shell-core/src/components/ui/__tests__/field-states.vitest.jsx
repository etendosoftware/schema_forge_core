import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Input } from '../input.jsx';
import { Select, SelectTrigger, SelectValue } from '../select.jsx';
import { DateField } from '../date-field.jsx';

// ETP-5479: every field primitive must share ONE hover fill, ONE border color and ONE
// disabled treatment. QA found the DateField border darker than the selectors and its
// hover darkening the border instead of filling the field like the others.
const HOVER = 'hover:bg-[hsl(var(--field-hover))]';
const DISABLED_FILL = 'bg-[hsl(var(--field-hover))]';
const DISABLED_BORDER = 'border-[hsl(var(--field-disabled-border))]';

function dateWrapper(testId) {
  // The visual field box is the input's direct parent (it also hosts the calendar button).
  return screen.getByTestId(testId).parentElement;
}

function renderSelect(props = {}) {
  render(
    <Select {...props}>
      <SelectTrigger data-testid="select-trigger">
        <SelectValue placeholder="Pick one" />
      </SelectTrigger>
    </Select>,
  );
  return screen.getByTestId('select-trigger');
}

describe('field primitives share hover, border and disabled styles (ETP-5479)', () => {
  it('Input, SelectTrigger and DateField all use the --field-hover fill on hover', () => {
    render(<Input data-testid="text-input" />);
    render(<DateField data-testid="date-input" value="" onChange={() => {}} />);
    const trigger = renderSelect();

    for (const el of [screen.getByTestId('text-input'), trigger, dateWrapper('date-input')]) {
      expect(el.className).toContain(HOVER);
    }
  });

  it('DateField uses the same semantic control border as Input/Select, not the darker #D1D4DB', () => {
    render(<DateField data-testid="date-input" value="" onChange={() => {}} />);
    const wrapper = dateWrapper('date-input');
    expect(wrapper.className).toContain('border-[hsl(var(--border-control))]');
    expect(wrapper.className).toContain('bg-card');
    expect(wrapper.className).not.toContain('#D1D4DB');
    expect(wrapper.className).not.toContain('bg-white');
    expect(wrapper.className).not.toMatch(/hover:border-/);
  });

  it('DateField text uses semantic tokens (legible on the dark-theme card)', () => {
    render(<DateField data-testid="date-input" value="" onChange={() => {}} />);
    const input = screen.getByTestId('date-input');
    expect(input.className).toContain('text-text-primary');
    expect(input.className).toContain('disabled:text-text-disabled');
    expect(input.className).not.toContain('#121217');
  });

  it('disabled DateField uses the shared disabled fill/border and drops the hover and focus ring', () => {
    render(<DateField data-testid="date-input" value="" onChange={() => {}} disabled />);
    const wrapper = dateWrapper('date-input');
    expect(wrapper.className).toContain(DISABLED_FILL);
    expect(wrapper.className).toContain(DISABLED_BORDER);
    expect(wrapper.className).toContain('text-text-disabled');
    expect(wrapper.className).toContain('cursor-not-allowed');
    expect(wrapper.className).not.toContain(HOVER);
    expect(wrapper.className).not.toContain('focus-within:ring-2');
    expect(wrapper.className).not.toMatch(/opacity-/);
    expect(screen.getByTestId('date-input')).toBeDisabled();
  });

  it('Input and SelectTrigger expose the same disabled fill/border as DateField', () => {
    render(<Input data-testid="text-input" disabled />);
    const trigger = renderSelect({ disabled: true });
    for (const el of [screen.getByTestId('text-input'), trigger]) {
      expect(el.className).toContain(`disabled:${DISABLED_FILL}`);
      expect(el.className).toContain(`disabled:${DISABLED_BORDER}`);
      expect(el).toBeDisabled();
    }
  });

  it('enabled DateField shows the focus ring on focus-within, with the same token as Input/Select', () => {
    render(<DateField data-testid="date-input" value="" onChange={() => {}} />);
    expect(dateWrapper('date-input').className).toContain('focus-within:ring-2 focus-within:ring-focus-ring');
  });
});
