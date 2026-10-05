import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { DistinctValuesFilter } from '../distinct-values-filter.jsx';

const CODES = ['RPR', 'RPAP', 'RPVOID', 'PPM'];
const LABELS = {
  RPR: 'Ejecutado',
  RPAP: 'Pendiente',
  RPVOID: 'Anulado',
  PPM: 'Otro',
};
function labelFor(code) {
  return LABELS[code] ?? code;
}

function setup(props = {}) {
  const onChange = vi.fn();
  render(
    <DistinctValuesFilter
      value={props.value ?? null}
      onChange={onChange}
      codes={CODES}
      labelFor={labelFor}
      allLabel="Todos los estados"
      searchPlaceholder="Buscar..."
    />,
  );
  return { onChange };
}

describe('DistinctValuesFilter', () => {
  it('shows the "all" label on the trigger when value is null', () => {
    setup({ value: null });
    expect(screen.getByText('Todos los estados')).toBeInTheDocument();
  });

  it('shows the label for the selected code on the trigger', () => {
    setup({ value: 'RPR' });
    expect(screen.getByText('Ejecutado')).toBeInTheDocument();
  });

  it('opens the popover and renders one row per code plus the "all" option', async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole('button'));

    // "All" option present
    expect(screen.getAllByText('Todos los estados').length).toBeGreaterThan(0);
    // Each code label rendered
    for (const code of CODES) {
      expect(screen.getByText(LABELS[code])).toBeInTheDocument();
    }
  });

  it('reports null when the "all" row is clicked, and closes the popover', async () => {
    const user = userEvent.setup();
    const { onChange } = setup({ value: 'RPR' });
    await user.click(screen.getByRole('button'));

    // There may be two nodes with the "all" text (trigger label + row);
    // click the one inside the popover (the last one).
    const allRows = screen.getAllByText('Todos los estados');
    fireEvent.click(allRows[allRows.length - 1]);
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('reports the selected code when a row is clicked', async () => {
    const user = userEvent.setup();
    const { onChange } = setup();
    await user.click(screen.getByRole('button'));

    fireEvent.click(screen.getByText('Pendiente'));
    expect(onChange).toHaveBeenCalledWith('RPAP');
  });

  it('filters the list by the search input (matches label or code, case-insensitive)', async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole('button'));

    const search = screen.getByPlaceholderText('Buscar...');
    fireEvent.change(search, { target: { value: 'anu' } });

    // Only "Anulado" survives the filter
    expect(screen.getByText('Anulado')).toBeInTheDocument();
    expect(screen.queryByText('Ejecutado')).not.toBeInTheDocument();
    expect(screen.queryByText('Pendiente')).not.toBeInTheDocument();
  });

  it('also matches the raw code (not just the label)', async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole('button'));

    const search = screen.getByPlaceholderText('Buscar...');
    fireEvent.change(search, { target: { value: 'rpvoid' } });

    expect(screen.getByText('Anulado')).toBeInTheDocument();
    expect(screen.queryByText('Ejecutado')).not.toBeInTheDocument();
  });
});

// ETP-5591 — opt-in multi-select mode.
describe('DistinctValuesFilter — multiple (ETP-5591)', () => {
  function setupMulti(props = {}) {
    const onChange = vi.fn();
    render(
      <DistinctValuesFilter
        multiple
        value={props.value ?? []}
        onChange={onChange}
        codes={CODES}
        labelFor={labelFor}
        allLabel="Todos los estados"
        searchPlaceholder="Buscar..."
        multipleLabel={(n) => `${n} Estados`}
        triggerTestId="status-trigger"
        {...props}
      />,
    );
    return { onChange };
  }

  it('trigger shows allLabel when nothing is selected', () => {
    setupMulti({ value: [] });
    expect(screen.getByTestId('status-trigger')).toHaveTextContent('Todos los estados');
  });

  it('trigger shows the label when exactly one code is selected', () => {
    setupMulti({ value: ['RPAP'] });
    expect(screen.getByTestId('status-trigger')).toHaveTextContent('Pendiente');
  });

  it('trigger shows multipleLabel(count) for two or more', () => {
    setupMulti({ value: ['RPAP', 'RPR'] });
    expect(screen.getByTestId('status-trigger')).toHaveTextContent('2 Estados');
  });

  it('falls back to the joined labels when no multipleLabel is given', () => {
    setupMulti({ value: ['RPAP', 'RPR'], multipleLabel: null });
    expect(screen.getByTestId('status-trigger')).toHaveTextContent('Pendiente, Ejecutado');
  });

  it('toggles a code on and off, keeps the popover open', async () => {
    const user = userEvent.setup();
    const { onChange } = setupMulti({ value: ['RPR'] });
    await user.click(screen.getByTestId('status-trigger'));

    fireEvent.click(screen.getByText('Pendiente'));
    expect(onChange).toHaveBeenLastCalledWith(['RPR', 'RPAP']);
    fireEvent.click(screen.getAllByText('Ejecutado').at(-1));
    expect(onChange).toHaveBeenLastCalledWith([]);
    // Still open: the rows are still rendered.
    expect(screen.getByText('Anulado')).toBeInTheDocument();
  });

  it('the "all" row reports an empty array', async () => {
    const user = userEvent.setup();
    const { onChange } = setupMulti({ value: ['RPR'] });
    await user.click(screen.getByTestId('status-trigger'));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Todos los estados' }));
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('rows render as checkboxes with the selection ticked', async () => {
    const user = userEvent.setup();
    setupMulti({ value: ['RPVOID'] });
    await user.click(screen.getByTestId('status-trigger'));
    expect(screen.getByRole('checkbox', { name: 'Anulado' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('checkbox', { name: 'Pendiente' })).toHaveAttribute('aria-checked', 'false');
  });

  it('passes heading / searchable={false} / renderLabel through to the list', async () => {
    const user = userEvent.setup();
    setupMulti({
      heading: 'Estado',
      searchable: false,
      renderLabel: (code) => <b>{`tag:${labelFor(code)}`}</b>,
    });
    await user.click(screen.getByTestId('status-trigger'));
    expect(screen.getByText('Estado')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Buscar...')).not.toBeInTheDocument();
    expect(screen.getByText('tag:Pendiente')).toBeInTheDocument();
  });
});
