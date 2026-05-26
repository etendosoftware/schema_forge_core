import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ImportedStatementsTab } from '../ImportedStatementsTab';

vi.mock('@/i18n', () => ({ useUI: () => (k) => k }));
vi.mock('lucide-react', () => ({ FileText: () => <svg data-testid="file-icon" /> }));

describe('ImportedStatementsTab', () => {
  it('renders the coming-soon placeholder label', () => {
    render(<ImportedStatementsTab />);
    expect(screen.getByText('financeAccountDetailTabStatementsComingSoon')).toBeDefined();
  });

  it('renders the FileText icon', () => {
    render(<ImportedStatementsTab />);
    expect(screen.getByTestId('file-icon')).toBeDefined();
  });
});
