// @covers packages/app-shell-core/src/components/ui/date-field.jsx
//
// DateField `minDate` / `onMinDateRejected`, executed in jsdom. The sibling date-field.test.js
// is a plain `node --test` source-reading suite (it cannot render JSX), so the picker's
// behaviour lives here.
import { render, screen, fireEvent, within } from '@testing-library/react';

// Core has no `@/` alias — mock by the relative specifier the component imports.
vi.mock('../../../i18n/index.js', () => ({
  useUI: () => (key) => key,
  useLocaleSwitch: () => ({ locale: 'es_ES' }),
}));

import { DateField, resolveDateFieldMin } from '../date-field.jsx';

// "Now" is 2026-11-06 10:00 local; only Date is faked so Radix/RTL timers keep running.
const NOW = new Date(2026, 10, 6, 10, 0);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
});
afterEach(() => {
  vi.useRealTimers();
});

const input = () => screen.getByTestId('due');

/** Type a dd/mm/yyyy date into the field and commit it with blur. */
function typeAndBlur(text) {
  fireEvent.focus(input());
  fireEvent.change(input(), { target: { value: text } });
  fireEvent.blur(input());
}

function openCalendar() {
  fireEvent.click(screen.getByRole('button', { name: 'datePickerOpen' }));
  return screen.getByRole('grid');
}

/** The day button of the rendered month whose cell is `yyyy-MM-dd`. */
function dayButton(grid, iso) {
  const cell = grid.querySelector(`[data-day="${iso}"]`);
  if (!cell) throw new Error(`no calendar cell for ${iso}`);
  return within(cell).getByRole('button');
}

describe('resolveDateFieldMin', () => {
  it('"today" is the local calendar day, even late in the evening', () => {
    expect(resolveDateFieldMin('today', new Date(2026, 10, 6, 23, 45))).toBe('2026-11-06');
  });

  it('a yyyy-MM-dd is taken as is; anything else is ignored', () => {
    expect(resolveDateFieldMin('2026-12-01')).toBe('2026-12-01');
    for (const bad of [undefined, null, '', 'tomorrow', '01/12/2026', 20261201]) {
      expect(resolveDateFieldMin(bad)).toBeNull();
    }
  });
});

describe('DateField — typed value against minDate', () => {
  it('refuses a typed date earlier than "today": no onChange, onMinDateRejected(iso), text reverts', () => {
    const onChange = vi.fn();
    const onMinDateRejected = vi.fn();
    render(<DateField data-testid="due" value="" onChange={onChange} minDate="today" onMinDateRejected={onMinDateRejected} />);
    typeAndBlur('05/11/2026');
    expect(onChange).not.toHaveBeenCalled();
    expect(onMinDateRejected).toHaveBeenCalledWith('2026-11-05');
    expect(input()).toHaveValue('');
  });

  it('reverts to the committed value (not to empty) when the field already held one', () => {
    const onChange = vi.fn();
    const onMinDateRejected = vi.fn();
    render(<DateField data-testid="due" value="2026-11-20" onChange={onChange} minDate="today" onMinDateRejected={onMinDateRejected} />);
    typeAndBlur('01/11/2026');
    expect(onChange).not.toHaveBeenCalled();
    expect(onMinDateRejected).toHaveBeenCalledWith('2026-11-01');
    expect(input()).toHaveValue('20/11/2026');
  });

  it('commits today and later days', () => {
    const onChange = vi.fn();
    const onMinDateRejected = vi.fn();
    const { unmount } = render(<DateField data-testid="due" value="" onChange={onChange} minDate="today" onMinDateRejected={onMinDateRejected} />);
    typeAndBlur('06/11/2026');
    expect(onChange).toHaveBeenLastCalledWith('2026-11-06');
    unmount();
    render(<DateField data-testid="due" value="" onChange={onChange} minDate="today" onMinDateRejected={onMinDateRejected} />);
    typeAndBlur('07/11/2026');
    expect(onChange).toHaveBeenLastCalledWith('2026-11-07');
    expect(onMinDateRejected).not.toHaveBeenCalled();
  });

  it('a fixed minDate refuses the day before it and accepts the day itself', () => {
    const onChange = vi.fn();
    const onMinDateRejected = vi.fn();
    const { unmount } = render(<DateField data-testid="due" value="" onChange={onChange} minDate="2026-12-01" onMinDateRejected={onMinDateRejected} />);
    typeAndBlur('30/11/2026');
    expect(onMinDateRejected).toHaveBeenCalledWith('2026-11-30');
    expect(onChange).not.toHaveBeenCalled();
    unmount();
    render(<DateField data-testid="due" value="" onChange={onChange} minDate="2026-12-01" onMinDateRejected={onMinDateRejected} />);
    typeAndBlur('01/12/2026');
    expect(onChange).toHaveBeenCalledWith('2026-12-01');
  });

  it('leaves alone the value it already holds, even when it is earlier than minDate', () => {
    const onChange = vi.fn();
    const onMinDateRejected = vi.fn();
    render(<DateField data-testid="due" value="2026-10-01" onChange={onChange} minDate="today" onMinDateRejected={onMinDateRejected} />);
    expect(input()).toHaveValue('01/10/2026');
    // Focus and leave without editing, then re-type the same date: neither is a new value.
    fireEvent.focus(input());
    fireEvent.blur(input());
    typeAndBlur('01/10/2026');
    expect(onChange).not.toHaveBeenCalled();
    expect(onMinDateRejected).not.toHaveBeenCalled();
    expect(input()).toHaveValue('01/10/2026');
  });

  it('refuses without throwing when no onMinDateRejected is given', () => {
    const onChange = vi.fn();
    render(<DateField data-testid="due" value="" onChange={onChange} minDate="today" />);
    typeAndBlur('05/11/2026');
    expect(onChange).not.toHaveBeenCalled();
    expect(input()).toHaveValue('');
  });

  it('without minDate a past typed date is committed as before', () => {
    const onChange = vi.fn();
    const onMinDateRejected = vi.fn();
    render(<DateField data-testid="due" value="" onChange={onChange} onMinDateRejected={onMinDateRejected} />);
    typeAndBlur('15/01/2000');
    expect(onChange).toHaveBeenCalledWith('2000-01-15');
    expect(onMinDateRejected).not.toHaveBeenCalled();
  });

  it('an unusable minDate never locks the field', () => {
    const onChange = vi.fn();
    render(<DateField data-testid="due" value="" onChange={onChange} minDate="next-week" />);
    typeAndBlur('15/01/2000');
    expect(onChange).toHaveBeenCalledWith('2000-01-15');
  });
});

describe('DateField — calendar against minDate', () => {
  it('disables the days before "today" and keeps today and later enabled', () => {
    render(<DateField data-testid="due" value="" onChange={vi.fn()} minDate="today" />);
    const grid = openCalendar();
    expect(dayButton(grid, '2026-11-01')).toBeDisabled();
    expect(dayButton(grid, '2026-11-05')).toBeDisabled();
    expect(dayButton(grid, '2026-11-06')).toBeEnabled();
    expect(dayButton(grid, '2026-11-30')).toBeEnabled();
  });

  it('clicking an enabled day commits it', () => {
    const onChange = vi.fn();
    render(<DateField data-testid="due" value="" onChange={onChange} minDate="today" />);
    fireEvent.click(dayButton(openCalendar(), '2026-11-10'));
    expect(onChange).toHaveBeenCalledWith('2026-11-10');
  });

  it('clicking a disabled day commits nothing', () => {
    const onChange = vi.fn();
    render(<DateField data-testid="due" value="" onChange={onChange} minDate="today" />);
    fireEvent.click(dayButton(openCalendar(), '2026-11-03'));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('a fixed minDate disables every day before it, in its own month', () => {
    render(<DateField data-testid="due" value="2026-12-15" onChange={vi.fn()} minDate="2026-12-10" />);
    const grid = openCalendar();
    expect(dayButton(grid, '2026-12-09')).toBeDisabled();
    expect(dayButton(grid, '2026-12-10')).toBeEnabled();
  });

  it('without minDate no day is disabled', () => {
    render(<DateField data-testid="due" value="" onChange={vi.fn()} />);
    const grid = openCalendar();
    expect(dayButton(grid, '2026-11-01')).toBeEnabled();
    expect(dayButton(grid, '2026-11-05')).toBeEnabled();
  });
});
