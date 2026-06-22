/**
 * Tests for BillingPreferencesForm — pure helper logic + basic render.
 */
import { render, screen } from '@testing-library/react';
import BillingPreferencesForm from '../BillingPreferencesForm';

vi.mock('@/i18n', () => ({
  useUI: () => (k) => k,
}));
vi.mock('@/components/contract-ui', () => ({
  EntityForm: ({ fields }) => (
    <div data-testid="entity-form">{fields?.map(f => <span key={f.key}>{f.key}</span>)}</div>
  ),
}));

// Replicate internal resolveId
function resolveId(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'object') {
    const id = value.id ?? value.value ?? null;
    return id == null || id === '' ? null : String(id);
  }
  return String(value);
}

describe('BillingPreferencesForm', () => {
  describe('resolveId (pure helper)', () => {
    it('returns null for null/undefined/empty', () => {
      expect(resolveId(null)).toBeNull();
      expect(resolveId(undefined)).toBeNull();
      expect(resolveId('')).toBeNull();
    });

    it('returns string for string input', () => {
      expect(resolveId('ABC')).toBe('ABC');
    });

    it('extracts id from object', () => {
      expect(resolveId({ id: '123', name: 'Test' })).toBe('123');
    });

    it('extracts value from object when no id', () => {
      expect(resolveId({ value: 'V1' })).toBe('V1');
    });

    it('returns null for object with empty id', () => {
      expect(resolveId({ id: '' })).toBeNull();
    });
  });

  describe('render', () => {
    it('shows after-save message when no bpId', () => {
      render(<BillingPreferencesForm data={{}} />);
      expect(screen.getByText('billingPreferencesAfterSave')).toBeInTheDocument();
    });

    it('renders entity forms when bpId exists', () => {
      globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ response: { data: [] } }) });
      render(<BillingPreferencesForm data={{ id: 'BP1' }} token="t" apiBaseUrl="/api" onChange={vi.fn()} />);
      expect(screen.getAllByTestId('entity-form').length).toBeGreaterThan(0);
    });
  });
});
