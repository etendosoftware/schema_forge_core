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

// Mirrors the real hook: candidates only resolve once a line is selected, and
// each (re)load yields a FRESH array reference — which is what drives the
// pre-select `useEffect([candidates])` in the component.
vi.mock('@/hooks/useReconciliation', () => ({
  usePendingStatementLines: () => linesState,
  useCandidateOperations: (_accountId, lineId) => ({
    candidates: lineId ? [...candidatesState.candidates] : [],
    loading: candidatesState.loading,
  }),
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
  id: 'C1', date: '2026-06-10T00:00:00Z', documentNo: 'INV-1', partnerName: 'ACME',
  amount: -8.31, pendingBalance: -8.31, status: 'pending', suggested: true,
};
const CAND_OTHER = {
  id: 'C2', date: '2026-06-09T00:00:00Z', documentNo: 'INV-2', partnerName: 'Globex',
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

  it('renders a back button and movement-style filter controls on the left toolbar', () => {
    const onBack = vi.fn();
    setLines([LINE_A]);
    renderPanel({ onBack });
    fireEvent.click(screen.getByTestId('recon-toolbar-back'));
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(screen.getByText('financeReconcileFilterStatusPending (1)')).toBeInTheDocument();
    expect(screen.getAllByText('dateRangeLast30Days').length).toBeGreaterThan(0);
  });

  it('passes the selected docType filter to the candidates hook', () => {
    setLines([LINE_A]);
    renderPanel();
    fireEvent.click(screen.getByTestId('recon-line-radio-L1'));
    fireEvent.click(screen.getByText('financeReconcileFilterDocTypeAll'));
    fireEvent.click(screen.getByText('financeReconcileFilterDocTypePayments'));
    expect(screen.getByText('financeReconcileFilterDocTypePayments')).toBeInTheDocument();
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
    // CAND_MATCH is suggested → pre-checked automatically; no manual click needed.
    expect(screen.getByTestId('recon-action-reconcile')).not.toBeDisabled();
  });

  it('calls reconcile and onReconcileSuccess on a balanced reconcile', async () => {
    setLines([LINE_A]);
    setCandidates([CAND_MATCH]);
    const { props } = renderPanel();
    fireEvent.click(screen.getByTestId('recon-line-radio-L1'));
    // CAND_MATCH is suggested → pre-checked automatically; go straight to reconcile.
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

  it('clears both left and right selections when cancel selection is clicked', () => {
    setLines([LINE_A]);
    setCandidates([CAND_MATCH, CAND_OTHER]);
    renderPanel();
    fireEvent.click(screen.getByTestId('recon-line-radio-L1'));
    fireEvent.click(screen.getByTestId('recon-cand-check-C1'));

    expect(screen.getByTestId('recon-line-radio-L1')).toBeChecked();
    expect(screen.getByTestId('recon-action-cancel')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('recon-action-cancel'));

    expect(screen.getByTestId('recon-line-radio-L1')).not.toBeChecked();
    expect(screen.queryByTestId('recon-action-cancel')).not.toBeInTheDocument();
    expect(screen.getByTestId('recon-right-empty')).toBeInTheDocument();
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

  // ── Suggested-candidate behavior (ETP-4100 / T6) ──────────────────────────────

  it('floats suggested candidates to the top of the right panel', () => {
    setLines([LINE_A]);
    // Backend returns the suggested candidate AFTER a non-suggested one; the
    // component must reorder so the suggested row renders first.
    setCandidates([CAND_OTHER, CAND_MATCH]);
    renderPanel();
    fireEvent.click(screen.getByTestId('recon-line-radio-L1'));

    const rows = screen
      .getAllByTestId(/^recon-cand-row-/)
      .map((el) => el.getAttribute('data-testid'));
    expect(rows).toEqual(['recon-cand-row-C1', 'recon-cand-row-C2']);
    // The suggested id (C1) precedes the non-suggested id (C2).
    expect(rows.indexOf('recon-cand-row-C1')).toBeLessThan(rows.indexOf('recon-cand-row-C2'));
  });

  it('pre-checks suggested candidates and leaves non-suggested unchecked on load', () => {
    setLines([LINE_A]);
    setCandidates([CAND_OTHER, CAND_MATCH]);
    renderPanel();
    fireEvent.click(screen.getByTestId('recon-line-radio-L1'));

    // No user interaction with the checkboxes — pre-selection comes from `suggested`.
    expect(screen.getByTestId('recon-cand-check-C1')).toBeChecked();
    expect(screen.getByTestId('recon-cand-check-C2')).not.toBeChecked();
  });

  it('reflects the pre-selected suggested count in the reconcile button without any click', () => {
    setLines([LINE_A]);
    // Two suggested candidates whose amounts sum to the line amount (-8.31).
    const CAND_SUGGESTED_A = { ...CAND_MATCH, id: 'C1', amount: -5, pendingBalance: -5, suggested: true };
    const CAND_SUGGESTED_B = { ...CAND_MATCH, id: 'C3', amount: -3.31, pendingBalance: -3.31, suggested: true };
    setCandidates([CAND_OTHER, CAND_SUGGESTED_A, CAND_SUGGESTED_B]);
    renderPanel();
    fireEvent.click(screen.getByTestId('recon-line-radio-L1'));

    // No checkbox clicked — the two suggested candidates are pre-checked, the
    // non-suggested one is not. This drives reconcileCount = 2.
    expect(screen.getByTestId('recon-cand-check-C1')).toBeChecked();
    expect(screen.getByTestId('recon-cand-check-C3')).toBeChecked();
    expect(screen.getByTestId('recon-cand-check-C2')).not.toBeChecked();

    // The reconcile button uses the count-bearing label and, since the pre-selected
    // amounts balance the line (-5 + -3.31 == -8.31), it is immediately enabled.
    const btn = screen.getByTestId('recon-action-reconcile');
    expect(btn).toHaveTextContent('financeReconcileActionReconcileCount');
    expect(btn).not.toBeDisabled();
  });

  it('reconciles the pre-selected suggested candidates without manual checkbox clicks', async () => {
    setLines([LINE_A]);
    setCandidates([CAND_MATCH]); // single suggested candidate balancing the line
    const { props } = renderPanel();
    fireEvent.click(screen.getByTestId('recon-line-radio-L1'));

    // Straight to reconcile — the suggested candidate is already pre-checked.
    expect(screen.getByTestId('recon-cand-check-C1')).toBeChecked();
    fireEvent.click(screen.getByTestId('recon-action-reconcile'));

    await waitFor(() => expect(reconcileState.reconcile).toHaveBeenCalledTimes(1));
    expect(reconcileState.reconcile).toHaveBeenCalledWith({
      financialAccountId: 'ACC-1',
      statementLineId: 'L1',
      operationIds: ['C1'],
    });
    await waitFor(() => expect(props.onReconcileSuccess).toHaveBeenCalled());
  });

  // ── Selected-first ordering (ETP-4100 / T6) ───────────────────────────────────

  it('floats a checked candidate to the very top, above the rest', () => {
    setLines([LINE_A]);
    // No suggested candidates — pure user-driven selection. C2 is rendered last
    // initially; checking it must lift it above C1 (and the others).
    const C1 = { ...CAND_OTHER, id: 'C1', suggested: false };
    const C2 = { ...CAND_OTHER, id: 'C2', suggested: false };
    const C3 = { ...CAND_OTHER, id: 'C3', suggested: false };
    setCandidates([C1, C2, C3]);
    renderPanel();
    fireEvent.click(screen.getByTestId('recon-line-radio-L1'));

    // Initial order mirrors the backend (no suggested → stable).
    let rows = screen.getAllByTestId(/^recon-cand-row-/).map((el) => el.getAttribute('data-testid'));
    expect(rows).toEqual(['recon-cand-row-C1', 'recon-cand-row-C2', 'recon-cand-row-C3']);

    // Check C3 (last row) → it jumps to the top.
    fireEvent.click(screen.getByTestId('recon-cand-check-C3'));
    rows = screen.getAllByTestId(/^recon-cand-row-/).map((el) => el.getAttribute('data-testid'));
    expect(rows[0]).toBe('recon-cand-row-C3');
  });

  it('gathers multiple checked candidates at the top, above the unchecked ones', () => {
    setLines([LINE_A]);
    const C1 = { ...CAND_OTHER, id: 'C1', suggested: false };
    const C2 = { ...CAND_OTHER, id: 'C2', suggested: false };
    const C3 = { ...CAND_OTHER, id: 'C3', suggested: false };
    setCandidates([C1, C2, C3]);
    renderPanel();
    fireEvent.click(screen.getByTestId('recon-line-radio-L1'));

    // Select C3 then C2 — both selected rows gather at the top; C1 stays last.
    fireEvent.click(screen.getByTestId('recon-cand-check-C3'));
    fireEvent.click(screen.getByTestId('recon-cand-check-C2'));

    const rows = screen.getAllByTestId(/^recon-cand-row-/).map((el) => el.getAttribute('data-testid'));
    // The two selected ids occupy the first two slots (sort is stable within the
    // selected group, so their relative order is the original C2-before-C3);
    // the unchecked C1 is pushed to the bottom.
    expect(rows.slice(0, 2).sort()).toEqual(['recon-cand-row-C2', 'recon-cand-row-C3']);
    expect(rows[2]).toBe('recon-cand-row-C1');
  });

});
