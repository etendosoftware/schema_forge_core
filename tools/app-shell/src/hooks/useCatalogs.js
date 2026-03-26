import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Hook that fetches selector/catalog data from NEO Headless API.
 *
 * Uses the `api.selectors` array from the generated contract to know
 * which selectors to fetch and at which URLs.
 *
 * Returns a catalogs object keyed by reference name (e.g., { Warehouse: [...], PaymentTerm: [...] }).
 * Each entry is an array of { id, name } objects (normalized from NEO's { id, label } format).
 *
 * Falls back to the static `fallback` catalogs (mock data) for selectors that fail or aren't available.
 */
export function useCatalogs(api, token, apiBaseUrl, fallback = {}) {
  const [catalogs, setCatalogs] = useState(fallback);
  const [loaded, setLoaded] = useState(false);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (!api?.selectors?.length || !token || !apiBaseUrl) return;
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };

    // Deduplicate selectors by reference (same reference may appear for multiple entities).
    // Skip "search" inputMode fields — those use server-side ?q= fetching in SearchInput
    // and don't benefit from pre-loading 20 results.
    const seen = new Set();
    const unique = api.selectors.filter(sel => {
      if (sel.inputMode === 'search') return false;
      if (seen.has(sel.reference)) return false;
      seen.add(sel.reference);
      return true;
    });

    // Fetch all selectors in parallel
    const fetches = unique.map(async (sel) => {
      // NEO expects column name in the URL: /{entity}/selectors/{columnName}
      const url = `${apiBaseUrl}/${sel.entity}/selectors/${sel.column}`;
      try {
        const res = await fetch(url, { headers });
        if (!res.ok) return null;
        const data = await res.json();
        const items = (data.items || []).map(item => ({
          id: item.id,
          name: item.label || item.name || item.id,
          // Preserve extra properties for dependent selectors (e.g., C_BPartner_ID on locations)
          ...item,
        }));
        return { reference: sel.reference, items };
      } catch {
        return null;
      }
    });

    Promise.all(fetches).then(resolved => {
      const results = {};
      for (const result of resolved) {
        if (result) {
          // API responded — use its data (even if empty). Never fall back to mocks.
          results[result.reference] = result.items;
        }
      }
      setCatalogs(results);
      setLoaded(true);
    });
  }, [api, token, apiBaseUrl]);

  return { catalogs, catalogsLoaded: loaded };
}
