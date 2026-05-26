import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('@/i18n', () => ({
  useUI: () => (key) => {
    const map = {
      financeAccountDetailTabMovements: 'Movimientos',
      financeAccountDetailTabReconciliation: 'Conciliación',
      financeAccountDetailTabStatements: 'Extractos',
    };
    return map[key] ?? key;
  },
}));

import { DetailTabs } from '../DetailTabs.jsx';

describe('DetailTabs', () => {
  it('renders the three tab labels', () => {
    render(
      <DetailTabs
        value="movements"
        onValueChange={() => {}}
        movementsCount={0}
        reconciliationCount={0}
        statementsCount={0}
      />,
    );
    expect(screen.getByText('Movimientos')).toBeInTheDocument();
    expect(screen.getByText('Conciliación')).toBeInTheDocument();
    expect(screen.getByText('Extractos')).toBeInTheDocument();
  });

  it('displays the counts as badges', () => {
    render(
      <DetailTabs
        value="movements"
        onValueChange={() => {}}
        movementsCount={12}
        reconciliationCount={3}
        statementsCount={7}
      />,
    );
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
  });

  it('marks the active tab with aria-selected="true"', () => {
    render(
      <DetailTabs
        value="reconciliation"
        onValueChange={() => {}}
        movementsCount={0}
        reconciliationCount={0}
        statementsCount={0}
      />,
    );
    const reconciliation = screen.getByText('Conciliación').closest('button');
    const movements = screen.getByText('Movimientos').closest('button');
    expect(reconciliation).toHaveAttribute('aria-selected', 'true');
    expect(movements).toHaveAttribute('aria-selected', 'false');
  });

  it('emits the clicked tab via onValueChange', () => {
    const onValueChange = vi.fn();
    render(
      <DetailTabs
        value="movements"
        onValueChange={onValueChange}
        movementsCount={0}
        reconciliationCount={0}
        statementsCount={0}
      />,
    );
    fireEvent.click(screen.getByText('Extractos'));
    expect(onValueChange).toHaveBeenCalledWith('statements');
  });

  it('renders zero badges (badge=0 is treated as a valid number)', () => {
    render(
      <DetailTabs
        value="movements"
        onValueChange={() => {}}
        movementsCount={0}
        reconciliationCount={0}
        statementsCount={0}
      />,
    );
    // Three "0" badges expected — one per tab
    expect(screen.getAllByText('0')).toHaveLength(3);
  });
});
