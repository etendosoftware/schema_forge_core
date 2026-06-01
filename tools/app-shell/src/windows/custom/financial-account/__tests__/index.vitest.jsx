import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('@/i18n', () => ({
  useUI: () => (key) => key,
}));

const setMetaMock = vi.fn();
vi.mock('@/components/layout/PageMetaContext', () => ({
  useSetPageMeta: (meta) => setMetaMock(meta),
}));

const toastFn = vi.fn();
const toastSuccessFn = vi.fn();
const toastErrorFn = vi.fn();
vi.mock('sonner', () => {
  const toast = (...args) => toastFn(...args);
  toast.success = (...args) => toastSuccessFn(...args);
  toast.error = (...args) => toastErrorFn(...args);
  return { toast };
});

// downloadMovementsCsv touches the DOM/URL APIs — stub it so we only need to
// assert it was invoked with the expected payload.
const downloadCsvMock = vi.fn();
vi.mock('../movementsCsvExport', () => ({
  downloadMovementsCsv: (...args) => downloadCsvMock(...args),
}));

// Stub the hook layer so the test runs without HTTP
const useFinancialAccountMock = vi.fn();
const useAccountMovementsMock = vi.fn();
const useBankStatementsMock = vi.fn();
vi.mock('@/hooks/useFinancialAccount', () => ({
  useFinancialAccount: (...args) => useFinancialAccountMock(...args),
}));
vi.mock('@/hooks/useAccountMovements', () => ({
  useAccountMovements: (...args) => useAccountMovementsMock(...args),
}));
vi.mock('@/hooks/useBankStatements', () => ({
  useBankStatements: (...args) => useBankStatementsMock(...args),
}));

// Stub the three tabs so we can assert which one is mounted
vi.mock('../MovementsTab.jsx', () => ({
  MovementsTab: ({ movements, loading, account }) => (
    <div data-testid="tab-movements">
      <span data-testid="tab-movements-count">{movements.length}</span>
      <span data-testid="tab-movements-loading">{String(loading)}</span>
      <span data-testid="tab-movements-account">{account?.name ?? ''}</span>
    </div>
  ),
}));
vi.mock('../ReconciliationTab.jsx', () => ({
  ReconciliationTab: () => <div data-testid="tab-reconciliation" />,
}));
vi.mock('../ImportedStatementsTab.jsx', () => ({
  ImportedStatementsTab: () => <div data-testid="tab-statements" />,
}));

import FinancialAccountWindow from '../index.jsx';

function setHooks({ account = { id: 'acc-1', name: 'BBVA', pendingCount: 4 }, movements = [], totals = { balance: 0, inflows: 0, outflows: 0, currency: 'EUR' }, loading = false, statements = [] } = {}) {
  useFinancialAccountMock.mockReturnValue({ account, loading: false, error: null, reload: vi.fn() });
  useAccountMovementsMock.mockReturnValue({ movements, totals, loading, error: null, reload: vi.fn() });
  useBankStatementsMock.mockReturnValue({ statements, loading: false, error: null, reload: vi.fn() });
}

describe('FinancialAccountWindow', () => {
  beforeEach(() => {
    setMetaMock.mockClear();
    toastFn.mockClear();
    toastSuccessFn.mockClear();
    toastErrorFn.mockClear();
    downloadCsvMock.mockClear();
    useFinancialAccountMock.mockReset();
    useAccountMovementsMock.mockReset();
    useBankStatementsMock.mockReset();
  });

  it('passes the recordId to all three data hooks', () => {
    setHooks();
    render(<FinancialAccountWindow recordId="acc-1" />);
    expect(useFinancialAccountMock).toHaveBeenCalledWith('acc-1');
    expect(useAccountMovementsMock).toHaveBeenCalledWith('acc-1');
    expect(useBankStatementsMock).toHaveBeenCalledWith('acc-1');
  });

  it('mounts the movements tab by default and passes account + movements + loading through', () => {
    setHooks({
      account: { id: 'acc-1', name: 'BBVA' },
      movements: [{ id: 'm1' }, { id: 'm2' }],
      loading: true,
    });
    render(<FinancialAccountWindow recordId="acc-1" />);

    expect(screen.getByTestId('tab-movements')).toBeInTheDocument();
    expect(screen.getByTestId('tab-movements-count').textContent).toBe('2');
    expect(screen.getByTestId('tab-movements-loading').textContent).toBe('true');
    expect(screen.getByTestId('tab-movements-account').textContent).toBe('BBVA');

    expect(screen.queryByTestId('tab-reconciliation')).not.toBeInTheDocument();
    expect(screen.queryByTestId('tab-statements')).not.toBeInTheDocument();
  });

  it('switches to the reconciliation tab when its trigger is clicked', () => {
    setHooks();
    render(<FinancialAccountWindow recordId="acc-1" />);

    // The DetailTabs component renders three tab buttons; find by their i18n keys.
    fireEvent.click(screen.getByText('financeAccountDetailTabReconciliation'));
    expect(screen.getByTestId('tab-reconciliation')).toBeInTheDocument();
    expect(screen.queryByTestId('tab-movements')).not.toBeInTheDocument();
  });

  it('switches to the statements tab when its trigger is clicked', () => {
    setHooks();
    render(<FinancialAccountWindow recordId="acc-1" />);

    fireEvent.click(screen.getByText('financeAccountDetailTabStatements'));
    expect(screen.getByTestId('tab-statements')).toBeInTheDocument();
  });

  it('shows the "not on movements tab" toast when exporting from another tab', () => {
    setHooks();
    render(<FinancialAccountWindow recordId="acc-1" />);

    // Switch away from the movements tab first.
    fireEvent.click(screen.getByText('financeAccountDetailTabReconciliation'));
    fireEvent.click(screen.getByText('financeAccountDetailExport'));

    expect(toastFn).toHaveBeenCalledWith('financeAccountDetailExportToast');
    expect(downloadCsvMock).not.toHaveBeenCalled();
  });

  it('shows an error toast when exporting an empty movements list', () => {
    setHooks({ movements: [] });
    render(<FinancialAccountWindow recordId="acc-1" />);

    fireEvent.click(screen.getByText('financeAccountDetailExport'));

    expect(toastErrorFn).toHaveBeenCalledWith('financeAccountDetailExportEmpty');
    expect(downloadCsvMock).not.toHaveBeenCalled();
  });

  it('downloads CSV and toasts success when exporting non-empty movements', () => {
    setHooks({
      account: { id: 'acc-1', name: 'BBVA' },
      movements: [{ id: 'm1' }, { id: 'm2' }],
    });
    render(<FinancialAccountWindow recordId="acc-1" />);

    fireEvent.click(screen.getByText('financeAccountDetailExport'));

    expect(downloadCsvMock).toHaveBeenCalledTimes(1);
    const [rows, filename] = downloadCsvMock.mock.calls[0];
    expect(rows).toEqual([{ id: 'm1' }, { id: 'm2' }]);
    expect(filename).toBe('BBVA_movements');
    expect(toastSuccessFn).toHaveBeenCalledWith('financeAccountDetailExportDone');
  });

  it('calls useSetPageMeta with the account name in the breadcrumb', () => {
    setHooks({ account: { id: 'acc-1', name: 'BBVA' } });
    render(<FinancialAccountWindow recordId="acc-1" />);

    expect(setMetaMock).toHaveBeenCalled();
    const lastCall = setMetaMock.mock.calls.at(-1)[0];
    expect(lastCall.title).toBe('BBVA');
    expect(lastCall.breadcrumb).toContain('BBVA');
  });

  it('uses an empty account name when account is null (no crash)', () => {
    setHooks({ account: null });
    render(<FinancialAccountWindow recordId="acc-1" />);
    const lastCall = setMetaMock.mock.calls.at(-1)[0];
    expect(lastCall.title).toBe('');
  });

  it('passes the pendingCount through DetailTabs as the reconciliation count badge', () => {
    setHooks({
      account: { id: 'acc-1', name: 'BBVA', pendingCount: 9 },
      movements: [{ id: 'm1' }, { id: 'm2' }, { id: 'm3' }],
    });
    render(<FinancialAccountWindow recordId="acc-1" />);
    // DetailTabs renders a "9" badge next to the reconciliation trigger.
    // (The movements count badge "3" can collide with the stubbed tab content,
    // so we only assert on the unambiguous reconciliation badge here.)
    expect(screen.getByText('9')).toBeInTheDocument();
  });

  it('passes the statements count through DetailTabs as the statements badge', () => {
    setHooks({
      account: { id: 'acc-1', name: 'BBVA', pendingCount: 0 },
      statements: [{ id: 's1' }, { id: 's2' }, { id: 's3' }, { id: 's4' }, { id: 's5' }, { id: 's6' }, { id: 's7' }],
    });
    render(<FinancialAccountWindow recordId="acc-1" />);
    // DetailTabs renders a "7" badge next to the statements trigger.
    // pendingCount is 0 and movements is empty so "7" is unambiguous here.
    expect(screen.getByText('7')).toBeInTheDocument();
  });
});
