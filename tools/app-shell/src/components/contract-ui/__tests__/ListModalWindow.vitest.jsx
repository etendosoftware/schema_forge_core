// --- Module mocks (hoisted before the component import) --------------------

// i18n: useUI echoes the key (so banner / titles assert against the key name);
// useMenuLabel echoes the label.
vi.mock('@/i18n', () => ({
  useUI: () => (key) => key,
  useMenuLabel: () => (label) => label,
}));

// Auth: token comes from context unless passed as a prop.
vi.mock('@/auth/AuthContext.jsx', () => ({
  useAuth: () => ({ token: 'ctx-token' }),
}));

// Page meta is a no-op side effect in tests.
vi.mock('@/components/layout/PageMetaContext', () => ({
  useSetPageMeta: () => {},
}));

// Backend error translation: pass-through.
vi.mock('@/lib/backendErrors.js', () => ({
  translateBackendError: (raw) => raw,
}));

// toast: collect calls.
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

// useNeoResource is driven per-test via this mutable holder.
const neoState = { data: [], loading: false, reload: vi.fn() };
vi.mock('@/hooks/useNeoResource.js', () => ({
  useNeoResource: () => neoState,
  getApiBase: () => '',
}));

// Lightweight DataTable stub: records the props it received (so tests can
// assert the filtered `data`) and exposes onNavigate to simulate a row click.
let lastDataTableProps = null;
vi.mock('../DataTable.jsx', () => ({
  DataTable: (props) => {
    lastDataTableProps = props;
    return (
      <div data-testid="data-table">
        <span data-testid="row-count">{(props.data ?? []).length}</span>
        <button
          data-testid="navigate-first"
          onClick={() => props.data?.[0] && props.onNavigate?.(props.data[0])}
        >
          edit-first
        </button>
      </div>
    );
  },
}));

// Lightweight EntityForm stub: records props (so tests can read the seeded
// form `data`, e.g. the auto-priority value).
let lastEntityFormProps = null;
vi.mock('../EntityForm.jsx', () => ({
  EntityForm: (props) => {
    lastEntityFormProps = props;
    return <div data-testid="entity-form" />;
  },
}));

import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ListModalWindow } from '../ListModalWindow.jsx';

const API_BASE = 'http://neo.test';
const ENTITY = 'etgoMatchRuleHeader';

const COLUMNS = [
  { key: 'name', column: 'Name', type: 'string' },
  { key: 'priority', column: 'Priority', type: 'number', inlineEdit: true },
  { key: 'active', column: 'IsActive', type: 'boolean', toggle: true },
];

const FIELDS = [
  { key: 'name', column: 'Name', type: 'text', required: true, section: 'general' },
  { key: 'priority', column: 'Priority', type: 'number', section: 'general' },
];

const SECTIONS = [{ key: 'general' }];

function renderWindow(overrides = {}) {
  const props = {
    entity: ENTITY,
    entityLabel: 'Match Rules',
    columns: COLUMNS,
    fields: FIELDS,
    sections: SECTIONS,
    filters: ['name'],
    config: {},
    api: { baseUrl: '/sws/neo/match-rule' },
    apiBaseUrl: API_BASE,
    token: 'tok-123',
    ...overrides,
  };
  return render(<ListModalWindow {...props} />);
}

beforeEach(() => {
  neoState.data = [];
  neoState.loading = false;
  neoState.reload = vi.fn();
  lastDataTableProps = null;
  lastEntityFormProps = null;
  vi.restoreAllMocks();
  global.fetch = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({}) }));
});

describe('ListModalWindow — toolbar & banner', () => {
  it('renders the "+ New" button (newRecord label by default)', () => {
    renderWindow();
    expect(screen.getByText('newRecord')).toBeInTheDocument();
  });

  it('renders the banner text when config.bannerKey is set', () => {
    renderWindow({ config: { bannerKey: 'matchRuleBanner' } });
    expect(screen.getByText('matchRuleBanner')).toBeInTheDocument();
  });

  it('does not render a banner when config.bannerKey is absent', () => {
    renderWindow();
    expect(screen.queryByText('matchRuleBanner')).not.toBeInTheDocument();
  });
});

describe('ListModalWindow — DataTable rows', () => {
  it('passes the loaded rows through to the DataTable', () => {
    neoState.data = [
      { id: '1', name: 'Alpha' },
      { id: '2', name: 'Beta' },
    ];
    renderWindow();
    expect(screen.getByTestId('row-count').textContent).toBe('2');
    expect(lastDataTableProps.data).toHaveLength(2);
  });
});

describe('ListModalWindow — create modal', () => {
  it('opens the modal (dialog title) when "+ New" is clicked', () => {
    renderWindow({ config: { titleKey: 'matchRuleNewTitle' } });
    expect(screen.queryByText('matchRuleNewTitle')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('newRecord'));
    expect(screen.getByText('matchRuleNewTitle')).toBeInTheDocument();
  });

  it('falls back to createRecord title when no titleKey is configured', () => {
    renderWindow();
    fireEvent.click(screen.getByText('newRecord'));
    expect(screen.getByText('createRecord')).toBeInTheDocument();
  });
});

describe('ListModalWindow — search filtering', () => {
  it('filters rows by the configured filter columns before passing to DataTable', () => {
    neoState.data = [
      { id: '1', name: 'Alpha rule' },
      { id: '2', name: 'Beta rule' },
    ];
    renderWindow({ filters: ['name'] });
    // Initially both rows are shown.
    expect(lastDataTableProps.data).toHaveLength(2);

    const searchBox = screen.getByPlaceholderText('search');
    fireEvent.change(searchBox, { target: { value: 'Alpha' } });

    // Only the matching row should be forwarded to the DataTable.
    expect(lastDataTableProps.data).toHaveLength(1);
    expect(lastDataTableProps.data[0].name).toBe('Alpha rule');
  });
});

describe('ListModalWindow — save method selection', () => {
  it('POSTs to {apiBaseUrl}/{entity} when creating a new record', async () => {
    renderWindow();
    fireEvent.click(screen.getByText('newRecord'));

    // Seed the required field via the stubbed EntityForm onChange.
    await act(async () => {
      lastEntityFormProps.onChange('name', 'New rule');
    });

    await act(async () => {
      fireEvent.click(screen.getByText('save'));
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, opts] = global.fetch.mock.calls[0];
    expect(url).toBe(`${API_BASE}/${ENTITY}`);
    expect(opts.method).toBe('POST');
  });

  it('PUTs to {apiBaseUrl}/{entity}/{id} when editing an existing record', async () => {
    neoState.data = [{ id: 'ROW-42', name: 'Existing' }];
    renderWindow();

    // Simulate a row click (onNavigate) via the stubbed DataTable → opens edit modal.
    await act(async () => {
      fireEvent.click(screen.getByTestId('navigate-first'));
    });

    await act(async () => {
      fireEvent.click(screen.getByText('save'));
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, opts] = global.fetch.mock.calls[0];
    expect(url).toBe(`${API_BASE}/${ENTITY}/ROW-42`);
    expect(opts.method).toBe('PUT');
  });
});

describe('ListModalWindow — auto-priority seeding', () => {
  it('seeds the create form with max(priority)+step', async () => {
    neoState.data = [
      { id: '1', name: 'A', priority: 10 },
      { id: '2', name: 'B', priority: 20 },
    ];
    renderWindow({
      fields: [
        { key: 'name', column: 'Name', type: 'text', required: true, section: 'general' },
        { key: 'priority', column: 'Priority', type: 'number', section: 'general' },
      ],
      config: { autoPriorityField: 'priority', autoPriorityStep: 10 },
    });

    fireEvent.click(screen.getByText('newRecord'));

    // The stubbed EntityForm receives the seeded form data.
    expect(lastEntityFormProps.data.priority).toBe(30);
  });

  it('seeds priority via the body sent to fetch on save', async () => {
    neoState.data = [
      { id: '1', name: 'A', priority: 10 },
      { id: '2', name: 'B', priority: 20 },
    ];
    renderWindow({
      fields: [
        { key: 'name', column: 'Name', type: 'text', required: true, section: 'general' },
        { key: 'priority', column: 'Priority', type: 'number', section: 'general' },
      ],
      config: { autoPriorityField: 'priority', autoPriorityStep: 10 },
    });

    fireEvent.click(screen.getByText('newRecord'));
    await act(async () => {
      lastEntityFormProps.onChange('name', 'New');
    });
    await act(async () => {
      fireEvent.click(screen.getByText('save'));
    });

    const [, opts] = global.fetch.mock.calls[0];
    const body = JSON.parse(opts.body);
    expect(body.priority).toBe(30);
  });
});
