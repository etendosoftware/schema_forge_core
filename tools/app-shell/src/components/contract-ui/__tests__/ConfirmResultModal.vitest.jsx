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
});
