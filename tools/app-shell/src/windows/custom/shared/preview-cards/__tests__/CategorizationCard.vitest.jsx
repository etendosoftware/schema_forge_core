vi.mock('@/i18n', () => ({
  useUI: () => (key) => key,
  useMenuLabel: () => (key) => key,
  useLocaleSwitch: () => ({ locale: 'en_US', setLocale: vi.fn() }),
}));

import { render, screen } from '@testing-library/react';
import CategorizationCard from '../CategorizationCard.jsx';

describe('CategorizationCard', () => {
  it('returns null when rows array is empty', () => {
    const { container } = render(<CategorizationCard rows={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('returns null when rows prop is not provided (defaults to empty)', () => {
    const { container } = render(<CategorizationCard />);
    expect(container.firstChild).toBeNull();
  });

  it('renders the section title key when rows are provided', () => {
    render(<CategorizationCard rows={[{ label: 'Category', value: 'Electronics' }]} />);
    expect(screen.getByText('previewCardCategorization')).toBeInTheDocument();
  });

  it('renders each row label', () => {
    const rows = [
      { label: 'Category', value: 'Electronics' },
      { label: 'Brand', value: 'Acme' },
    ];
    render(<CategorizationCard rows={rows} />);
    expect(screen.getByText('Category')).toBeInTheDocument();
    expect(screen.getByText('Brand')).toBeInTheDocument();
  });

  it('renders each row value', () => {
    const rows = [
      { label: 'Category', value: 'Electronics' },
      { label: 'Brand', value: 'Acme' },
    ];
    render(<CategorizationCard rows={rows} />);
    expect(screen.getByText('Electronics')).toBeInTheDocument();
    expect(screen.getByText('Acme')).toBeInTheDocument();
  });

  it('renders a dash for rows with null value', () => {
    render(<CategorizationCard rows={[{ label: 'Category', value: null }]} />);
    // InfoRow renders '—' for null/undefined values
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('renders multiple rows correctly', () => {
    const rows = [
      { label: 'A', value: 'val-a' },
      { label: 'B', value: 'val-b' },
      { label: 'C', value: 'val-c' },
    ];
    render(<CategorizationCard rows={rows} />);
    expect(screen.getAllByText(/val-/).length).toBe(3);
  });
});
