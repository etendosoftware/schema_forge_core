// Mocks BEFORE imports
vi.mock('@/i18n', () => ({
  useUI: () => (key, vars) => {
    if (vars) return key.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? `{${k}}`));
    return key;
  },
  useLocaleSwitch: () => ({ locale: 'es_ES' }),
}));

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));

// Hook mocks — overridable per test via the mutable state objects below.
const linesState = { lines: [], total: 0, loading: false, reload: vi.fn() };
const candidatesState = { candidates: [], loading: false };
const reconcileState = { reconcile: vi.fn().mockResolvedValue({ reconciliationId: 'R1' }), loading: false };

vi.mock('@/hooks/useReconciliation', () => ({
  usePendingStatementLines: () => linesState,
  useCandidateOperations: () => candidatesState,
  useReconcileGroup: () => reconcileState,
}));

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ReconciliationSplitPanel } from '@/components/contract-ui/ReconciliationSplitPanel.jsx';

// ── Fixtures ───────────────────────────────────────────────────────────────────

const LINE_A = { id: 'L1', date: '2026-05-10T00:00:00Z', description: 'Transfer ACME', status: 'pending', amount: -8.31 };
const LINE_B = { id: 'L2', date: '2026-05-11T00:00:00Z', description: 'Payroll', status: 'pending', amount: 1200 };
const LINE_RECONCILED = { id: 'L3', date: '2026-05-12T00:00:00Z', description: 'Done line', status: 'reconciled', amount: 50 };

const CAND_MATCH = {
  id: 'C1', date: '2026-05-10T00:00:00Z', documentNo: 'INV-1', partnerName: 'ACME',
  amount: -8.31, pendingBalance: -8.31, status: 'pending', suggested: true,
};
const CAND_OTHER = {
  id: 'C2', date: '2026-05-09T00:00:00Z', documentNo: 'INV-2', partnerName: 'Globex',
  amount: -100, pendingBalance: -100, status: 'pending', suggested: false,
};

function setLines(lines) {
  linesState.lines = lines;
  linesState.total = lines.length;
}

function setCandidates(candidates) {
  candidatesState.candidates = candidates;
}

function renderPanel(props = {}) {
  const merged = { accountId: 'ACC-1', currency: 'EUR', onReconcileSuccess: vi.fn(), ...props };
  return { ...render(<ReconciliationSplitPanel {...merged} />), props: merged };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ReconciliationSplitPanel', () => {
  beforeEach(() => {
    linesState.lines = [];
    linesState.total = 0;
    linesState.loading = false;
    linesState.reload = vi.fn();
    candidatesState.candidates = [];
    candidatesState.loading = false;
    reconcileState.reconcile = vi.fn().mockResolvedValue({ reconciliationId: 'R1' });
    reconcileState.loading = false;
  });

  it('renders the left panel with the pending statement lines', () => {
    setLines([LINE_A, LINE_B]);
    renderPanel();
    expect(screen.getByTestId('recon-line-row-L1')).toBeInTheDocument();
    expect(screen.getByTestId('recon-line-row-L2')).toBeInTheDocument();
    expect(screen.getByText('Transfer ACME')).toBeInTheDocument();
  });

  it('shows the empty state on the right until a line is selected', () => {
    setLines([LINE_A]);
    renderPanel();
    expect(screen.getByTestId('recon-right-empty')).toBeInTheDocument();
    expect(screen.getByText('financeReconcileRightEmptyTitle')).toBeInTheDocument();
  });

  it('populates the right panel after selecting a line', () => {
    setLines([LINE_A]);
    setCandidates([CAND_MATCH, CAND_OTHER]);
    renderPanel();
    fireEvent.click(screen.getByTestId('recon-line-radio-L1'));
    expect(screen.queryByTestId('recon-right-empty')).not.toBeInTheDocument();
    expect(screen.getByTestId('recon-cand-row-C1')).toBeInTheDocument();
    expect(screen.getByTestId('recon-cand-row-C2')).toBeInTheDocument();
  });

  it('renders the "Suggested" badge on the suggested candidate only', () => {
    setLines([LINE_A]);
    setCandidates([CAND_MATCH, CAND_OTHER]);
    renderPanel();
    fireEvent.click(screen.getByTestId('recon-line-radio-L1'));
    // CAND_MATCH suggested → suggested badge; CAND_OTHER not → pending badge.
    const suggested = screen.getAllByText('financeReconcileBadgeSuggested');
    expect(suggested).toHaveLength(1);
  });

  it('keeps Reconcile disabled while the amounts do not balance', () => {
    setLines([LINE_A]);
    setCandidates([CAND_MATCH, CAND_OTHER]);
    renderPanel();
    fireEvent.click(screen.getByTestId('recon-line-radio-L1'));
    // Select the non-matching candidate (-100 vs line -8.31).
    fireEvent.click(screen.getByTestId('recon-cand-check-C2'));
    expect(screen.getByTestId('recon-action-reconcile')).toBeDisabled();
  });

  it('enables Reconcile when the selected operations balance the line', () => {
    setLines([LINE_A]);
    setCandidates([CAND_MATCH, CAND_OTHER]);
    renderPanel();
    fireEvent.click(screen.getByTestId('recon-line-radio-L1'));
    fireEvent.click(screen.getByTestId('recon-cand-check-C1'));
    expect(screen.getByTestId('recon-action-reconcile')).not.toBeDisabled();
  });

  it('calls reconcile and onReconcileSuccess on a balanced reconcile', async () => {
    setLines([LINE_A]);
    setCandidates([CAND_MATCH]);
    const { props } = renderPanel();
    fireEvent.click(screen.getByTestId('recon-line-radio-L1'));
    fireEvent.click(screen.getByTestId('recon-cand-check-C1'));
    fireEvent.click(screen.getByTestId('recon-action-reconcile'));
    await waitFor(() => expect(reconcileState.reconcile).toHaveBeenCalledTimes(1));
    expect(reconcileState.reconcile).toHaveBeenCalledWith({
      financialAccountId: 'ACC-1',
      statementLineId: 'L1',
      operationIds: ['C1'],
    });
    await waitFor(() => expect(props.onReconcileSuccess).toHaveBeenCalled());
    expect(linesState.reload).toHaveBeenCalled();
  });

  it('shows a disabled "Reactivate" label when a reconciled line is selected', () => {
    setLines([LINE_RECONCILED]);
    setCandidates([CAND_MATCH]);
    renderPanel();
    fireEvent.click(screen.getByTestId('recon-line-radio-L3'));
    const btn = screen.getByTestId('recon-action-reconcile');
    expect(btn).toHaveTextContent('financeReconcileActionReactivate');
    expect(btn).toBeDisabled();
  });

  it('renders the Automatch button disabled', () => {
    setLines([LINE_A]);
    renderPanel();
    expect(screen.getByTestId('recon-automatch')).toBeDisabled();
  });
});
