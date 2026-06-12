/**
 * Tests for pure helper functions extracted from DetailView.jsx.
 * We import only the exported functions — internal ones are tested
 * indirectly through their callers or via source-reading.
 */
import {
  getCustomLinesTabClassName,
  getWindowTitle,
  getRecordTitle,
  getFullBreadcrumb,
  getOnAddToFavorites,
  getLinesContainerClassName,
  getDeleteChildButtonLabel,
  runAddLineAction,
  insertLinesTab,
} from '../DetailView.jsx';

// Mock all the heavy dependencies DetailView imports
vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
  useSearchParams: () => [new URLSearchParams(), vi.fn()],
  useLocation: () => ({ pathname: '/', search: '' }),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock('@/hooks/useEntity', () => ({ useEntity: () => ({}), extractErrorMessage: vi.fn() }));
vi.mock('@/hooks/useCatalogs', () => ({ useCatalogs: () => ({}) }));
vi.mock('@/hooks/useDisplayLogic', () => ({ useDisplayLogic: () => ({}) }));
vi.mock('@/hooks/useCallout', () => ({ useCallout: () => ({}) }));
vi.mock('@/hooks/useCurrency', () => ({ useCurrency: () => ({}) }));
vi.mock('@/hooks/useLineGrossAmount', () => ({ useLineGrossAmount: () => ({}), ORDER_LINE_CONFIG: {} }));
vi.mock('@/hooks/useDocumentAction', () => ({ useDocumentAction: () => ({}) }));
vi.mock('@/i18n', () => ({ useMenuLabel: () => (k) => k, useUI: () => (k) => k, useLabel: () => () => '' }));
vi.mock('@/components/layout/PageMetaContext', () => ({ useSetPageMeta: () => vi.fn() }));
vi.mock('@/components/layout/FavoritesContext', () => ({ useFavorites: () => ({ isFavorite: () => false, toggleFavorite: vi.fn() }) }));
vi.mock('@/components/CurrentWindowContext', () => ({ useRegisterWindowContext: () => {} }));
vi.mock('@/components/copilot/ocr/ocrDocTypes', () => ({ matchOcrDocType: () => null }));
vi.mock('@/lib/selectorContext.js', () => ({ buildHeaderSelectorContext: () => ({}), buildLineSelectorContext: () => ({}) }));
vi.mock('@/lib/selectorCatalog.js', () => ({ getCatalogOptions: () => [] }));
vi.mock('@/lib/formatAmount.js', () => ({ formatAmount: (v) => String(v) }));
vi.mock('@/lib/resolveIdentifier.js', () => ({ resolveIdentifier: (data, f) => data?.[f] || data?._identifier }));
vi.mock('@/lib/documentTotals', () => ({ resolveTotalDiscountPct: () => 0 }));
vi.mock('@/lib/backendErrors.js', () => ({ translateBackendError: (m) => m }));
vi.mock('@/utils/recordActions.js', () => ({ isDeleteVisibleForRecord: () => true }));
vi.mock('@/lib/utils.js', () => ({ cn: (...args) => args.filter(Boolean).join(' ') }));

describe('DetailView helper functions', () => {
  describe('getCustomLinesTabClassName', () => {
    it('returns pt-3 when not embedded', () => {
      expect(getCustomLinesTabClassName(false)).toBe('pt-3');
    });

    it('adds pointer-events-none when embedded', () => {
      expect(getCustomLinesTabClassName(true)).toContain('pointer-events-none');
    });
  });

  describe('getWindowTitle', () => {
    it('uses last breadcrumb segment when breadcrumb exists', () => {
      const tMenu = (k) => `t:${k}`;
      expect(getWindowTitle('Sales / Orders', tMenu, 'sales-order')).toBe('t:Orders');
    });

    it('falls back to windowName when no breadcrumb', () => {
      const tMenu = (k) => k;
      expect(getWindowTitle(null, tMenu, 'sales-order')).toBe('sales-order');
    });
  });

  describe('getRecordTitle', () => {
    it('returns newRecord for new records', () => {
      const ui = (k) => k;
      expect(getRecordTitle(true, ui, {}, 'name')).toBe('newRecord');
    });

    it('resolves identifier for existing records', () => {
      const ui = (k) => k;
      expect(getRecordTitle(false, ui, { name: 'Order #1' }, 'name')).toBe('Order #1');
    });

    it('falls back to _identifier then id', () => {
      const ui = (k) => k;
      expect(getRecordTitle(false, ui, { _identifier: 'ID-001' }, null)).toBe('ID-001');
    });
  });

  describe('getFullBreadcrumb', () => {
    it('builds from breadcrumb segments + title', () => {
      const tMenu = (k) => `t:${k}`;
      expect(getFullBreadcrumb('A / B', tMenu, 'Title', 'WinTitle')).toBe('t:A / t:B / Title');
    });

    it('falls back to windowTitle when no breadcrumb', () => {
      const tMenu = (k) => k;
      expect(getFullBreadcrumb(null, tMenu, 'X', 'WinTitle')).toBe('WinTitle');
    });
  });

  describe('getOnAddToFavorites', () => {
    it('returns function when favKey is truthy', () => {
      const toggle = vi.fn();
      const fn = getOnAddToFavorites('key1', toggle, 'Label', null, 'win');
      expect(typeof fn).toBe('function');
      fn();
      expect(toggle).toHaveBeenCalledWith('key1', 'Label');
    });

    it('returns undefined when favKey is falsy', () => {
      expect(getOnAddToFavorites(null, vi.fn(), 'L', null, 'w')).toBeUndefined();
    });
  });

  describe('getLinesContainerClassName', () => {
    it('includes pt-3 for non-inline layout', () => {
      expect(getLinesContainerClassName('classic', false)).toContain('pt-3');
    });

    it('omits pt-3 for inlineEditable', () => {
      expect(getLinesContainerClassName('inlineEditable', false)).not.toContain('pt-3');
    });

    it('includes pointer-events-none when embedded', () => {
      expect(getLinesContainerClassName('classic', true)).toContain('pointer-events-none');
    });
  });

  describe('getDeleteChildButtonLabel', () => {
    it('returns loading when deleting', () => {
      const ui = (k) => k;
      expect(getDeleteChildButtonLabel(true, ui)).toBe('loading');
    });

    it('returns delete when not deleting', () => {
      const ui = (k) => k;
      expect(getDeleteChildButtonLabel(false, ui)).toBe('delete');
    });
  });

  describe('runAddLineAction', () => {
    it('calls handleCustomModalAddClick for customAddModal tabs', async () => {
      const handleCustomModalAddClick = vi.fn(() => Promise.resolve());
      const handleSecondaryAddLineToggle = vi.fn(() => Promise.resolve());
      await runAddLineAction({ key: 'loc', customAddModal: true }, { handleCustomModalAddClick, handleSecondaryAddLineToggle });
      expect(handleCustomModalAddClick).toHaveBeenCalledWith('loc');
    });

    it('calls handleSecondaryAddLineToggle for regular tabs', async () => {
      const handleCustomModalAddClick = vi.fn(() => Promise.resolve());
      const handleSecondaryAddLineToggle = vi.fn(() => Promise.resolve());
      await runAddLineAction({ key: 'lines' }, { handleCustomModalAddClick, handleSecondaryAddLineToggle });
      expect(handleSecondaryAddLineToggle).toHaveBeenCalledWith('lines');
    });

    it('does not throw on rejection', async () => {
      const fail = vi.fn(() => Promise.reject(new Error('boom')));
      await expect(runAddLineAction({ key: 'x' }, {
        handleCustomModalAddClick: fail,
        handleSecondaryAddLineToggle: fail,
      })).resolves.not.toThrow();
    });
  });

  describe('insertLinesTab', () => {
    it('inserts at specified index', () => {
      const tabs = [{ key: 'a' }, { key: 'b' }];
      insertLinesTab('Lines', 'lines', { children: [1, 2, 3] }, 1, tabs);
      expect(tabs[1].key).toBe('lines');
      expect(tabs[1].count).toBe(3);
    });

    it('unshifts when no index specified', () => {
      const tabs = [{ key: 'a' }];
      insertLinesTab('Lines', 'lines', { children: [] }, undefined, tabs);
      expect(tabs[0].key).toBe('lines');
    });
  });
});
