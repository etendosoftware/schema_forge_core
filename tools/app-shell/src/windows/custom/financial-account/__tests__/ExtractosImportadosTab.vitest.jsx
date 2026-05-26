import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ExtractosImportadosTab } from '../ExtractosImportadosTab';

vi.mock('@/i18n', () => ({ useUI: () => (k) => k }));
vi.mock('lucide-react', () => ({ FileText: () => <svg data-testid="file-icon" /> }));

describe('ExtractosImportadosTab', () => {
  it('renders the coming-soon placeholder label', () => {
    render(<ExtractosImportadosTab />);
    expect(screen.getByText('financeAccountDetailTabStatementsComingSoon')).toBeDefined();
  });

  it('renders the FileText icon', () => {
    render(<ExtractosImportadosTab />);
    expect(screen.getByTestId('file-icon')).toBeDefined();
  });
});
