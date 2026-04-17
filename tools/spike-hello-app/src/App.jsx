import React, { useEffect, useState } from 'react';
import { fetchEtendo, fetchMe } from './fetchEtendo.js';

export default function App() {
  const [state, setState] = useState({ loading: true });

  useEffect(() => {
    (async () => {
      try {
        const me = await fetchMe();
        const products = await fetchEtendo('/neo/product/product?_pageSize=1');
        setState({
          loading: false,
          user: me.userId,
          tenant: me.tenant,
          productCount: products?.response?.totalRows ?? products?.response?.data?.length ?? 0,
        });
      } catch (err) {
        setState({ loading: false, error: err.message });
      }
    })();
  }, []);

  if (state.loading) return <div className="p-8 text-gray-500">Loading…</div>;
  if (state.error) return (
    <div className="p-8 text-red-600">
      <h1 className="text-xl font-bold">Spike Hello App</h1>
      <p>Error: {state.error}</p>
    </div>
  );

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold">Spike Hello App</h1>
      <p className="mt-4">
        Hello <b>{state.user}</b> from tenant <b>{state.tenant}</b>,
        you have <b>{state.productCount}</b> products.
      </p>
    </div>
  );
}
