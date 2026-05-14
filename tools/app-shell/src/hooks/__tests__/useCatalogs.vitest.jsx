import { renderHook } from '@testing-library/react';
import { useCatalogs } from '../useCatalogs';

describe('useCatalogs', () => {
  it('returns catalogs from fallback and catalogsLoaded true', () => {
    const fallback = { status: [{ id: '1', name: 'Draft' }] };
    const { result } = renderHook(() =>
      useCatalogs('/api', 'token', 'http://localhost', fallback)
    );

    expect(result.current.catalogs).toBe(fallback);
    expect(result.current.catalogsLoaded).toBe(true);
  });

  it('defaults to empty object when no fallback provided', () => {
    const { result } = renderHook(() =>
      useCatalogs('/api', 'token', 'http://localhost')
    );

    expect(result.current.catalogs).toEqual({});
    expect(result.current.catalogsLoaded).toBe(true);
  });

  it('uses the provided fallback object reference', () => {
    const fallback = { partners: ['A', 'B'] };
    const { result } = renderHook(() =>
      useCatalogs('/api', 'token', 'http://localhost', fallback)
    );

    // Should be the exact same reference, not a copy
    expect(result.current.catalogs).toBe(fallback);
  });

  it('always returns catalogsLoaded as true regardless of params', () => {
    const { result } = renderHook(() =>
      useCatalogs(null, null, null)
    );

    expect(result.current.catalogsLoaded).toBe(true);
  });
});