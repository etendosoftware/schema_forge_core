// @vitest-environment jsdom
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { toast } from 'sonner';

import NotPostedDocumentsPage from '../NotPostedDocumentsPage.jsx';

vi.mock('@/i18n', () => ({ useUI: () => (key) => key }));
vi.mock('@/components/layout/PageMetaContext', () => ({ useSetPageMeta: () => vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const BASE_URL = '/swebsf/not-posted-documents';
const TOKEN = 'test-token';

const ROWS = [
  {
    documentId: 'doc-1',
    documentType: 'Sales Invoice',
    description: 'INV-001',
    accountingDate: '2024-03-15T00:00:00',
    organization: 'Main Org',
    tableId: 'tbl-1',
  },
  {
    documentId: 'doc-2',
    documentType: 'Purchase Invoice',
    description: 'INV-002',
    accountingDate: '2024-04-20',
    organization: 'Branch',
    tableId: 'tbl-2',
  },
];

function mkFetch(rows = []) {
  return vi.fn((url) => {
    if (url.includes('_mode=filter-options')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          response: {
            data: [
              {
                documentTypes: [{ value: 'SI', label: 'Sales Invoice' }],
                accountingStatuses: [],
              },
            ],
          },
        }),
      });
    }
    return Promise.resolve({
      ok: true,
      json: async () => ({ response: { data: rows } }),
    });
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('NotPostedDocumentsPage', () => {
  it('renders filter controls', async () => {
    globalThis.fetch = mkFetch();
    render(<NotPostedDocumentsPage token={TOKEN} apiBaseUrl={BASE_URL} />);
    await waitFor(() => expect(screen.getByTestId('npd-filter-document-type')).toBeInTheDocument());
    expect(screen.getByTestId('npd-filter-apply')).toBeInTheDocument();
  });

  it('shows empty state when no rows returned', async () => {
    globalThis.fetch = mkFetch([]);
    render(<NotPostedDocumentsPage token={TOKEN} apiBaseUrl={BASE_URL} />);
    await waitFor(() => screen.getByTestId('npd-empty-state'));
  });

  it('renders rows returned by the API', async () => {
    globalThis.fetch = mkFetch(ROWS);
    render(<NotPostedDocumentsPage token={TOKEN} apiBaseUrl={BASE_URL} />);
    await waitFor(() => screen.getByTestId('npd-row-doc-1'));
    expect(screen.getByTestId('npd-row-doc-2')).toBeInTheDocument();
  });

  it('formats accountingDate to YYYY-MM-DD', async () => {
    globalThis.fetch = mkFetch(ROWS);
    render(<NotPostedDocumentsPage token={TOKEN} apiBaseUrl={BASE_URL} />);
    await waitFor(() => screen.getByTestId('npd-row-doc-1'));
    expect(screen.getByText('2024-03-15')).toBeInTheDocument();
  });

  it('sends Authorization Bearer header', async () => {
    globalThis.fetch = mkFetch([]);
    render(<NotPostedDocumentsPage token={TOKEN} apiBaseUrl={BASE_URL} />);
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: `Bearer ${TOKEN}` }),
      }),
    );
  });

  it('selecting a row reveals the bulk post button', async () => {
    globalThis.fetch = mkFetch(ROWS);
    render(<NotPostedDocumentsPage token={TOKEN} apiBaseUrl={BASE_URL} />);
    await waitFor(() => screen.getByTestId('npd-row-checkbox-doc-1'));
    fireEvent.click(screen.getByTestId('npd-row-checkbox-doc-1'));
    expect(screen.getByTestId('npd-post-selected')).toBeInTheDocument();
  });

  it('toggling a selected row hides the bulk post button again', async () => {
    globalThis.fetch = mkFetch(ROWS);
    render(<NotPostedDocumentsPage token={TOKEN} apiBaseUrl={BASE_URL} />);
    await waitFor(() => screen.getByTestId('npd-row-checkbox-doc-1'));
    fireEvent.click(screen.getByTestId('npd-row-checkbox-doc-1'));
    fireEvent.click(screen.getByTestId('npd-row-checkbox-doc-1'));
    expect(screen.queryByTestId('npd-post-selected')).not.toBeInTheDocument();
  });

  it('postRow POSTs to the correct action URL', async () => {
    globalThis.fetch = mkFetch(ROWS);
    render(<NotPostedDocumentsPage token={TOKEN} apiBaseUrl={BASE_URL} />);
    await waitFor(() => screen.getByTestId('npd-post-row-doc-1'));

    globalThis.fetch.mockImplementationOnce(() =>
      Promise.resolve({ ok: true, json: async () => ({ response: { data: [{ success: true }] } }) }),
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId('npd-post-row-doc-1'));
    });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      `${BASE_URL}/header/doc-1/action/post`,
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('postRow without tableId calls toast.error', async () => {
    const rowNoTable = { ...ROWS[0], tableId: null, documentId: 'doc-3' };
    globalThis.fetch = mkFetch([rowNoTable]);
    render(<NotPostedDocumentsPage token={TOKEN} apiBaseUrl={BASE_URL} />);
    await waitFor(() => screen.getByTestId('npd-post-row-doc-3'));

    await act(async () => {
      fireEvent.click(screen.getByTestId('npd-post-row-doc-3'));
    });

    expect(toast.error).toHaveBeenCalled();
  });

  it('shows error message from API on load failure', async () => {
    globalThis.fetch = vi.fn((url) => {
      if (url.includes('_mode=filter-options')) {
        return Promise.resolve({ ok: true, json: async () => ({}) });
      }
      return Promise.resolve({
        ok: false,
        statusText: 'Internal Server Error',
        json: async () => ({ message: 'Something went wrong' }),
      });
    });
    render(<NotPostedDocumentsPage token={TOKEN} apiBaseUrl={BASE_URL} />);
    await waitFor(() => screen.getByText('Something went wrong'));
  });

  it('applies filters as query params when filter button clicked', async () => {
    globalThis.fetch = mkFetch(ROWS);
    render(<NotPostedDocumentsPage token={TOKEN} apiBaseUrl={BASE_URL} />);
    await waitFor(() => screen.getByTestId('npd-filter-apply'));

    fireEvent.change(screen.getByTestId('npd-filter-document-type'), { target: { value: 'SI' } });
    await act(async () => {
      fireEvent.click(screen.getByTestId('npd-filter-apply'));
    });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('document=SI'),
      expect.anything(),
    );
  });
});
