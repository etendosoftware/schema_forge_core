import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ReconciliationTab } from '../ReconciliationTab';

vi.mock('@/i18n', () => ({ useUI: () => (k) => k }));
vi.mock('lucide-react', () => ({ Scale: () => <svg data-testid="scale-icon" /> }));

describe('ReconciliationTab', () => {
  it('renders the coming-soon placeholder label', () => {
    render(<ReconciliationTab />);
    expect(screen.getByText('financeAccountDetailTabComingInT6')).toBeDefined();
  });

  it('renders the Scale icon', () => {
    render(<ReconciliationTab />);
    expect(screen.getByTestId('scale-icon')).toBeDefined();
  });
});
