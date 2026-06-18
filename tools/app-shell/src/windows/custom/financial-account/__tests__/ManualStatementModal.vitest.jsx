import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('@/i18n', () => ({
  useUI: () => (key) => key,
  useLocaleSwitch: () => ({ locale: 'es_ES' }),
}));

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock('sonner', () => ({
  toast: { success: (...a) => toastSuccess(...a), error: (...a) => toastError(...a) },
}));

// Pass-through dialog: skip Radix portal/animation, render children when open.
vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ open, children }) => (open ? <div data-testid="manual-modal">{children}</div> : null),
  DialogContent: ({ children }) => <div>{children}</div>,
}));

// Stub the date field with a native date input that forwards the test id and
// emits the ISO value through onChange (the real component emits "YYYY-MM-DD").
vi.mock('@/components/ui/date-field', () => ({
  DateField: ({ value, onChange, 'data-testid': dataTestId }) => (
    <input type="date" value={value || ''} data-testid={dataTestId}
      onChange={(e) => onChange?.(e.target.value)} />
  ),
}));

const createStatement = vi.fn();
const creatingRef = { value: false };
vi.mock('@/hooks/useCreateStatement', () => ({
  useCreateStatement: () => ({ createStatement, creating: creatingRef.value, error: null }),
}));

const updateStatement = vi.fn();
vi.mock('@/hooks/useStatementActions', () => ({
  useStatementActions: () => ({
    updateStatement, processStatement: vi.fn(), deleteStatement: vi.fn(), busy: false, error: null,
  }),
}));

// Edit mode loads the draft's lines; default to an empty, settled list.
const linesRef = { value: [], loading: false };
vi.mock('@/hooks/useBankStatementLines', () => ({
  useBankStatementLines: () => ({ lines: linesRef.value, loading: linesRef.loading, reload: vi.fn() }),
}));

// The per-line BP / G/L Item lookups hit the network via useAuth; stub them out.
vi.mock('@/hooks/useMovementLookups', () => ({
  useBPartnerLookup: () => ({ results: [], loading: false }),
  useGLItemLookup: () => ({ results: [], loading: false }),
}));

import { ManualStatementModal } from '../ManualStatementModal.jsx';

function renderModal(overrides = {}) {
  const props = {
    open: true,
    accountId: 'acc-1',
    accountCurrency: 'EUR',
    onClose: vi.fn(),
    onSuccess: vi.fn(),
    ...overrides,
  };
  return { ...render(<ManualStatementModal {...props} />), props };
}

describe('ManualStatementModal', () => {
  beforeEach(() => {
    createStatement.mockReset().mockResolvedValue({ id: 'stmt-1', name: 'X', lineCount: 1 });
    updateStatement.mockReset().mockResolvedValue({ id: 'stmt-1', name: 'X', lineCount: 1 });
    toastSuccess.mockReset();
    toastError.mockReset();
    creatingRef.value = false;
    linesRef.value = [];
    linesRef.loading = false;
  });

  it('renders the header fields and the add-lines call-to-action when open', () => {
    renderModal();
    expect(screen.getByTestId('manual-statement-name')).toBeInTheDocument();
    expect(screen.getByTestId('manual-statement-trxdate')).toBeInTheDocument();
    // Lines start collapsed behind a CTA — no editable rows yet.
    expect(screen.getByTestId('manual-statement-add-lines')).toBeInTheDocument();
    expect(screen.queryAllByTestId('manual-line-in')).toHaveLength(0);
  });

  it('does not render when closed', () => {
    renderModal({ open: false });
    expect(screen.queryByTestId('manual-modal')).not.toBeInTheDocument();
  });

  it('commits a complete line to a read-only row and reopens it to edit', async () => {
    const user = userEvent.setup();
    renderModal();
    await user.click(screen.getByTestId('manual-statement-add-lines'));
    // One editable row, no committed (display) rows yet.
    expect(screen.getByTestId('manual-line-editrow')).toBeInTheDocument();
    expect(screen.queryAllByTestId('manual-line-row')).toHaveLength(0);

    // All required fields (date is pre-filled): Reference No + both amounts.
    await user.type(screen.getByTestId('manual-line-ref'), 'REF-1');
    await user.type(screen.getByTestId('manual-line-contactname'), 'Acme');
    await user.type(screen.getByTestId('manual-line-out'), '0');
    await user.type(screen.getByTestId('manual-line-in'), '100');
    // "Add line" commits the complete current row and opens a fresh one.
    await user.click(screen.getByTestId('action-add-line'));

    const committed = screen.getAllByTestId('manual-line-row');
    expect(committed).toHaveLength(1);
    expect(committed[0]).toHaveTextContent('Acme');
    expect(screen.getByTestId('manual-line-editrow')).toBeInTheDocument();

    // Reopening the committed row puts its values back into the edit row.
    await user.click(screen.getByTestId('manual-line-edit'));
    expect(screen.getByTestId('manual-line-contactname')).toHaveValue('Acme');
  });

  it('commits a complete line to a read-only row when clicking outside it', async () => {
    const user = userEvent.setup();
    renderModal();
    await user.click(screen.getByTestId('manual-statement-add-lines'));
    await user.type(screen.getByTestId('manual-line-ref'), 'REF-1');
    await user.type(screen.getByTestId('manual-line-out'), '0');
    await user.type(screen.getByTestId('manual-line-in'), '100');

    // Clicking outside the edit row (on the header name field) commits it.
    await user.click(screen.getByTestId('manual-statement-name'));
    expect(screen.getAllByTestId('manual-line-row')).toHaveLength(1);
    expect(screen.queryByTestId('manual-line-editrow')).not.toBeInTheDocument();
  });

  it('keeps an incomplete line editable when clicking outside it', async () => {
    const user = userEvent.setup();
    renderModal();
    await user.click(screen.getByTestId('manual-statement-add-lines'));
    await user.type(screen.getByTestId('manual-line-in'), '100'); // amounts default to 0,00; Reference No is still missing

    await user.click(screen.getByTestId('manual-statement-name'));
    // Still editable (not committed), since required fields are missing.
    expect(screen.getByTestId('manual-line-editrow')).toBeInTheDocument();
    expect(screen.queryAllByTestId('manual-line-row')).toHaveLength(0);
  });

  it('keeps an incomplete line in edit mode and blocks save with an error toast', async () => {
    const user = userEvent.setup();
    renderModal();
    await user.type(screen.getByTestId('manual-statement-name'), 'Extracto manual');
    await user.click(screen.getByTestId('manual-statement-add-lines'));
    // Amounts default to 0,00; the line stays incomplete because Reference No is missing.
    await user.type(screen.getByTestId('manual-line-in'), '100');
    await user.click(screen.getByTestId('manual-statement-save'));
    expect(toastError).toHaveBeenCalledWith('financeAccountStatementsManualErrorIncompleteLine');
    expect(createStatement).not.toHaveBeenCalled();
  });

  it('removing the only line returns to the add-lines CTA', async () => {
    const user = userEvent.setup();
    renderModal();
    await user.click(screen.getByTestId('manual-statement-add-lines'));
    await user.click(screen.getByTestId('manual-line-remove'));
    expect(screen.getByTestId('manual-statement-add-lines')).toBeInTheDocument();
    expect(screen.queryAllByTestId('manual-line-in')).toHaveLength(0);
  });

  it('blocks saving with a blank name and surfaces an error toast', async () => {
    const user = userEvent.setup();
    renderModal();
    await user.click(screen.getByTestId('manual-statement-add-lines'));
    await user.type(screen.getByTestId('manual-line-in'), '100');
    await user.click(screen.getByTestId('manual-statement-save'));
    expect(toastError).toHaveBeenCalledWith('financeAccountStatementsManualErrorName');
    expect(createStatement).not.toHaveBeenCalled();
  });

  it('blocks saving when there is no usable line', async () => {
    const user = userEvent.setup();
    renderModal();
    // No line added (still on the CTA) — only the header name is filled.
    await user.type(screen.getByTestId('manual-statement-name'), 'Extracto manual');
    await user.click(screen.getByTestId('manual-statement-save'));
    expect(toastError).toHaveBeenCalledWith('financeAccountStatementsManualErrorLines');
    expect(createStatement).not.toHaveBeenCalled();
  });

  it('posts the header + non-blank lines and reports success', async () => {
    const user = userEvent.setup();
    const { props } = renderModal();
    await user.type(screen.getByTestId('manual-statement-name'), 'Extracto manual');
    await user.click(screen.getByTestId('manual-statement-add-lines'));
    await user.type(screen.getByTestId('manual-line-ref'), 'REF-1');
    await user.type(screen.getByTestId('manual-line-contactname'), 'Acme');
    // out keeps its "0,00" default; replace in's default before typing the amount.
    await user.clear(screen.getByTestId('manual-line-in'));
    await user.type(screen.getByTestId('manual-line-in'), '3500,00');
    await user.click(screen.getByTestId('manual-statement-save'));

    await waitFor(() => expect(createStatement).toHaveBeenCalledTimes(1));
    const payload = createStatement.mock.calls[0][0];
    expect(payload.accountId).toBe('acc-1');
    expect(payload.name).toBe('Extracto manual');
    expect(payload.transactionDate).toMatch(/T00:00:00Z$/);
    expect(payload.importDate).toMatch(/T00:00:00Z$/);
    expect(payload).toHaveProperty('fileName');
    expect(payload).toHaveProperty('notes');
    // Primary action saves AND processes.
    expect(payload.process).toBe(true);
    expect(payload.lines).toHaveLength(1);
    expect(payload.lines[0].bpartnerName).toBe('Acme');
    // Spanish "3500,00" is parsed to a plain Number.
    expect(payload.lines[0].in).toBe(3500);
    expect(payload.lines[0].out).toBe(0);
    // FK fields default to null when no lookup item was chosen.
    expect(payload.lines[0].bpartnerId).toBeNull();
    expect(payload.lines[0].glItemId).toBeNull();
    expect(payload.lines[0].reference).toBe('REF-1');

    expect(toastSuccess).toHaveBeenCalledWith('financeAccountStatementsManualSuccess');
    expect(props.onSuccess).toHaveBeenCalled();
    expect(props.onClose).toHaveBeenCalled();
  });

  it('renders the per-line description input and includes it in the saved payload', async () => {
    const user = userEvent.setup();
    renderModal();
    await user.type(screen.getByTestId('manual-statement-name'), 'Extracto manual');
    await user.click(screen.getByTestId('manual-statement-add-lines'));

    // The editable line row exposes a Descripción input.
    const descInput = screen.getByTestId('manual-line-description');
    expect(descInput).toBeInTheDocument();

    await user.type(descInput, 'Comisión banco');
    await user.type(screen.getByTestId('manual-line-ref'), 'REF-1');
    await user.clear(screen.getByTestId('manual-line-in'));
    await user.type(screen.getByTestId('manual-line-in'), '100');
    await user.click(screen.getByTestId('manual-statement-save'));

    await waitFor(() => expect(createStatement).toHaveBeenCalledTimes(1));
    const payload = createStatement.mock.calls[0][0];
    expect(payload.lines).toHaveLength(1);
    expect(payload.lines[0].description).toBe('Comisión banco');
  });

  it('shows a committed line description in its read-only display row', async () => {
    const user = userEvent.setup();
    renderModal();
    await user.click(screen.getByTestId('manual-statement-add-lines'));
    await user.type(screen.getByTestId('manual-line-description'), 'Pago nómina');
    await user.type(screen.getByTestId('manual-line-ref'), 'REF-1');
    await user.type(screen.getByTestId('manual-line-out'), '0');
    await user.type(screen.getByTestId('manual-line-in'), '100');
    // Commit the line by adding a fresh one.
    await user.click(screen.getByTestId('action-add-line'));

    const committed = screen.getAllByTestId('manual-line-row');
    expect(committed).toHaveLength(1);
    expect(committed[0]).toHaveTextContent('Pago nómina');
  });

  it('saves as a draft (process=false) from the split menu', async () => {
    const user = userEvent.setup();
    renderModal();
    await user.type(screen.getByTestId('manual-statement-name'), 'Extracto manual');
    await user.click(screen.getByTestId('manual-statement-add-lines'));
    await user.type(screen.getByTestId('manual-line-ref'), 'REF-1');
    await user.type(screen.getByTestId('manual-line-out'), '0');
    await user.type(screen.getByTestId('manual-line-in'), '50');

    await user.click(screen.getByTestId('manual-statement-save-split'));
    await user.click(screen.getByTestId('manual-statement-save-draft'));

    await waitFor(() => expect(createStatement).toHaveBeenCalledTimes(1));
    expect(createStatement.mock.calls[0][0].process).toBe(false);
  });

  it('shows an error toast when the backend call fails', async () => {
    createStatement.mockRejectedValueOnce(new Error('HTTP 500'));
    const user = userEvent.setup();
    renderModal();
    await user.type(screen.getByTestId('manual-statement-name'), 'Extracto manual');
    await user.click(screen.getByTestId('manual-statement-add-lines'));
    await user.type(screen.getByTestId('manual-line-ref'), 'REF-1');
    await user.type(screen.getByTestId('manual-line-out'), '0');
    await user.type(screen.getByTestId('manual-line-in'), '10');
    await user.click(screen.getByTestId('manual-statement-save'));
    await waitFor(() => expect(toastError).toHaveBeenCalledWith('financeAccountStatementsManualError'));
  });

  it('closes directly when nothing was changed', async () => {
    const user = userEvent.setup();
    const { props } = renderModal();
    await user.click(screen.getByTestId('manual-statement-cancel'));
    expect(screen.queryByTestId('manual-discard-overlay')).not.toBeInTheDocument();
    expect(props.onClose).toHaveBeenCalled();
  });

  it('asks to discard before closing when there are unsaved changes', async () => {
    const user = userEvent.setup();
    const { props } = renderModal();
    await user.type(screen.getByTestId('manual-statement-name'), 'Algo');
    await user.click(screen.getByTestId('manual-statement-cancel'));
    expect(screen.getByTestId('manual-discard-overlay')).toBeInTheDocument();
    expect(props.onClose).not.toHaveBeenCalled();
  });

  it('discards and closes when confirming the discard prompt', async () => {
    const user = userEvent.setup();
    const { props } = renderModal();
    await user.type(screen.getByTestId('manual-statement-name'), 'Algo');
    await user.click(screen.getByTestId('manual-statement-cancel'));
    await user.click(screen.getByTestId('manual-discard-confirm'));
    expect(props.onClose).toHaveBeenCalled();
  });

  it('keeps the modal open when choosing "keep editing"', async () => {
    const user = userEvent.setup();
    const { props } = renderModal();
    await user.type(screen.getByTestId('manual-statement-name'), 'Algo');
    await user.click(screen.getByTestId('manual-statement-cancel'));
    await user.click(screen.getByTestId('manual-discard-keep'));
    expect(screen.queryByTestId('manual-discard-overlay')).not.toBeInTheDocument();
    expect(props.onClose).not.toHaveBeenCalled();
    expect(screen.getByTestId('manual-statement-name')).toHaveValue('Algo');
  });

  describe('edit mode', () => {
    const STATEMENT = {
      id: 'st-9', name: 'Extracto mayo', documentNo: '1000025',
      transactionDate: '2026-05-10T00:00:00Z', importDate: '2026-05-11T00:00:00Z',
      fileName: 'mayo.csv', notes: 'Notas',
    };

    it('hydrates the header + lines from the draft and updates on save', async () => {
      linesRef.value = [{
        id: 'ln-1', date: '2026-05-09T00:00:00Z', reference: 'REF9', description: '',
        bpartnerName: 'Acme', bpartnerId: 'bp-1', bpartnerFkName: 'Acme S.L.',
        glItemId: 'gl-1', glItemName: 'Comisiones', in: 250, out: 0,
      }];
      const user = userEvent.setup();
      const { props } = renderModal({ statement: STATEMENT });

      // Header is seeded from the statement.
      expect(screen.getByTestId('manual-statement-name')).toHaveValue('Extracto mayo');
      // The committed line is shown read-only (not the empty CTA).
      expect(screen.getByTestId('manual-line-row')).toHaveTextContent('Acme');

      await user.click(screen.getByTestId('manual-statement-save'));

      await waitFor(() => expect(updateStatement).toHaveBeenCalledTimes(1));
      expect(createStatement).not.toHaveBeenCalled();
      const payload = updateStatement.mock.calls[0][0];
      expect(payload.id).toBe('st-9');
      expect(payload.name).toBe('Extracto mayo');
      expect(payload.process).toBe(true);
      expect(payload.lines).toHaveLength(1);
      expect(payload.lines[0].bpartnerId).toBe('bp-1');
      expect(payload.lines[0].glItemId).toBe('gl-1');
      expect(payload.lines[0].in).toBe(250);
      expect(props.onSuccess).toHaveBeenCalled();
      // Editing reports "updated", not "created".
      expect(toastSuccess).toHaveBeenCalledWith('financeAccountStatementsManualUpdateSuccess');
      expect(toastSuccess).not.toHaveBeenCalledWith('financeAccountStatementsManualSuccess');
    });
  });
});
