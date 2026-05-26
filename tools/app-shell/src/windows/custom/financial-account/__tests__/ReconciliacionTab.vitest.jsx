import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ReconciliacionTab } from '../ReconciliacionTab';

vi.mock('@/i18n', () => ({ useUI: () => (k) => k }));
vi.mock('lucide-react', () => ({ Scale: () => <svg data-testid="scale-icon" /> }));

describe('ReconciliacionTab', () => {
  it('renders the coming-soon placeholder label', () => {
    render(<ReconciliacionTab />);
    expect(screen.getByText('financeAccountDetailTabComingInT6')).toBeDefined();
  });

  it('renders the Scale icon', () => {
    render(<ReconciliacionTab />);
    expect(screen.getByTestId('scale-icon')).toBeDefined();
  });
});
