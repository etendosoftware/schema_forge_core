import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';

const PageMetaContext = createContext(null);

export function PageMetaProvider({ children }) {
  const [meta, setMetaState] = useState({});
  const setMeta = useCallback((m) => setMetaState(m ?? {}), []);
  return (
    <PageMetaContext.Provider value={{ ...meta, setMeta }}>
      {children}
    </PageMetaContext.Provider>
  );
}

export function usePageMeta() {
  return useContext(PageMetaContext);
}

export function useSetPageMeta(meta) {
  const ctx = useContext(PageMetaContext);
  const metaRef = useRef(meta);
  metaRef.current = meta;

  useEffect(() => {
    ctx?.setMeta(metaRef.current);
    return () => ctx?.setMeta({});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta?.title, meta?.breadcrumb]);
}
