import { useState, useMemo } from 'react';

export function useCreateContactModal({ apiBaseUrl, token }) {
  const [createContactState, setCreateContactState] = useState(null);

  const headers = useMemo(() => ({
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  }), [token]);

  const bpApiBaseUrl = useMemo(
    () => (apiBaseUrl ? apiBaseUrl.replace(/\/[^/]+$/, '/contacts') : null),
    [apiBaseUrl],
  );

  const createContactCtxValue = useMemo(() => ({
    fieldKey: 'businessPartner',
    onOpen: (query, onSelect) => setCreateContactState({ query, onSelect }),
  }), []);

  return { bpApiBaseUrl, headers, createContactState, setCreateContactState, createContactCtxValue };
}
