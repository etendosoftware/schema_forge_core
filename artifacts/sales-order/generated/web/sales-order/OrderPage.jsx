import React from 'react';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { useEntity } from '@/hooks/useEntity';
import OrderTable from './OrderTable';
import OrderForm from './OrderForm';
import OrderLineTable from './OrderLineTable';

export default function OrderPage({ token, apiBaseUrl }) {
  const order = useEntity('order', 'orderLine', { token, apiBaseUrl });

  return (
    <div className="space-y-6 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Order</h2>
        <div className="flex gap-2">
          <Button onClick={order.handleNew}>New</Button>
          {order.selected && (
            <Button variant="outline" onClick={order.handleDelete}>Delete</Button>
          )}
        </div>
      </div>
      <OrderTable data={order.items} onRowSelect={order.handleSelect} />
      {order.editing && (
        <>
          <Separator />
          <OrderForm
            data={order.editing}
            onChange={order.handleChange}
            onSave={order.handleSave}
            onProcess={order.handleProcess}
          />
          <Separator />
          <h3 className="text-lg font-medium">Order Line</h3>
          <OrderLineTable data={order.children} />
        </>
      )}
    </div>
  );
}
