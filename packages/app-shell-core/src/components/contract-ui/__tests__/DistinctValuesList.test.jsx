/**
 * DistinctValuesList — the shared option list behind every "distinct values"
 * popover (enum picker, identifier picker, status pill).
 *
 * ETP-4956 added the optional `activeCodes` ARRAY prop so a consumer can opt
 * into multi-select: every listed code in the array is ticked and `onSelect` is
 * expected to toggle rather than replace. The pre-existing single-select
 * `activeCode` contract must keep behaving exactly as before, since the
 * identifier picker and the status pill still pass it.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { DistinctValuesList } from '../DistinctValuesList.jsx';

// Core vitest runs without `globals: true`, so RTL's automatic afterEach
// cleanup is not registered — do it explicitly to avoid DOM bleed.
afterEach(cleanup);

// jsdom has no IntersectionObserver; the infinite-scroll sentinel only mounts
// when `hasMore` is true, but stub it unconditionally so no case can explode.
globalThis.IntersectionObserver = class {
  observe() {}

  unobserve() {}

  disconnect() {}
};

const makeDistinct = (overrides = {}) => ({
  values: [],
  loading: false,
  loadingMore: false,
  hasMore: false,
  search: '',
  setSearch: vi.fn(),
  loadMore: vi.fn(),
  ...overrides,
});

const LABELS = { DRAFT: 'Borrador', UNRECONCILED: 'Sin conciliar', RECONCILED: 'Conciliado' };
const CODES = ['DRAFT', 'UNRECONCILED', 'RECONCILED'];

function renderList(props = {}) {
  const onSelect = vi.fn();
  const result = render(
    <DistinctValuesList
      allLabel={null}
      codes={CODES}
      labelFor={(code) => LABELS[code] ?? String(code)}
      distinct={makeDistinct()}
      onSelect={onSelect}
      searchPlaceholder="searchValues"
      {...props}
    />,
  );
  return { onSelect, ...result };
}

/** The option row whose visible label is `label`. */
const optionRow = (label) =>
  screen.getAllByRole('button').find((b) => b.textContent === label);

/** Whether that option row renders its check mark. */
const isTicked = (label) =>
  within(optionRow(label)).queryAllByTestId('Check__55c679').length > 0;

describe('DistinctValuesList — single-select (activeCode)', () => {
  it('ticks only the active code', () => {
    renderList({ activeCode: 'UNRECONCILED' });
    expect(isTicked('Sin conciliar')).toBe(true);
    expect(isTicked('Borrador')).toBe(false);
    expect(isTicked('Conciliado')).toBe(false);
  });

  it('ticks nothing when no code is active', () => {
    renderList({ activeCode: null });
    for (const label of Object.values(LABELS)) {
      expect(isTicked(label)).toBe(false);
    }
  });

  it('ticks the "all" row only while nothing is selected', () => {
    const { rerender } = renderList({ allLabel: 'allValues', activeCode: null });
    expect(isTicked('allValues')).toBe(true);

    rerender(
      <DistinctValuesList
        allLabel="allValues"
        activeCode="DRAFT"
        codes={CODES}
        labelFor={(code) => LABELS[code] ?? String(code)}
        distinct={makeDistinct()}
        onSelect={vi.fn()}
        searchPlaceholder="searchValues"
      />,
    );
    expect(isTicked('allValues')).toBe(false);
  });

  it('reports the clicked code to onSelect', async () => {
    const user = userEvent.setup();
    const { onSelect } = renderList({ activeCode: 'DRAFT' });
    await user.click(optionRow('Conciliado'));
    expect(onSelect).toHaveBeenCalledWith('RECONCILED');
  });
});

describe('DistinctValuesList — multi-select (activeCodes, ETP-4956)', () => {
  it('ticks every code in activeCodes', () => {
    renderList({ activeCodes: ['DRAFT', 'RECONCILED'] });
    expect(isTicked('Borrador')).toBe(true);
    expect(isTicked('Conciliado')).toBe(true);
    expect(isTicked('Sin conciliar')).toBe(false);
  });

  it('ticks nothing for an empty activeCodes array', () => {
    renderList({ activeCodes: [] });
    for (const label of Object.values(LABELS)) {
      expect(isTicked(label)).toBe(false);
    }
  });

  it('takes precedence over activeCode when both are passed', () => {
    // `activeCodes` opts the list into multi-select mode wholesale — a stale
    // `activeCode` must not add a phantom tick.
    renderList({ activeCode: 'UNRECONCILED', activeCodes: ['DRAFT'] });
    expect(isTicked('Borrador')).toBe(true);
    expect(isTicked('Sin conciliar')).toBe(false);
  });

  it('compares codes as strings, so numeric and boolean codes still tick', () => {
    render(
      <DistinctValuesList
        allLabel={null}
        codes={[1, 2, true]}
        activeCodes={['1', 'true']}
        labelFor={(code) => `code-${String(code)}`}
        distinct={makeDistinct()}
        onSelect={vi.fn()}
        searchPlaceholder="searchValues"
      />,
    );
    expect(isTicked('code-1')).toBe(true);
    expect(isTicked('code-true')).toBe(true);
    expect(isTicked('code-2')).toBe(false);
  });

  it('hides the "all" row tick as soon as one code is selected', () => {
    renderList({ allLabel: 'allValues', activeCodes: ['DRAFT'] });
    expect(isTicked('allValues')).toBe(false);
    expect(isTicked('Borrador')).toBe(true);
  });

  it('shows the "all" row tick while activeCodes is empty', () => {
    renderList({ allLabel: 'allValues', activeCodes: [] });
    expect(isTicked('allValues')).toBe(true);
  });

  it('reports each clicked code so the consumer can toggle', async () => {
    const user = userEvent.setup();
    const { onSelect } = renderList({ activeCodes: ['DRAFT'] });
    // Clicking an unselected code and an already-selected one both report the
    // raw code; deciding add-vs-remove is the consumer's job.
    await user.click(optionRow('Conciliado'));
    await user.click(optionRow('Borrador'));
    expect(onSelect.mock.calls.map((c) => c[0])).toEqual(['RECONCILED', 'DRAFT']);
  });

  it('reports null for the "all" row so the consumer can clear the selection', async () => {
    const user = userEvent.setup();
    const { onSelect } = renderList({ allLabel: 'allValues', activeCodes: ['DRAFT'] });
    await user.click(optionRow('allValues'));
    expect(onSelect).toHaveBeenCalledWith(null);
  });
});

describe('DistinctValuesList — search and paging surface', () => {
  it('renders the search box with the given placeholder and the current query', () => {
    renderList({ distinct: makeDistinct({ search: 'conc' }) });
    const box = screen.getByPlaceholderText('searchValues');
    expect(box).toHaveValue('conc');
  });

  it('pushes typed text into distinct.setSearch', async () => {
    const user = userEvent.setup();
    const distinct = makeDistinct();
    renderList({ distinct });
    await user.type(screen.getByPlaceholderText('searchValues'), 'c');
    expect(distinct.setSearch).toHaveBeenCalledWith('c');
  });

  it('shows a spinner instead of rows while the first page is loading', () => {
    renderList({ codes: [], distinct: makeDistinct({ loading: true }) });
    expect(screen.getAllByTestId('Loader2__55c679').length).toBeGreaterThan(0);
  });

  it('renders no option rows for an empty code list', () => {
    renderList({ codes: [], allLabel: null });
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });
});

// ETP-5119 — once the enum picker stopped papering over "no match" by dumping
// its whole catalogue back in, an unmatched search legitimately renders zero
// rows. A bare "—" there reads as a broken dropdown, so the caller passes a
// translated "No results" through `emptyLabel`.
describe('DistinctValuesList — empty state', () => {
  it('shows the empty label when a search matched nothing', () => {
    renderList({ codes: [], distinct: makeDistinct({ search: '4' }), emptyLabel: 'Sin resultados' });
    expect(screen.getByText('Sin resultados')).toBeInTheDocument();
  });

  it('stays silent when the list is empty but nothing was searched', () => {
    // No query means "still loading / nothing to say", not "no match".
    renderList({ codes: [], distinct: makeDistinct({ search: '' }), emptyLabel: 'Sin resultados' });
    expect(screen.queryByText('Sin resultados')).not.toBeInTheDocument();
  });

  it('does not show the empty label while the first page is loading', () => {
    renderList({
      codes: [],
      distinct: makeDistinct({ search: '4', loading: true }),
      emptyLabel: 'Sin resultados',
    });
    expect(screen.queryByText('Sin resultados')).not.toBeInTheDocument();
  });

  it('falls back to the dash for a caller that passes no empty label', () => {
    // Keeps pre-ETP-5119 callers rendering exactly as before.
    renderList({ codes: [], distinct: makeDistinct({ search: '4' }) });
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('shows no empty state at all when there are rows to render', () => {
    renderList({ distinct: makeDistinct({ search: 'conc' }), emptyLabel: 'Sin resultados' });
    expect(screen.queryByText('Sin resultados')).not.toBeInTheDocument();
  });
});
