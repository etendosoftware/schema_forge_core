vi.mock('@/i18n', () => ({
  useUI: () => (key) => key,
}));

vi.mock('react-router-dom', () => ({
  useParams: () => ({}),
  useNavigate: () => vi.fn(),
}));

import { render, screen, waitFor } from '@testing-library/react';
import ArtifactViewerPage from '../ArtifactViewerPage.jsx';

describe('ArtifactViewerPage', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders without crashing', () => {
    globalThis.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ windows: [] }),
    });
    const { container } = render(<ArtifactViewerPage />);
    expect(container).toBeTruthy();
  });

  it('shows the artifacts title', () => {
    globalThis.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ windows: [] }),
    });
    render(<ArtifactViewerPage />);
    expect(screen.getByText('artifactsTitle')).toBeInTheDocument();
  });

  it('shows the "select window" placeholder when no window is selected', () => {
    globalThis.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ windows: [] }),
    });
    render(<ArtifactViewerPage />);
    expect(screen.getByText('selectWindowFromList')).toBeInTheDocument();
  });

  it('renders search input', () => {
    globalThis.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ windows: [] }),
    });
    render(<ArtifactViewerPage />);
    expect(screen.getByPlaceholderText('searchWindows')).toBeInTheDocument();
  });

  it('fetches and displays window list', async () => {
    globalThis.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ windows: ['sales-order', 'purchase-invoice'] }),
    });
    render(<ArtifactViewerPage />);
    await waitFor(() => {
      expect(screen.getByText('sales-order')).toBeInTheDocument();
      expect(screen.getByText('purchase-invoice')).toBeInTheDocument();
    });
  });

  it('shows noWindowsFound when fetch returns empty windows', async () => {
    globalThis.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ windows: [] }),
    });
    render(<ArtifactViewerPage />);
    await waitFor(() => {
      expect(screen.getByText('noWindowsFound')).toBeInTheDocument();
    });
  });

  it('handles fetch failure gracefully', async () => {
    globalThis.fetch.mockRejectedValue(new Error('network'));
    render(<ArtifactViewerPage />);
    // Should still render without crashing
    await waitFor(() => {
      expect(screen.getByText('artifactsTitle')).toBeInTheDocument();
    });
  });
});
