import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('@/i18n', () => ({
  useUI: () => (key) => key,
}));

const toastFn = vi.fn();
vi.mock('sonner', () => ({
  toast: (...args) => toastFn(...args),
}));

import { MovementRowKebab } from '../MovementRowKebab.jsx';

describe('MovementRowKebab', () => {
  beforeEach(() => {
    toastFn.mockClear();
  });

  it('renders the kebab trigger with a movement-specific data-testid', () => {
    render(<MovementRowKebab movement={{ id: 'mov-42' }} />);
    expect(screen.getByTestId('movement-row-menu-mov-42')).toBeInTheDocument();
  });

  it('exposes an accessible label on the trigger button', () => {
    render(<MovementRowKebab movement={{ id: 'm1' }} />);
    expect(screen.getByLabelText('Movement actions')).toBeInTheDocument();
  });

  it('opens the menu and renders the three action items', async () => {
    const user = userEvent.setup();
    render(<MovementRowKebab movement={{ id: 'm1' }} />);
    await user.click(screen.getByTestId('movement-row-menu-m1'));

    expect(screen.getByText('financeAccountMovementsRowViewDetail')).toBeInTheDocument();
    expect(screen.getByText('financeAccountMovementsRowUnreconcile')).toBeInTheDocument();
    expect(screen.getByText('financeAccountMovementsRowPost')).toBeInTheDocument();
  });

  it('fires a toast when "View detail" is clicked', async () => {
    const user = userEvent.setup();
    render(<MovementRowKebab movement={{ id: 'm1' }} />);
    await user.click(screen.getByTestId('movement-row-menu-m1'));

    fireEvent.click(screen.getByText('financeAccountMovementsRowViewDetail'));
    expect(toastFn).toHaveBeenCalledWith('financeAccountMovementsRowViewDetailToast');
  });

  it('renders "Unreconcile" and "Post" as disabled items', async () => {
    const user = userEvent.setup();
    render(<MovementRowKebab movement={{ id: 'm1' }} />);
    await user.click(screen.getByTestId('movement-row-menu-m1'));

    // Radix marks disabled menu items via aria-disabled / data-disabled
    const unreconcile = screen.getByText('financeAccountMovementsRowUnreconcile').closest('[role="menuitem"]');
    const post = screen.getByText('financeAccountMovementsRowPost').closest('[role="menuitem"]');
    expect(unreconcile).toHaveAttribute('aria-disabled', 'true');
    expect(post).toHaveAttribute('aria-disabled', 'true');
  });
});
