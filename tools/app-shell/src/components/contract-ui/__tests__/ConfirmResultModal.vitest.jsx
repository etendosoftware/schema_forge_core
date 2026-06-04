vi.mock('@/i18n', () => ({
  useUI: () => (key, vars) => {
    if (vars) return key.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? `{${k}}`);
    return key;
  },
}));

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConfirmResultModal } from '../ConfirmResultModal.jsx';

const DOCS = [
  { type: 'entrada',      num: 'GR-001', amount: 100,  route: '/goods-receipt/1' },
  { type: 'facturaCompra', num: 'PI-002', amount: 200,  route: '/purchase-invoice/2' },
];

function renderModal(overrides = {}) {
  const defaults = {
    title: 'Operation complete',
    docs: DOCS,
    navigate: vi.fn(),
    currency: 'EUR',
    onClose: vi.fn(),
  };
  return render(<ConfirmResultModal {...defaults} {...overrides} />);
}

describe('ConfirmResultModal', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders the title', () => {
    renderModal();
    expect(screen.getByText('Operation complete')).toBeInTheDocument();
  });

  it('renders the type label for each doc', () => {
    renderModal();
    expect(screen.getByText('confirmResultModal.docType.entrada')).toBeInTheDocument();
    expect(screen.getByText('confirmResultModal.docType.facturaCompra')).toBeInTheDocument();
  });

  it('renders doc numbers', () => {
    renderModal();
    expect(screen.getByText('GR-001')).toBeInTheDocument();
    expect(screen.getByText('PI-002')).toBeInTheDocument();
  });

  it('shows plural subtitle for multiple docs', () => {
    renderModal();
    expect(screen.getByText('confirmResultModal.subtitleMany')).toBeInTheDocument();
  });

  it('shows singular subtitle for a single doc', () => {
    renderModal({ docs: [DOCS[0]] });
    expect(screen.getByText('confirmResultModal.subtitleOne')).toBeInTheDocument();
  });

  it('shows no subtitle when docs is empty', () => {
    renderModal({ docs: [] });
    expect(screen.queryByText('confirmResultModal.subtitleOne')).not.toBeInTheDocument();
    expect(screen.queryByText('confirmResultModal.subtitleMany')).not.toBeInTheDocument();
  });

  it('navigates and closes when a doc card is clicked', () => {
    const navigate = vi.fn();
    const onClose  = vi.fn();
    renderModal({ navigate, onClose });
    fireEvent.click(screen.getByText('GR-001'));
    expect(onClose).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith('/goods-receipt/1');
  });

  it('closes when the close button is clicked (without reloading)', () => {
    const onClose = vi.fn();
    renderModal({ onClose });
    fireEvent.click(screen.getByText('soClose'));
    expect(onClose).toHaveBeenCalled();
  });

  it('shows primary button for a single doc when primary is provided', () => {
    const navigate = vi.fn();
    const onClose  = vi.fn();
    renderModal({ docs: [DOCS[0]], primary: 'View receipt', navigate, onClose });
    const btn = screen.getByText('View receipt');
    expect(btn).toBeInTheDocument();
    fireEvent.click(btn);
    expect(onClose).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith('/goods-receipt/1');
  });

  it('does not show primary button for multiple docs', () => {
    renderModal({ primary: 'View' });
    expect(screen.queryByText('View')).not.toBeInTheDocument();
  });

  it('does not show primary button when primary is not provided', () => {
    renderModal({ docs: [DOCS[0]] });
    expect(screen.queryByRole('button', { name: /view/i })).not.toBeInTheDocument();
  });

  it('activates doc card with Enter key', () => {
    const navigate = vi.fn();
    const onClose  = vi.fn();
    renderModal({ navigate, onClose });
    fireEvent.keyDown(screen.getByText('GR-001').closest('[role="button"]'), { key: 'Enter' });
    expect(onClose).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith('/goods-receipt/1');
  });

  it('activates doc card with Space key', () => {
    const navigate = vi.fn();
    const onClose  = vi.fn();
    renderModal({ navigate, onClose });
    fireEvent.keyDown(screen.getByText('GR-001').closest('[role="button"]'), { key: ' ' });
    expect(onClose).toHaveBeenCalled();
  });

  it('ignores other keys on doc card', () => {
    const navigate = vi.fn();
    renderModal({ navigate });
    fireEvent.keyDown(screen.getByText('GR-001').closest('[role="button"]'), { key: 'Tab' });
    expect(navigate).not.toHaveBeenCalled();
  });

  it('triggers hover state on mouse enter/leave', () => {
    renderModal({ docs: [DOCS[0]] });
    const card = screen.getByText('GR-001').closest('[role="button"]');
    fireEvent.mouseEnter(card);
    fireEvent.mouseLeave(card);
  });

  it('triggers focus/blur handlers on doc card', () => {
    renderModal({ docs: [DOCS[0]] });
    const card = screen.getByText('GR-001').closest('[role="button"]');
    fireEvent.focus(card);
    fireEvent.blur(card);
  });

  it('shows doc.status badge when provided', () => {
    renderModal({ docs: [{ type: 'entrada', num: 'GR-X', status: 'Completado', route: '/r' }] });
    expect(screen.getByText('Completado')).toBeInTheDocument();
  });

  it('falls back to statusDraft when doc.status is not provided', () => {
    renderModal({ docs: [{ type: 'entrada', num: 'GR-Y', route: '/r' }] });
    expect(screen.getByText('statusDraft')).toBeInTheDocument();
  });

  it('renders amount span when amount is provided', () => {
    renderModal({ docs: [{ type: 'entrada', num: 'GR-Z', amount: 1234.5, route: '/r' }], currency: '' });
    const card = screen.getByText('GR-Z').closest('[role="button"]');
    expect(card.querySelector('span[style*="color"]')).toBeTruthy();
  });
});
