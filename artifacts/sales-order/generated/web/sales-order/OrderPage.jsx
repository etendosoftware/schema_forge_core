import React, { useState, useEffect } from 'react';
import { Separator } from '@/components/ui/separator';
import OrderTable from './OrderTable';
import OrderForm from './OrderForm';
import OrderLineTable from './OrderLineTable';

export default function OrderPage({ token, apiBaseUrl }) {
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(null);
  const [details, setDetails] = useState([]);
  const [loading, setLoading] = useState(false);

  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  useEffect(() => {
    setLoading(true);
    fetch(`${apiBaseUrl}/order`, { headers })
      .then(res => res.json())
      .then(data => { setItems(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [apiBaseUrl, token]);

  useEffect(() => {
    if (!selected?.id) { setDetails([]); return; }
    fetch(`${apiBaseUrl}/order/${selected.id}/orderLine`, { headers })
      .then(res => res.json())
      .then(setDetails)
      .catch(() => setDetails([]));
  }, [selected]);

  const handleProcess = async (processName) => {
    if (!selected?.id) return;
    await fetch(`${apiBaseUrl}/process/${processName}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ id: selected.id }),
    });
  };

  return (
    <div className="space-y-6 p-4">
      <h2 className="text-xl font-semibold">Order</h2>
      <OrderTable data={items} onRowSelect={setSelected} />
      {selected && (
        <>
          <Separator />
          <OrderForm data={selected} onProcess={handleProcess} />
          <Separator />
          <h3 className="text-lg font-medium">Order Line</h3>
          <OrderLineTable data={details} />
        </>
      )}
    </div>
  );
}
