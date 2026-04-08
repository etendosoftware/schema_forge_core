import { useState, useEffect } from 'react';

async function fetchJson(url, token) {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  const json = await res.json();
  return json?.response?.data ?? json?.data ?? [];
}

/** Fetch translated UoM names from C_UOM_TRL via the binContents selector. */
async function fetchUomNames(apiBaseUrl, token) {
  try {
    const data = await fetchJson(
      `${apiBaseUrl}/binContents/selectors/uOM?_startRow=0&_endRow=500`,
      token,
    );
    const map = {};
    for (const item of data) {
      if (item.id) map[item.id] = item.identifier ?? item.name ?? item.id;
    }
    return map;
  } catch {
    return {};
  }
}

/** Deduplicate M_Storage_Detail rows by product, summing qtyOnHand. */
export function aggregateProducts(rows, uomMap = {}) {
  const map = new Map();
  for (const row of rows) {
    const id = row.product ?? 'unknown';
    const label = row['product$_identifier'] ?? id;
    const uomId = row.uOM ?? '';
    const uom = uomMap[uomId] ?? row['uOM$_identifier'] ?? uomId;
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
 * across all bins in parallel. Also resolves UoM names from C_UOM_TRL via the selector.
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
        const [bins, uomMap] = await Promise.all([
          fetchJson(
            `${apiBaseUrl}/storageBin?parentId=${warehouseId}&_startRow=0&_endRow=100`,
            token,
          ),
          fetchUomNames(apiBaseUrl, token),
        ]);

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
          products: aggregateProducts(allContents, uomMap),
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
