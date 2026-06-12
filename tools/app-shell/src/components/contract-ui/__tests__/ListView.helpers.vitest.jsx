import { splitFilterParts } from '../ListView.jsx';

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/hooks/useEntity', () => ({ useEntity: () => ({}), extractErrorMessage: vi.fn() }));
vi.mock('@/hooks/useRowDelete', () => ({ useRowDelete: () => ({ requestDelete: vi.fn(), deleteDialog: null }) }));
vi.mock('@/i18n', () => ({
  useMenuLabel: () => (k) => k,
  useLabel: () => () => '',
  useUI: () => (k) => k,
}));
vi.mock('@/components/CurrentWindowContext', () => ({ useRegisterWindowContext: () => {} }));
vi.mock('@/components/layout/PageMetaContext', () => ({ useSetPageMeta: () => vi.fn() }));
vi.mock('@/components/layout/FavoritesContext', () => ({ useFavorites: () => ({ isFavorite: () => false, toggleFavorite: vi.fn() }) }));
vi.mock('@/lib/gridQuery', () => ({ buildAdvancedFilterCriteria: () => null }));
vi.mock('@/hooks/useWindowFilterPresets', () => ({ useWindowFilterPresets: () => ({ presets: [], savePreset: vi.fn(), deletePreset: vi.fn() }) }));

describe('ListView helpers', () => {
  describe('splitFilterParts', () => {
    it('separates criteria from passthrough params', () => {
      const parts = [
        'criteria=' + encodeURIComponent(JSON.stringify({ fieldName: 'name', operator: 'equals', value: 'test' })),
        'limit=50',
      ];
      const { allCriteria, passthrough } = splitFilterParts(parts);
      expect(allCriteria).toHaveLength(1);
      expect(allCriteria[0].fieldName).toBe('name');
      expect(passthrough.get('limit')).toBe('50');
    });

    it('handles array criteria', () => {
      const arr = [{ fieldName: 'a' }, { fieldName: 'b' }];
      const parts = ['criteria=' + encodeURIComponent(JSON.stringify(arr))];
      const { allCriteria } = splitFilterParts(parts);
      expect(allCriteria).toHaveLength(2);
    });

    it('handles empty parts', () => {
      const { allCriteria, passthrough } = splitFilterParts([]);
      expect(allCriteria).toHaveLength(0);
      expect([...passthrough.entries()]).toHaveLength(0);
    });

    it('ignores malformed JSON in criteria', () => {
      const parts = ['criteria=not-json'];
      const { allCriteria } = splitFilterParts(parts);
      expect(allCriteria).toHaveLength(0);
    });

    it('combines criteria from multiple parts', () => {
      const parts = [
        'criteria=' + encodeURIComponent(JSON.stringify({ fieldName: 'x' })),
        'criteria=' + encodeURIComponent(JSON.stringify({ fieldName: 'y' })),
      ];
      const { allCriteria } = splitFilterParts(parts);
      expect(allCriteria).toHaveLength(2);
    });
  });
});
