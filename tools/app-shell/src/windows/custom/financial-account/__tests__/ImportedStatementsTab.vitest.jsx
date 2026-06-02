import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('@/i18n', () => ({
  useUI: () => (key) => key,
  useLocaleSwitch: () => ({ locale: 'es_ES' }),
}));

// Stub all heavy children — each has its own test suite. We assert wiring at
// this level: what's mounted in each branch of the state machine, and that
// props flow correctly.
const statementsRef = { value: [] };
const loadingRef = { value: false };
const reloadFn = vi.fn();
vi.mock('@/hooks/useBankStatements', () => ({
  useBankStatements: (accountId) => ({
    statements: statementsRef.value,
    loading: loadingRef.value,
    reload: reloadFn,
    _accountId: accountId, // exposed for one assertion
  }),
}));

vi.mock('../StatementsToolbar', () => ({
  StatementsToolbar: ({
    search, onSearchChange, dateRange, onDateRangeChange,
    status, onStatusChange, onImportClick,
  }) => (
    <div data-testid="stub-toolbar" data-search={search} data-status={status ?? ''}>
      <button type="button" data-testid="toolbar-search" onClick={() => onSearchChange('mayo')} />
      <button type="button" data-testid="toolbar-status" onClick={() => onStatusChange('PARTIAL')} />
      <button type="button" data-testid="toolbar-daterange" onClick={() => onDateRangeChange({ presetId: 'last7' })} />
      <button type="button" data-testid="toolbar-import" onClick={onImportClick} />
    </div>
  ),
}));

vi.mock('../StatementsTable', () => ({
  StatementsTable: ({ statements, loading, currency }) => (
    <div
      data-testid="stub-table"
      data-len={statements.length}
      data-loading={loading ? 'true' : 'false'}
      data-currency={currency}
    >
      {statements.map((s) => (
        <button
          key={s.id}
          type="button"
          data-testid={`row-${s.id}`}
          onClick={() => s.__select?.()}
        >
          {s.documentNo}
        </button>
      ))}
    </div>
  ),
}));

vi.mock('../StatementLinesView', () => ({
  StatementLinesView: ({ statementId, statementName, currency, onBack }) => (
    <div
      data-testid="stub-lines-view"
      data-id={statementId}
      data-name={statementName}
      data-currency={currency}
    >
      <button type="button" data-testid="lines-view-back" onClick={onBack} />
    </div>
  ),
}));

vi.mock('../ImportStatementModal', () => ({
  ImportStatementModal: ({ open, accountId, accountCurrency, onClose, onSuccess }) => (
    <div
      data-testid="stub-import-modal"
      data-open={open ? 'true' : 'false'}
      data-account={accountId ?? ''}
      data-currency={accountCurrency}
    >
      <button type="button" data-testid="import-close" onClick={onClose} />
      <button type="button" data-testid="import-success" onClick={onSuccess} />
    </div>
  ),
}));

import { ImportedStatementsTab } from '../ImportedStatementsTab.jsx';

const ACCOUNT = { id: 'acc-1', currencyIso: 'USD' };
const NOW = new Date();

function isoDaysAgo(n) {
  const d = new Date(NOW);
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

const STATEMENTS = [
  {
    id: 's1', documentNo: 'BS-001', fileName: 'mayo.c43', name: 'Mayo',
    importDate: isoDaysAgo(2),  status: 'PENDING',
  },
  {
    id: 's2', documentNo: 'BS-002', fileName: 'junio.c43', name: 'Junio',
    importDate: isoDaysAgo(20), status: 'PARTIAL',
  },
  {
    id: 's3', documentNo: 'BS-003', fileName: 'old.c43', name: 'Antiguo',
    importDate: isoDaysAgo(400), status: 'RECONCILED',
  },
];

describe('ImportedStatementsTab', () => {
  beforeEach(() => {
    statementsRef.value = STATEMENTS;
    loadingRef.value = false;
    reloadFn.mockReset();
  });

  it('renders the toolbar + table by default and forwards currency from the account', () => {
    render(<ImportedStatementsTab account={ACCOUNT} />);
    expect(screen.getByTestId('stub-toolbar')).toBeInTheDocument();
    expect(screen.getByTestId('stub-table')).toBeInTheDocument();
    expect(screen.getByTestId('stub-table')).toHaveAttribute('data-currency', 'USD');
  });

  it('falls back to "EUR" when account has no currencyIso', () => {
    render(<ImportedStatementsTab account={{ id: 'acc-1' }} />);
    expect(screen.getByTestId('stub-table')).toHaveAttribute('data-currency', 'EUR');
  });

  it('forwards loading state from the hook', () => {
    loadingRef.value = true;
    render(<ImportedStatementsTab account={ACCOUNT} />);
    expect(screen.getByTestId('stub-table')).toHaveAttribute('data-loading', 'true');
  });

  it('passes through all statements when no filters are active', () => {
    render(<ImportedStatementsTab account={ACCOUNT} />);
    expect(screen.getByTestId('stub-table')).toHaveAttribute(
      'data-len', String(STATEMENTS.length),
    );
  });

  it('filters by status when the toolbar emits onStatusChange', async () => {
    const user = userEvent.setup();
    render(<ImportedStatementsTab account={ACCOUNT} />);
    await user.click(screen.getByTestId('toolbar-status'));
    expect(screen.getByTestId('stub-table')).toHaveAttribute('data-len', '1');
  });

  it('filters by date range when the toolbar emits a preset (last7 drops the 20- and 400-day-old rows)', async () => {
    const user = userEvent.setup();
    render(<ImportedStatementsTab account={ACCOUNT} />);
    await user.click(screen.getByTestId('toolbar-daterange'));
    expect(screen.getByTestId('stub-table')).toHaveAttribute('data-len', '1');
  });

  it('filters by search query (case-insensitive substring against fileName / name / documentNo)', async () => {
    const user = userEvent.setup();
    render(<ImportedStatementsTab account={ACCOUNT} />);
    // The stub fires onSearchChange('mayo') — only s1 (fileName=mayo.c43) matches.
    await user.click(screen.getByTestId('toolbar-search'));
    expect(screen.getByTestId('stub-table')).toHaveAttribute('data-len', '1');
  });

  it('opens the import modal when toolbar emits onImportClick', async () => {
    const user = userEvent.setup();
    render(<ImportedStatementsTab account={ACCOUNT} />);
    expect(screen.getByTestId('stub-import-modal')).toHaveAttribute('data-open', 'false');
    await user.click(screen.getByTestId('toolbar-import'));
    expect(screen.getByTestId('stub-import-modal')).toHaveAttribute('data-open', 'true');
  });

  it('closes the import modal via the dialog close handler', async () => {
    const user = userEvent.setup();
    render(<ImportedStatementsTab account={ACCOUNT} />);
    await user.click(screen.getByTestId('toolbar-import'));
    await user.click(screen.getByTestId('import-close'));
    expect(screen.getByTestId('stub-import-modal')).toHaveAttribute('data-open', 'false');
  });

  it('triggers the hook reload when the modal reports success', async () => {
    const user = userEvent.setup();
    render(<ImportedStatementsTab account={ACCOUNT} />);
    await user.click(screen.getByTestId('toolbar-import'));
    await user.click(screen.getByTestId('import-success'));
    expect(reloadFn).toHaveBeenCalledTimes(1);
  });

  it('passes accountId + currency through to the import modal', () => {
    render(<ImportedStatementsTab account={ACCOUNT} />);
    const modal = screen.getByTestId('stub-import-modal');
    expect(modal).toHaveAttribute('data-account', 'acc-1');
    expect(modal).toHaveAttribute('data-currency', 'USD');
  });

  it('passes accountId=null to the import modal when the account is null', () => {
    render(<ImportedStatementsTab account={null} />);
    expect(screen.getByTestId('stub-import-modal')).toHaveAttribute('data-account', '');
  });
});
