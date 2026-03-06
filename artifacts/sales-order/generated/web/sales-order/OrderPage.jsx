import React from 'react';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { SlidePanel } from '@/components/ui/slide-panel';
import { useEntity } from '@/hooks/useEntity';
import OrderTable from './OrderTable';
import OrderForm from './OrderForm';
import OrderLineTable from './OrderLineTable';

export default function OrderPage({ token, apiBaseUrl }) {
  const order = useEntity('order', 'orderLine', { token, apiBaseUrl });

  const panelTitle = order.editing?.id
    ? `Order ${order.editing.documentNo || order.editing.id}`
    : 'New Order';

  const handleClose = () => {
    order.handleSelect(null);
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Orders</h2>
        <Button onClick={order.handleNew}>New</Button>
      </div>
      <OrderTable data={order.items} onRowSelect={order.handleSelect} />
      <SlidePanel
        open={!!order.editing}
        onClose={handleClose}
        title={panelTitle}
      >
        <OrderForm
          data={order.editing}
          onChange={order.handleChange}
          onSave={order.handleSave}
          onDelete={order.selected ? order.handleDelete : undefined}
          onProcess={order.handleProcess}
        />
        <Separator className="my-6" />
        <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3">Order Lines</h3>
        <OrderLineTable data={order.children} />
      </SlidePanel>
    </div>
  );
}
