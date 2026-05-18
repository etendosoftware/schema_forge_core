import React from 'react';
import { render } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import { LocaleProvider } from '../LocaleProvider.jsx';
import { useUI } from '../useUI.js';
import { useMenuLabel } from '../useMenuLabel.js';
import { useLabel } from '../useLabel.js';

/**
 * Regression tests for ETP-4000 — i18n hook stability.
 *
 * Bug: `useUI`, `useMenuLabel` and `useLabel` returned a NEW function reference
 * on every render. In `SalesQuotationWindow`:
 *
 *   const ui = useUI();
 *   const quotationColumns = useMemo(() => buildQuotationColumns(ui), [ui]);
 *
 * Because `ui` changed identity every render, the `useMemo` invalidated each
 * render → `quotationColumns` was a fresh array each render → passed to
 * `<DataTable>` whose `useEffect(() => onColumnsReady(columns), [columns, ...])`
 * called `setTableColumns` on the parent `ListView` → infinite update loop →
 * React threw "Maximum update depth exceeded" → URL transitions stopped
 * propagating.
 *
 * The fix wraps the returned function in `useCallback(..., [dictionary])`
 * (or `[dictionary, langOverrides]` for `useLabel`). These tests guarantee
 * the returned function reference is stable across renders when the locale
 * does not change, and changes when the locale (or overrides) do change.
 */

function makeWrapper(locale) {
  return function Wrapper({ children }) {
    return <LocaleProvider locale={locale}>{children}</LocaleProvider>;
  };
}

/**
 * Mounts a probe component under a LocaleProvider and captures the hook value
 * on every render. Returns { captured, rerender } where rerender accepts a new
 * `locale` (and optional `overrides`) to drive re-renders.
 */
function mountProbe(useHook, initialLocale, initialOverrides = undefined) {
  const captured = [];
  function Probe({ overrides }) {
    const value = useHook(overrides);
    captured.push(value);
    return null;
  }
  function Harness({ locale, overrides }) {
    return (
      <LocaleProvider locale={locale}>
        <Probe overrides={overrides} />
      </LocaleProvider>
    );
  }
  const { rerender } = render(<Harness locale={initialLocale} overrides={initialOverrides} />);
  return {
    captured,
    rerender: (locale, overrides) => rerender(<Harness locale={locale} overrides={overrides} />),
  };
}

describe('i18n hook stability — function identity across renders', () => {
  describe('useUI', () => {
    it('returns the SAME function reference across re-renders when locale does not change', () => {
      const { result, rerender } = renderHook(() => useUI(), {
        wrapper: makeWrapper('en_US'),
      });

      const first = result.current;
      rerender();
      const second = result.current;
      rerender();
      const third = result.current;

      expect(typeof first).toBe('function');
      expect(second).toBe(first);
      expect(third).toBe(first);
    });

    it('returns a NEW function reference when the locale changes', () => {
      const { captured, rerender } = mountProbe(() => useUI(), 'en_US');

      rerender('en_US');             // same locale → reference must stay stable
      rerender('es_ES');             // locale change → new reference expected
      rerender('es_ES');             // back to stable

      // captured: [enRender1, enRender2, esRender1, esRender2]
      expect(captured.length).toBe(4);
      expect(captured[1]).toBe(captured[0]);     // same locale, same reference
      expect(captured[2]).not.toBe(captured[1]); // locale change → new reference
      expect(captured[3]).toBe(captured[2]);     // stable after switch
    });
  });

  describe('useMenuLabel', () => {
    it('returns the SAME function reference across re-renders when locale does not change', () => {
      const { result, rerender } = renderHook(() => useMenuLabel(), {
        wrapper: makeWrapper('en_US'),
      });

      const first = result.current;
      rerender();
      const second = result.current;
      rerender();
      const third = result.current;

      expect(typeof first).toBe('function');
      expect(second).toBe(first);
      expect(third).toBe(first);
    });

    it('returns a NEW function reference when the locale changes', () => {
      const { captured, rerender } = mountProbe(() => useMenuLabel(), 'en_US');

      rerender('en_US');
      rerender('es_ES');
      rerender('es_ES');

      expect(captured.length).toBe(4);
      expect(captured[1]).toBe(captured[0]);
      expect(captured[2]).not.toBe(captured[1]);
      expect(captured[3]).toBe(captured[2]);
    });
  });

  describe('useLabel (no overrides)', () => {
    it('returns the SAME function reference across re-renders when locale does not change', () => {
      const { result, rerender } = renderHook(() => useLabel(), {
        wrapper: makeWrapper('en_US'),
      });

      const first = result.current;
      rerender();
      const second = result.current;
      rerender();
      const third = result.current;

      expect(typeof first).toBe('function');
      expect(second).toBe(first);
      expect(third).toBe(first);
    });

    it('returns a NEW function reference when the locale changes', () => {
      const { captured, rerender } = mountProbe(() => useLabel(), 'en_US');

      rerender('en_US');
      rerender('es_ES');
      rerender('es_ES');

      expect(captured.length).toBe(4);
      expect(captured[1]).toBe(captured[0]);
      expect(captured[2]).not.toBe(captured[1]);
      expect(captured[3]).toBe(captured[2]);
    });
  });

  describe('useLabel (with overrides)', () => {
    it('returns the SAME function reference when the same overrides object is passed across renders', () => {
      const overrides = {
        es_ES: { C_BPartner_ID: 'Contacto' },
        en_US: { C_BPartner_ID: 'Contact' },
      };
      const { result, rerender } = renderHook(() => useLabel(overrides), {
        wrapper: makeWrapper('en_US'),
      });

      const first = result.current;
      rerender();
      const second = result.current;
      rerender();
      const third = result.current;

      expect(typeof first).toBe('function');
      expect(second).toBe(first);
      expect(third).toBe(first);
    });

    it('returns a NEW function reference when the overrides[locale] slice identity changes', () => {
      // useLabel depends on dictionary + langOverrides (the locale-specific slice).
      // Changing the slice's identity (even with equivalent content) must invalidate
      // the memo — this is the contract guaranteed by `[dictionary, langOverrides]`.
      const initialOverrides = { en_US: { C_BPartner_ID: 'Contact' } };
      const changedSlice    = { en_US: { C_BPartner_ID: 'Customer' } };

      const { captured, rerender } = mountProbe(
        (overrides) => useLabel(overrides),
        'en_US',
        initialOverrides,
      );

      rerender('en_US', initialOverrides);   // same overrides object → stable
      rerender('en_US', changedSlice);       // new slice identity → new reference

      expect(captured.length).toBe(3);
      expect(captured[1]).toBe(captured[0]);     // same overrides ref → stable
      expect(captured[2]).not.toBe(captured[1]); // overrides ref changed → new fn
    });
  });
});
