import React, { useState, useEffect } from 'react';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import OrderTable from './OrderTable';
import OrderForm from './OrderForm';
import OrderLineTable from './OrderLineTable';

const EMPTY_ORDER = {
  documentNo: '', businessPartner: '', orderDate: '', warehouse: '',
  currency: '', paymentTerms: '', description: '', totalLines: '',
  grandTotal: '', docStatus: 'DR', deliveryLocation: '', invoiceAddress: '',
};

export default function OrderPage({ token, apiBaseUrl }) {
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(null);
  const [editing, setEditing] = useState(null);
  const [details, setDetails] = useState([]);
  const [loading, setLoading] = useState(false);

  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  const fetchItems = () => {
    setLoading(true);
    fetch(`${apiBaseUrl}/order`, { headers })
      .then(res => res.json())
      .then(data => { setItems(data); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { fetchItems(); }, [apiBaseUrl, token]);

  useEffect(() => {
    if (!selected?.id) { setDetails([]); return; }
    fetch(`${apiBaseUrl}/order/${selected.id}/orderLine`, { headers })
      .then(res => res.json())
      .then(setDetails)
      .catch(() => setDetails([]));
  }, [selected]);

  const handleSelect = (row) => {
    setSelected(row);
    setEditing({ ...row });
  };

  const handleNew = () => {
    setSelected(null);
    setEditing({ ...EMPTY_ORDER });
  };

  const handleChange = (field, value) => {
    setEditing(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async (data) => {
    const isNew = !data.id;
    const url = isNew ? `${apiBaseUrl}/order` : `${apiBaseUrl}/order/${data.id}`;
    const method = isNew ? 'POST' : 'PUT';
    try {
      const res = await fetch(url, { method, headers, body: JSON.stringify(data) });
      if (res.ok) {
        const saved = await res.json();
        setSelected(saved);
        setEditing({ ...saved });
        fetchItems();
      }
    } catch { /* handled by UI */ }
  };

  const handleProcess = async (processName) => {
    if (!selected?.id) return;
    await fetch(`${apiBaseUrl}/process/${processName}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ id: selected.id }),
    });
    fetchItems();
  };

  return (
    <div className="space-y-6 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Order</h2>
        <Button onClick={handleNew}>New</Button>
      </div>
      <OrderTable data={items} onRowSelect={handleSelect} />
      {editing && (
        <>
          <Separator />
          <OrderForm data={editing} onChange={handleChange} onSave={handleSave} onProcess={handleProcess} />
          <Separator />
          <h3 className="text-lg font-medium">Order Line</h3>
          <OrderLineTable data={details} />
        </>
      )}
    </div>
  );
}
