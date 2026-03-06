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
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Orders</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {order.loading ? 'Loading...' : `${order.items.length} records`}
          </p>
        </div>
        <Button onClick={order.handleNew} size="sm">+ New Order</Button>
      </div>
      {order.loading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <div className="animate-pulse space-y-3 w-full">
            <div className="h-10 bg-muted rounded" />
            <div className="h-8 bg-muted/60 rounded" />
            <div className="h-8 bg-muted/40 rounded" />
            <div className="h-8 bg-muted/60 rounded" />
            <div className="h-8 bg-muted/40 rounded" />
          </div>
        </div>
      ) : (
        <OrderTable
          data={order.items}
          onRowSelect={order.handleSelect}
          selectedId={order.selected?.id}
        />
      )}
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
        <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-3">Order Lines</h3>
        <OrderLineTable data={order.children} />
      </SlidePanel>
    </div>
  );
}
