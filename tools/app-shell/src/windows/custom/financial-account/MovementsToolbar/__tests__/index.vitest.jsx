import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('@/i18n', () => ({
  useUI: () => (k) => k,
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

const mockToast = vi.fn();
vi.mock('sonner', () => ({
  toast: (...args) => mockToast(...args),
}));

vi.mock('../StatusFilter', () => ({
  StatusFilter: ({ value, onChange }) => (
    <button
      type="button"
      data-testid="status-filter"
      data-value={String(value)}
      onClick={() => onChange('RPPC')}
    >
      status-filter
    </button>
  ),
}));

vi.mock('../DateRangeFilter', () => ({
  DateRangeFilter: ({ value, onChange }) => (
    <button
      type="button"
      data-testid="date-range-filter"
      data-value={String(value)}
      onClick={() => onChange('preset:last7')}
    >
      date-range-filter
    </button>
  ),
}));

vi.mock('../TypeFilter', () => ({
  TypeFilter: ({ value, onChange }) => (
    <button
      type="button"
      data-testid="type-filter"
      data-value={String(value)}
      onClick={() => onChange('IN')}
    >
      type-filter
    </button>
  ),
}));

vi.mock('../AmountFilter', () => ({
  AmountFilter: ({ value, onChange }) => (
    <button
      type="button"
      data-testid="amount-filter"
      data-value={String(value)}
      onClick={() => onChange('gt:100')}
    >
      amount-filter
    </button>
  ),
}));

import { MovementsToolbar } from '../index.jsx';

const defaultFilters = {
  status: null,
  dateRange: '',
  type: null,
  amount: null,
  search: '',
};

const makeOnFiltersChange = () => {
  const calls = {};
  const fn = vi.fn((key) => {
    const handler = vi.fn();
    calls[key] = handler;
    return handler;
  });
  fn.calls = calls;
  return fn;
};

describe('MovementsToolbar', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockToast.mockClear();
  });

  it('renders the back button and all four filter triggers', () => {
    render(
      <MovementsToolbar filters={defaultFilters} onFiltersChange={() => () => {}} />,
    );

    expect(screen.getByTestId('movements-toolbar-back')).toBeInTheDocument();
    expect(screen.getByTestId('status-filter')).toBeInTheDocument();
    expect(screen.getByTestId('date-range-filter')).toBeInTheDocument();
    expect(screen.getByTestId('type-filter')).toBeInTheDocument();
    expect(screen.getByTestId('amount-filter')).toBeInTheDocument();
  });

  it('renders search input and new-movement button using i18n keys', () => {
    render(
      <MovementsToolbar filters={defaultFilters} onFiltersChange={() => () => {}} />,
    );

    const searchInput = screen.getByTestId('movements-search-input');
    expect(searchInput).toBeInTheDocument();
    expect(searchInput).toHaveAttribute('placeholder', 'financeAccountMovementsSearch');

    expect(
      screen.getByRole('button', { name: 'financeAccountMovementsNew' }),
    ).toBeInTheDocument();
  });

  it('navigates back when back button is clicked', async () => {
    const user = userEvent.setup();
    render(
      <MovementsToolbar filters={defaultFilters} onFiltersChange={() => () => {}} />,
    );

    await user.click(screen.getByTestId('movements-toolbar-back'));
    expect(mockNavigate).toHaveBeenCalledWith(-1);
  });

  it('forwards search input changes through onFiltersChange("search")', async () => {
    const user = userEvent.setup();
    const onFiltersChange = makeOnFiltersChange();

    render(
      <MovementsToolbar filters={defaultFilters} onFiltersChange={onFiltersChange} />,
    );

    const input = screen.getByTestId('movements-search-input');
    await user.type(input, 'abc');

    expect(onFiltersChange).toHaveBeenCalledWith('search');
    // Each typed character creates a change event; the per-key handler should
    // have been invoked at least once with one of the intermediate values.
    const handler = onFiltersChange.calls.search;
    expect(handler).toHaveBeenCalled();
    // Last call should reflect the latest character typed
    const lastCall = handler.mock.calls.at(-1);
    expect(lastCall[0]).toBe('c');
  });

  it('invokes onNewMovement when the new-movement button is clicked', async () => {
    const user = userEvent.setup();
    const onNewMovement = vi.fn();
    render(
      <MovementsToolbar
        filters={defaultFilters}
        onFiltersChange={() => () => {}}
        onNewMovement={onNewMovement}
      />,
    );

    await user.click(
      screen.getByRole('button', { name: 'financeAccountMovementsNew' }),
    );

    expect(onNewMovement).toHaveBeenCalledTimes(1);
    // The placeholder toast behaviour was removed in favour of opening the
    // real NewMovementDialog managed by the parent (MovementsTab).
    expect(mockToast).not.toHaveBeenCalled();
  });

  it('passes the active filter values to child filter components', () => {
    const filters = {
      status: 'RPPC',
      dateRange: 'preset:last7',
      type: 'IN',
      amount: 'gt:100',
      search: 'hello',
    };
    render(
      <MovementsToolbar filters={filters} onFiltersChange={() => () => {}} />,
    );

    expect(screen.getByTestId('status-filter')).toHaveAttribute('data-value', 'RPPC');
    expect(screen.getByTestId('date-range-filter')).toHaveAttribute('data-value', 'preset:last7');
    expect(screen.getByTestId('type-filter')).toHaveAttribute('data-value', 'IN');
    expect(screen.getByTestId('amount-filter')).toHaveAttribute('data-value', 'gt:100');
    expect(screen.getByTestId('movements-search-input')).toHaveValue('hello');
  });

  it('forwards filter child onChange through the curried onFiltersChange(key)', async () => {
    const user = userEvent.setup();
    const onFiltersChange = makeOnFiltersChange();

    render(
      <MovementsToolbar filters={defaultFilters} onFiltersChange={onFiltersChange} />,
    );

    await user.click(screen.getByTestId('status-filter'));
    await user.click(screen.getByTestId('date-range-filter'));
    await user.click(screen.getByTestId('type-filter'));
    await user.click(screen.getByTestId('amount-filter'));

    expect(onFiltersChange.calls.status).toHaveBeenCalledWith('RPPC');
    expect(onFiltersChange.calls.dateRange).toHaveBeenCalledWith('preset:last7');
    expect(onFiltersChange.calls.type).toHaveBeenCalledWith('IN');
    expect(onFiltersChange.calls.amount).toHaveBeenCalledWith('gt:100');
  });
});
