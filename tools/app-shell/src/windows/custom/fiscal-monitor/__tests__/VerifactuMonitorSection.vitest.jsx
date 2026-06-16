// Vitest render tests for VerifactuMonitorSection

const stableApiFetch = vi.fn(() => Promise.resolve({ ok: true, json: async () => ({ response: { data: [], totalRows: 0 } }) }));
const stableSetSelectedIds = vi.fn();

vi.mock('@/i18n', () => ({ useUI: () => (key) => key }));
vi.mock('@/auth/useApiFetch.js', () => ({ useApiFetch: () => stableApiFetch }));
vi.mock('@/components/related-documents/helpers.js', () => ({ neoBase: (u) => u }));
vi.mock('lucide-react', () => ({}));
vi.mock('@/components/ui/checkbox', () => ({
  Checkbox: ({ checked, onChange }) => <input type="checkbox" checked={!!checked} onChange={onChange ?? (() => {})} />,
}));
vi.mock('../FmPrimitives.jsx', () => ({
  StatusPill: ({ estado }) => <span data-testid="status-pill">{estado}</span>,
  NumFactura: ({ n }) => <span>{n}</span>,
  ScrollSentinel: () => null,
  isErrorStatus: () => false,
  PAGE_SIZE: 20,
  ExportIcon: () => <span>export</span>,
  useFmSelection: () => ({
    selectedIds: new Set(),
    setSelectedIds: stableSetSelectedIds,
    allSelected: false,
    someSelected: false,
    handleToggleAll: vi.fn(),
    handleToggleRow: vi.fn(),
  }),
}));
vi.mock('../useFiscalMonitor.js', () => ({
  VF_SPEC: 'monitor-verifactu',
  VF_ACEPTADAS_ENTITY: 'facturasAceptadas',
  VF_PARCIAL_ENTITY: 'facturasParcialmenteAceptadas',
  VF_RECHAZADAS_ENTITY: 'facturasRechazadas',
  VF_INVALIDAS_ENTITY: 'facturasInvalidas',
}));

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import VerifactuMonitorSection from '../VerifactuMonitorSection.jsx';

const baseProps = {
  orgId: 'org-1',
  apiBaseUrl: '/sws/neo/verifactu',
  kpis: { verifactu: { accepted: 5, partiallyAccepted: 1, rejected: 2, invalid: 0 } },
};

describe('VerifactuMonitorSection', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders without crashing with mockRows', () => {
    render(<VerifactuMonitorSection {...baseProps} mockRows={[]} />);
    expect(screen.getByText('fiscalMonitor.export')).toBeInTheDocument();
  });

  it('renders section wrapper by default', () => {
    const { container } = render(<VerifactuMonitorSection {...baseProps} mockRows={[]} />);
    expect(container.querySelector('.fm-section')).toBeTruthy();
  });

  it('skips section wrapper when noWrap is true', () => {
    const { container } = render(<VerifactuMonitorSection {...baseProps} mockRows={[]} noWrap />);
    expect(container.querySelector('.fm-section')).toBeNull();
  });

  it('shows correct and problems filter pills', () => {
    render(<VerifactuMonitorSection {...baseProps} mockRows={[]} />);
    expect(screen.getByText('fiscalMonitor.verifactu.pill.correct')).toBeInTheDocument();
    expect(screen.getByText('fiscalMonitor.verifactu.pill.problems')).toBeInTheDocument();
  });

  it('shows empty state when mockRows is empty', () => {
    render(<VerifactuMonitorSection {...baseProps} mockRows={[]} />);
    expect(screen.getByText('fiscalMonitor.empty')).toBeInTheDocument();
  });

  it('renders table column headers', () => {
    render(<VerifactuMonitorSection {...baseProps} mockRows={[]} />);
    expect(screen.getByText('fiscalMonitor.col.invoiceNumber')).toBeInTheDocument();
    expect(screen.getByText('fiscalMonitor.col.operationType')).toBeInTheDocument();
    expect(screen.getByText('fiscalMonitor.col.csv')).toBeInTheDocument();
    expect(screen.getByText('fiscalMonitor.col.status')).toBeInTheDocument();
    expect(screen.getByText('fiscalMonitor.col.errorReason')).toBeInTheDocument();
  });

  it('calls onTabChange when switching filter', () => {
    const onTabChange = vi.fn();
    render(<VerifactuMonitorSection {...baseProps} mockRows={[]} onTabChange={onTabChange} />);
    fireEvent.click(screen.getByText('fiscalMonitor.verifactu.pill.problems'));
    expect(onTabChange).toHaveBeenCalledWith('problems');
  });

  it('shows pill counts from kpis', () => {
    render(<VerifactuMonitorSection {...baseProps} mockRows={[]} />);
    // correct=5, problems=1+2+0=3
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('fetches from API when no mockRows and orgId exists', async () => {
    render(<VerifactuMonitorSection {...baseProps} mockRows={null} />);
    await waitFor(() => {
      expect(stableApiFetch).toHaveBeenCalled();
    });
  });

  it('renders verifactu-tablecard testid when wrapped', () => {
    render(<VerifactuMonitorSection {...baseProps} mockRows={[]} />);
    expect(screen.getByTestId('verifactu-tablecard')).toBeInTheDocument();
  });
});
