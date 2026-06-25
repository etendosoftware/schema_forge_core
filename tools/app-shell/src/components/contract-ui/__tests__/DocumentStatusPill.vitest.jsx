// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';

import DocumentStatusPill from '../DocumentStatusPill.jsx';

vi.mock('@/i18n', () => ({
  useLocale: vi.fn(() => ({})),
}));

describe('DocumentStatusPill', () => {
  it('returns null when status is empty string', () => {
    const { container } = render(<DocumentStatusPill status="" />);
    expect(container.firstChild).toBeNull();
  });

  it('returns null when status is null', () => {
    const { container } = render(<DocumentStatusPill status={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders the pill element when status is provided', () => {
    render(<DocumentStatusPill status="CO" label="Confirmed" tone="success" />);
    expect(screen.getByTestId('document-status-pill')).toBeInTheDocument();
  });

  it('sets data-status attribute', () => {
    render(<DocumentStatusPill status="DR" label="Draft" tone="warning" />);
    expect(screen.getByTestId('document-status-pill')).toHaveAttribute('data-status', 'DR');
  });

  it('sets data-tone attribute from prop', () => {
    render(<DocumentStatusPill status="CO" label="Confirmed" tone="success" />);
    expect(screen.getByTestId('document-status-pill')).toHaveAttribute('data-tone', 'success');
  });

  it('derives tone from status when tone prop is absent', () => {
    render(<DocumentStatusPill status="CO" label="Confirmed" />);
    const pill = screen.getByTestId('document-status-pill');
    // getStatusTone("CO") → "success"
    expect(pill).toHaveAttribute('data-tone', 'success');
  });

  it('renders the provided label text', () => {
    render(<DocumentStatusPill status="CO" label="My Custom Label" tone="success" />);
    expect(screen.getByText('My Custom Label')).toBeInTheDocument();
  });

  it('uses enumLabels[status] when label is not provided', () => {
    render(<DocumentStatusPill status="CO" enumLabels={{ CO: 'Completado' }} tone="success" />);
    expect(screen.getByText('Completado')).toBeInTheDocument();
  });

  it('renders an icon for success tone', () => {
    render(<DocumentStatusPill status="CO" label="Confirmed" tone="success" />);
    expect(screen.getByTestId('Icon__1e4f01')).toBeInTheDocument();
  });

  it('renders an icon for warning tone', () => {
    render(<DocumentStatusPill status="DR" label="Draft" tone="warning" />);
    expect(screen.getByTestId('Icon__1e4f01')).toBeInTheDocument();
  });

  it('renders an icon for destructive tone', () => {
    render(<DocumentStatusPill status="VO" label="Voided" tone="destructive" />);
    expect(screen.getByTestId('Icon__1e4f01')).toBeInTheDocument();
  });

  it('renders no icon for neutral tone', () => {
    render(<DocumentStatusPill status="XX" label="Unknown" tone="neutral" />);
    expect(screen.queryByTestId('Icon__1e4f01')).not.toBeInTheDocument();
  });
});
