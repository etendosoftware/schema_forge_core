import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('@/i18n', () => ({
  useUI: () => (key) => {
    const map = {
      financeAccountsFilterAll: 'Todas las cuentas',
      financeAccountsTypeBank: 'Banco',
      financeAccountsTypeCash: 'Caja',
      financeAccountsTypeCard: 'Tarjeta',
    };
    return map[key] ?? key;
  },
}));

import { AccountTypeFilter } from '../AccountTypeFilter.jsx';

describe('AccountTypeFilter', () => {
  it('renders the trigger with the "all" label when no value is selected', () => {
    render(<AccountTypeFilter value={null} onChange={vi.fn()} />);
    const trigger = screen.getByTestId('account-type-filter-trigger');
    expect(trigger).toHaveTextContent('Todas las cuentas');
  });

  it('renders the trigger with the selected option label', () => {
    render(<AccountTypeFilter value="B" onChange={vi.fn()} />);
    expect(screen.getByTestId('account-type-filter-trigger')).toHaveTextContent('Banco');
  });

  it('opens the popover and shows all type options', () => {
    render(<AccountTypeFilter value={null} onChange={vi.fn()} />);
    fireEvent.click(screen.getByTestId('account-type-filter-trigger'));
    expect(screen.getByTestId('account-type-filter-option-all')).toBeInTheDocument();
    expect(screen.getByTestId('account-type-filter-option-b')).toBeInTheDocument();
    expect(screen.getByTestId('account-type-filter-option-c')).toBeInTheDocument();
    expect(screen.getByTestId('account-type-filter-option-t')).toBeInTheDocument();
  });

  it('reports null when "all" is selected', () => {
    const onChange = vi.fn();
    render(<AccountTypeFilter value="B" onChange={onChange} />);
    fireEvent.click(screen.getByTestId('account-type-filter-trigger'));
    fireEvent.click(screen.getByTestId('account-type-filter-option-all'));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('reports the type code when a specific type is chosen', () => {
    const onChange = vi.fn();
    render(<AccountTypeFilter value={null} onChange={onChange} />);
    fireEvent.click(screen.getByTestId('account-type-filter-trigger'));
    fireEvent.click(screen.getByTestId('account-type-filter-option-c'));
    expect(onChange).toHaveBeenCalledWith('C');
  });
});
