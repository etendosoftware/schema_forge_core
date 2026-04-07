import { useState, useEffect } from 'react';

async function fetchJson(url, token) {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  const json = await res.json();
  return json?.response?.data ?? json?.data ?? [];
}

/** Deduplicate M_Storage_Detail rows by product, summing qtyOnHand. */
export function aggregateProducts(rows) {
  const map = new Map();
  for (const row of rows) {
    const id = row.product?.id ?? row.product ?? 'unknown';
    const label = row.product?.$_identifier ?? row.product ?? id;
    const uom = row.uOM?.$_identifier ?? row.uOM ?? '';
    const qty = Number(row.quantityOnHand) || 0;
    if (map.has(id)) {
      map.get(id).qty += qty;
    } else {
      map.set(id, { id, label, uom, qty });
    }
  }
  return Array.from(map.values()).filter(p => p.qty > 0);
}

/**
 * Fetch all storageBins for a warehouse, then aggregate binContents + productTransactions
 * across all bins in parallel.
 * Returns { loading, error, products, transactions }.
 */
export function useWarehouseStock(warehouseId, token, apiBaseUrl) {
  const [state, setState] = useState({ loading: true, error: null, products: [], transactions: [] });

  useEffect(() => {
    if (!warehouseId) return;
    let cancelled = false;
    setState({ loading: true, error: null, products: [], transactions: [] });

    (async () => {
      try {
        const bins = await fetchJson(
          `${apiBaseUrl}/storageBin?parentId=${warehouseId}&_startRow=0&_endRow=100`,
          token,
        );
        if (bins.length === 0) {
          if (!cancelled) setState({ loading: false, error: null, products: [], transactions: [] });
          return;
        }

        const [allContents, allTxs] = await Promise.all([
          Promise.all(bins.map(b =>
            fetchJson(`${apiBaseUrl}/binContents?parentId=${b.id}&_startRow=0&_endRow=1000`, token)
          )).then(results => results.flat()),
          Promise.all(bins.map(b =>
            fetchJson(`${apiBaseUrl}/productTransactions?parentId=${b.id}&_startRow=0&_endRow=2000`, token)
          )).then(results => results.flat()),
        ]);

        if (!cancelled) setState({
          loading: false,
          error: null,
          products: aggregateProducts(allContents),
          transactions: allTxs,
        });
      } catch (e) {
        if (!cancelled) setState({ loading: false, error: e.message, products: [], transactions: [] });
      }
    })();

    return () => { cancelled = true; };
  }, [warehouseId, token, apiBaseUrl]);

  return state;
}
