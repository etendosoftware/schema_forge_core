vi.mock('@/i18n', () => ({
  useUI: () => (key) => key,
}));

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConfirmResultModal } from '../ConfirmResultModal.jsx';

const CARDS = [
  { icon: '📦', label: 'Receipt 001', color: 'blue', route: '/goods-receipt/1', amount: 100 },
  { icon: '🧾', label: 'Invoice 002', color: 'green', route: '/purchase-invoice/2', amount: 200 },
];

function renderModal(overrides = {}) {
  const defaults = {
    title: 'Operation complete',
    cards: CARDS,
    navigate: vi.fn(),
    ui: (key) => key,
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

  it('renders one card per entry', () => {
    renderModal();
    expect(screen.getByText('Receipt 001')).toBeInTheDocument();
    expect(screen.getByText('Invoice 002')).toBeInTheDocument();
  });

  it('does not render the subtitle when cards is empty', () => {
    renderModal({ cards: [] });
    expect(screen.queryByText('soConfirmedSubtitle')).not.toBeInTheDocument();
  });

  it('calls onClose and navigate when a card is clicked', () => {
    const navigate = vi.fn();
    const onClose = vi.fn();
    renderModal({ navigate, onClose });
    fireEvent.click(screen.getByText('Receipt 001'));
    expect(onClose).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith('/goods-receipt/1');
  });

  it('calls onClose when the close button is clicked', () => {
    const onClose = vi.fn();
    renderModal({ onClose });
    fireEvent.click(screen.getByText('soClose'));
    expect(onClose).toHaveBeenCalled();
  });
});
