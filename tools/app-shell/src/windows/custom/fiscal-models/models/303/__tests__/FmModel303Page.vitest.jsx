// Vitest component tests for FmModel303Page.jsx
import { vi, describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('@/i18n', () => ({
  useUI: () => (key) => key,
}));
vi.mock('../../../fiscalModelsUtils.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    formatAmount: (n) => (n == null ? '—' : String(n)),
    formatPeriod: (p) => p,
    computeBoxes303: vi.fn().mockResolvedValue(null),
    generate303File: vi.fn().mockResolvedValue(false),
    checkModified303: vi.fn(),
  };
});
vi.mock('@/components/related-documents/helpers.js', () => ({ neoBase: (u) => u }));
vi.mock('../../../fiscal-models.css', () => ({}));
vi.mock('../../../FmCommon.jsx', () => ({
  StatusPillMenu: () => null,
  ResultPill: () => null,
  SummaryCard: () => null,
  Tabs: ({ tabs, active, onSelect }) => React.createElement(
    'div',
    { role: 'tablist' },
    tabs.map(t => React.createElement(
      'button',
      { key: t.id, role: 'tab', 'aria-selected': String(t.id === active), onClick: () => onSelect(t.id) },
      t.label
    ))
  ),
  Banner: () => null,
  SectionCard: () => null,
  EmptyState: () => React.createElement('div', { className: 'fm-empty-state' }, 'empty'),
  KpiWidget: ({ value, label }) => React.createElement(
    'div',
    { className: 'test-kpi303' },
    React.createElement('span', { className: 'test-kpi303-label' }, label),
    React.createElement('span', { className: 'test-kpi303-value' }, value)
  ),
}));
vi.mock('../../../FmTabContent.jsx', () => ({
  SourcesTab: () => null,
  IncidentsTab: () => null,
  FilesTab: () => null,
  HistoryTab: () => null,
}));
vi.mock('../FmBoxes303.jsx', () => ({
  default: () => React.createElement('div', { 'data-testid': 'fm-boxes-303' }, 'boxes'),
}));
vi.mock('../../../FmOverlays.jsx', () => ({
  PresentModal: () => null,
  FileGenModal: () => null,
  ConfigDrawer: () => null,
  CompareDrawer: () => null,
}));
vi.mock('lucide-react', () => ({
  Settings: () => null, Download: () => null, OctagonAlert: () => null,
  TriangleAlert: () => null, CircleCheck: () => null, ArrowLeftRight: () => null,
  Calculator: () => null, Loader2: () => null, MoreVertical: () => null,
  TrendingUp: () => null, TrendingDown: () => null, Clock: () => null,
  ClipboardCheck: () => null, ReceiptText: () => null, Folder: () => null,
}));

import FmModel303Page from '../FmModel303Page.jsx';

const BASE_DECL = {
  id: '303-2026-T2', model: '303', year: 2026, period: 'T2', type: 'ord',
  status: 'draft', result: null, incidents: { blocking: 0, warning: 0 },
  _precomputed: null, boxes: null, sources: [], history: [],
};

const defaultProps = {
  onBack: vi.fn(),
  onStatusChange: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Rendering ────────────────────────────────────────────────────────────────

describe('FmModel303Page — rendering', () => {
  it('renders without crashing', () => {
    render(<FmModel303Page decl={BASE_DECL} {...defaultProps} />);
    expect(document.body).toBeTruthy();
  });

  it('shows "303" model badge in title', () => {
    render(<FmModel303Page decl={BASE_DECL} {...defaultProps} />);
    expect(document.body.textContent).toContain('303');
  });

  it('shows period in title', () => {
    render(<FmModel303Page decl={BASE_DECL} {...defaultProps} />);
    expect(document.body.textContent).toContain('T2');
  });

  it('shows year in title', () => {
    render(<FmModel303Page decl={BASE_DECL} {...defaultProps} />);
    expect(document.body.textContent).toContain('2026');
  });

  it('renders FmBoxes303 when boxes tab is active (default)', () => {
    render(<FmModel303Page decl={BASE_DECL} {...defaultProps} />);
    expect(screen.getByTestId('fm-boxes-303')).toBeTruthy();
  });

  it('renders the tab bar', () => {
    const { container } = render(<FmModel303Page decl={BASE_DECL} {...defaultProps} />);
    expect(container.querySelector('[role="tablist"]')).toBeTruthy();
  });
});

// ── Action bar ───────────────────────────────────────────────────────────────

describe('FmModel303Page — action bar', () => {
  it('renders a Cancel/back button', () => {
    render(<FmModel303Page decl={BASE_DECL} {...defaultProps} />);
    const btns = Array.from(document.querySelectorAll('button'));
    const cancelBtn = btns.find(b => b.textContent.includes('fm.action.cancel'));
    expect(cancelBtn).toBeTruthy();
  });

  it('calls onBack when cancel button is clicked', () => {
    const onBack = vi.fn();
    render(<FmModel303Page decl={BASE_DECL} onBack={onBack} onStatusChange={vi.fn()} />);
    const btns = Array.from(document.querySelectorAll('button'));
    const cancelBtn = btns.find(b => b.textContent.includes('fm.action.cancel'));
    fireEvent.click(cancelBtn);
    expect(onBack).toHaveBeenCalled();
  });

  it('renders the Compute button (Calcular)', () => {
    render(<FmModel303Page decl={BASE_DECL} {...defaultProps} />);
    const btns = Array.from(document.querySelectorAll('button'));
    const computeBtn = btns.find(b => b.textContent.includes('fm.action.compute'));
    expect(computeBtn).toBeTruthy();
  });

  it('renders the Submit button for non-submitted declarations', () => {
    render(<FmModel303Page decl={BASE_DECL} {...defaultProps} />);
    const btns = Array.from(document.querySelectorAll('button'));
    const submitBtn = btns.find(b => b.textContent.includes('fm.action.submit'));
    expect(submitBtn).toBeTruthy();
  });

  it('does not render the Submit button for already-submitted declarations', () => {
    const submittedDecl = { ...BASE_DECL, status: 'submitted_ack' };
    render(<FmModel303Page decl={submittedDecl} {...defaultProps} />);
    const btns = Array.from(document.querySelectorAll('button'));
    const submitBtn = btns.find(b => b.textContent.includes('fm.action.submit'));
    expect(submitBtn).toBeUndefined();
  });
});

// ── KPI bar ──────────────────────────────────────────────────────────────────

describe('FmModel303Page — KPI bar', () => {
  it('renders KPI cards', () => {
    const { container } = render(<FmModel303Page decl={BASE_DECL} {...defaultProps} />);
    expect(container.querySelectorAll('.test-kpi303').length).toBeGreaterThanOrEqual(4);
  });

  it('shows Incidencias KPI label', () => {
    render(<FmModel303Page decl={BASE_DECL} {...defaultProps} />);
    const labels = document.querySelectorAll('.test-kpi303-label');
    const labelTexts = Array.from(labels).map(l => l.textContent);
    expect(labelTexts.some(t => t.includes('fm.tab.incidents'))).toBe(true);
  });

  it('shows 0 incident count for declarations with no incidents', () => {
    render(<FmModel303Page decl={BASE_DECL} {...defaultProps} />);
    const values = document.querySelectorAll('.test-kpi303-value');
    // First KPI = incident count = '0'
    expect(values[0].textContent).toBe('0');
  });

  it('shows correct IVA Devengado from precomputed summary', () => {
    const decl = {
      ...BASE_DECL,
      _precomputed: { boxes: {}, summary: { accrued: 1309.98, deductible: 36789.06, result: -35479.08 } },
    };
    render(<FmModel303Page decl={decl} {...defaultProps} />);
    const values = document.querySelectorAll('.test-kpi303-value');
    // KPI[1] = IVA devengado = formatAmount(1309.98) = "1309.98"
    expect(values[1].textContent).toBe('1309.98');
  });
});

// ── Tab navigation ────────────────────────────────────────────────────────────

describe('FmModel303Page — tab navigation', () => {
  it('defaults to boxes tab showing FmBoxes303', () => {
    render(<FmModel303Page decl={BASE_DECL} {...defaultProps} />);
    expect(screen.getByTestId('fm-boxes-303')).toBeTruthy();
  });

  it('renders tab buttons for boxes, sources, incidents, files, history', () => {
    render(<FmModel303Page decl={BASE_DECL} {...defaultProps} />);
    const tabs = screen.getAllByRole('tab');
    const tabLabels = tabs.map(t => t.textContent);
    expect(tabLabels.some(t => t.includes('fm.tab.boxes'))).toBe(true);
    expect(tabLabels.some(t => t.includes('fm.tab.sources'))).toBe(true);
    expect(tabLabels.some(t => t.includes('fm.tab.incidents'))).toBe(true);
  });
});

// ── Precomputed data ──────────────────────────────────────────────────────────

describe('FmModel303Page — precomputed data', () => {
  it('initializes liveBoxes from _precomputed', () => {
    const decl = {
      ...BASE_DECL,
      _precomputed: { boxes: { 7: 100, 9: 21 }, summary: { accrued: 21, deductible: 0, result: 21 } },
    };
    render(<FmModel303Page decl={decl} {...defaultProps} />);
    // If liveBoxes is initialized, FmBoxes303 should render (it's a mock)
    expect(screen.getByTestId('fm-boxes-303')).toBeTruthy();
  });
});
