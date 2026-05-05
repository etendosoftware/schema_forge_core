import { useEffect, useState } from 'react';

/**
 * Minimal NEO lookup — fetches up to `pageSize` records matching `criteria`.
 * Shape matches the NEO `response.data` array. Search is server-side so it is
 * not capped by the first page of unfiltered records.
 */
export function buildLookupQuery({ criteria = [], pageSize = 50, query = '', searchFields = [] }) {
  const params = new URLSearchParams({ _pageSize: String(pageSize) });
  const term = query.trim();
  const allCriteria = [...criteria];

  if (term && searchFields.length) {
    allCriteria.push({
      _constructor: 'AdvancedCriteria',
      operator: 'or',
      criteria: searchFields.map(fieldName => ({ fieldName, operator: 'iContains', value: term })),
    });
  }

  if (allCriteria.length === 1) {
    params.set('criteria', JSON.stringify(allCriteria[0]));
  } else if (allCriteria.length > 1) {
    params.set('criteria', JSON.stringify({
      _constructor: 'AdvancedCriteria',
      operator: 'and',
      criteria: allCriteria,
    }));
  }

  return params.toString();
}

export function useLookup(shell, {
  path,
  criteria = [],
  pageSize = 50,
  enabled = true,
  query = '',
  searchFields = [],
}) {
  const [state, setState] = useState({ loading: enabled, items: [], error: null });

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setState({ loading: true, items: [], error: null });
    const queryString = buildLookupQuery({ criteria, pageSize, query, searchFields });
    shell.fetch(`${path}?${queryString}`)
      .then((body) => {
        if (cancelled) return;
        setState({ loading: false, items: body?.response?.data || [], error: null });
      })
      .catch((err) => {
        if (cancelled) return;
        setState({ loading: false, items: [], error: err.message });
      });
    return () => { cancelled = true; };
  }, [path, JSON.stringify(criteria), pageSize, enabled, query, JSON.stringify(searchFields)]);

  return state;
}
