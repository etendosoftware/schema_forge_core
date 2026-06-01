import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';

// ── mock heavy children so we exercise AmortizationLinesTable's own logic ──
vi.mock('@/i18n', () => ({
  useUI: () => (key) => key,
  useLabel: () => (col) => col,
}));

vi.mock('@/components/contract-ui', () => ({
  EntityForm: ({ fields }) => (
    <div data-testid="entity-form">{(fields || []).map(f => f.key).join(',')}</div>
  ),
}));

vi.mock('@/components/contract-ui/SelectorInput', () => ({
  default: ({ field, onChange }) => (
    <button
      data-testid={`selector-${field.key}`}
      onClick={() => onChange('new-val', 'New Label')}
    >
      selector-{field.key}
    </button>
  ),
}));

vi.mock('@/components/ui/add-line-button', () => ({
  AddLineButton: ({ onClick, label }) => (
    <button data-testid="add-line-btn" onClick={onClick}>{label}</button>
  ),
}));

import AmortizationLinesTable from '../AmortizationLinesTable.jsx';

const LINE_FILLED = {
  id: 'line-1',
  asset: 'asset-1',
  'asset$_identifier': 'AS_Module',
  amortizationPercentage: 27.42,
  amortizationAmount: 548.39,
  'currency$_identifier': '€',
  organization: 'org-1',
  'organization$_identifier': 'GOOrg',
  eTADASBpartner: 'bp-1',
  'eTADASBpartner$_identifier': 'Juan Perez',
};

const LINE_EMPTY = {
  id: 'line-2',
  asset: 'asset-2',
  'asset$_identifier': 'Mobiliario',
  amortizationPercentage: 10,
  amortizationAmount: 1200,
};

function mockFetchReturning(rows) {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ response: { data: rows } }),
  });
}

const BASE_PROPS = {
  recordId: 'amort-1',
  data: { id: 'amort-1', processed: 'N' },
  token: 'tok',
  apiBaseUrl: 'http://host/neo/amortization',
  api: { labelOverrides: {} },
  editing: true,
  catalogs: {},
};

beforeEach(() => {
  global.fetch = mockFetchReturning([LINE_FILLED, LINE_EMPTY]);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('AmortizationLinesTable — fetch + render', () => {
  it('fetches lines on mount and renders one row per line', async () => {
    render(<AmortizationLinesTable {...BASE_PROPS} />);
    await waitFor(() => expect(screen.getByText('AS_Module')).toBeInTheDocument());
    expect(screen.getByText('Mobiliario')).toBeInTheDocument();
    // fetch URL targets the lines sub-endpoint with the parent id
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/lines?parentId=amort-1'),
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer tok' }) }),
    );
  });

  it('reports the line count via onCountChange', async () => {
    const onCountChange = vi.fn();
    render(<AmortizationLinesTable {...BASE_PROPS} onCountChange={onCountChange} />);
    await waitFor(() => expect(onCountChange).toHaveBeenCalledWith(2));
  });

  it('renders the column headers from labelOverrides', async () => {
    render(<AmortizationLinesTable {...BASE_PROPS} />);
    await waitFor(() => expect(screen.getByText('A_Asset_ID')).toBeInTheDocument());
    expect(screen.getByText('Amortization_Percentage')).toBeInTheDocument();
    expect(screen.getByText('Amortizationamt')).toBeInTheDocument();
  });
});

describe('AmortizationLinesTable — dimension summary', () => {
  it('shows filled-dimension chips with n/7 counter for a line with dimensions', async () => {
    render(<AmortizationLinesTable {...BASE_PROPS} />);
    await waitFor(() => expect(screen.getByText('Juan Perez')).toBeInTheDocument());
    // Bpartner is one of the 7 visible dimensions; counter shows 1/7
    expect(screen.getByText('1/7')).toBeInTheDocument();
  });

  it('shows the empty "add dimensions" affordance for a line without dimensions', async () => {
    render(<AmortizationLinesTable {...BASE_PROPS} />);
    await waitFor(() => expect(screen.getByText('Mobiliario')).toBeInTheDocument());
    expect(screen.getAllByText('amortizationDimensionsEmpty').length).toBeGreaterThan(0);
  });
});

describe('AmortizationLinesTable — dimension expand', () => {
  it('expands the dimensions panel when the row is clicked', async () => {
    render(<AmortizationLinesTable {...BASE_PROPS} />);
    await waitFor(() => expect(screen.getByText('AS_Module')).toBeInTheDocument());

    fireEvent.click(screen.getByText('AS_Module'));

    // Section title appears and the read-only organization value is shown
    await waitFor(() =>
      expect(screen.getAllByText('amortizationDimensionsTitle').length).toBeGreaterThan(0),
    );
    expect(screen.getByText('GOOrg')).toBeInTheDocument();
  });
});

describe('AmortizationLinesTable — inline editing', () => {
  // The row exposes three buttons: [dimension summary, pencil, trash].
  // The pencil (edit trigger) is index 1.
  function clickEditPencil(container) {
    const row = container.querySelector('[data-row-id="line-1"]');
    const buttons = within(row).getAllByRole('button');
    fireEvent.click(buttons[1]);
  }

  it('shows inline core inputs after clicking the edit pencil', async () => {
    const { container } = render(<AmortizationLinesTable {...BASE_PROPS} />);
    await waitFor(() => expect(screen.getByText('AS_Module')).toBeInTheDocument());

    clickEditPencil(container);

    // Inline editing renders number inputs for percentage/amount.
    await waitFor(() =>
      expect(container.querySelectorAll('input[type="number"]').length).toBeGreaterThan(0),
    );
  });

  it('saves a field via PUT when an inline number input loses focus', async () => {
    const { container } = render(<AmortizationLinesTable {...BASE_PROPS} />);
    await waitFor(() => expect(screen.getByText('AS_Module')).toBeInTheDocument());

    clickEditPencil(container);
    await waitFor(() =>
      expect(container.querySelector('input[type="number"]')).not.toBeNull(),
    );

    const numberInput = container.querySelector('input[type="number"]');
    fireEvent.change(numberInput, { target: { value: '99' } });
    global.fetch.mockClear();
    fireEvent.blur(numberInput);

    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/lines/line-1'),
        expect.objectContaining({ method: 'PUT' }),
      ),
    );
  });
});

describe('AmortizationLinesTable — add and delete', () => {
  it('renders the Add line button when the document is editable', async () => {
    render(<AmortizationLinesTable {...BASE_PROPS} />);
    await waitFor(() => expect(screen.getByTestId('add-line-btn')).toBeInTheDocument());
    expect(screen.getByTestId('add-line-btn')).toHaveTextContent('addLine');
  });

  it('hides the Add line button when the document is processed (read-only)', async () => {
    render(<AmortizationLinesTable {...BASE_PROPS} data={{ id: 'amort-1', processed: 'Y' }} editing={false} />);
    await waitFor(() => expect(screen.getByText('AS_Module')).toBeInTheDocument());
    expect(screen.queryByTestId('add-line-btn')).not.toBeInTheDocument();
  });

  it('opens the inline add-line form when Add line is clicked', async () => {
    render(<AmortizationLinesTable {...BASE_PROPS} />);
    await waitFor(() => expect(screen.getByTestId('add-line-btn')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('add-line-btn'));
    // The add row mounts an EntityForm for the core fields.
    await waitFor(() => expect(screen.getAllByTestId('entity-form').length).toBeGreaterThan(0));
  });
});

describe('AmortizationLinesTable — delete', () => {
  it('deletes a line via DELETE when the trash button is clicked', async () => {
    const { container } = render(<AmortizationLinesTable {...BASE_PROPS} />);
    await waitFor(() => expect(screen.getByText('AS_Module')).toBeInTheDocument());

    // Row buttons: [dimension summary, pencil, trash] → trash is index 2.
    const row = container.querySelector('[data-row-id="line-1"]');
    const trashBtn = within(row).getAllByRole('button')[2];
    global.fetch.mockClear();
    fireEvent.click(trashBtn);

    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/lines/line-1'),
        expect.objectContaining({ method: 'DELETE' }),
      ),
    );
  });
});

describe('AmortizationLinesTable — dimension save', () => {
  it('saves a dimension via PUT when a selector value is chosen in the expand panel', async () => {
    const { container } = render(<AmortizationLinesTable {...BASE_PROPS} />);
    await waitFor(() => expect(screen.getByText('AS_Module')).toBeInTheDocument());

    // Expand the dimensions panel for the editable line.
    fireEvent.click(screen.getByText('AS_Module'));
    await waitFor(() => expect(screen.getByTestId('selector-costcenter')).toBeInTheDocument());

    global.fetch.mockClear();
    fireEvent.click(screen.getByTestId('selector-costcenter'));

    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/lines/line-1'),
        expect.objectContaining({ method: 'PUT' }),
      ),
    );
  });

  it('renders dimension selectors read-only when the document is processed', async () => {
    render(<AmortizationLinesTable {...BASE_PROPS} data={{ id: 'amort-1', processed: 'Y' }} editing={false} />);
    await waitFor(() => expect(screen.getByText('AS_Module')).toBeInTheDocument());
    fireEvent.click(screen.getByText('AS_Module'));
    // Read-only path renders plain inputs, not SelectorInput stubs.
    await waitFor(() =>
      expect(screen.queryByTestId('selector-costcenter')).not.toBeInTheDocument(),
    );
  });
});

describe('AmortizationLinesTable — empty + error states', () => {
  it('reports zero count and renders no data rows when the fetch returns no rows', async () => {
    global.fetch = mockFetchReturning([]);
    const onCountChange = vi.fn();
    const { container } = render(<AmortizationLinesTable {...BASE_PROPS} onCountChange={onCountChange} />);
    await waitFor(() => expect(onCountChange).toHaveBeenCalledWith(0));
    expect(container.querySelector('[data-row-id]')).toBeNull();
    // Add line button still available since the document is editable.
    expect(screen.getByTestId('add-line-btn')).toBeInTheDocument();
  });

  it('falls back to empty (no rows) when the fetch rejects', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('network'));
    const { container } = render(<AmortizationLinesTable {...BASE_PROPS} />);
    await waitFor(() => expect(screen.getByTestId('add-line-btn')).toBeInTheDocument());
    expect(container.querySelector('[data-row-id]')).toBeNull();
  });
});
