import React from 'react';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { useEntity } from '@/hooks/useEntity';
import OrderTable from './OrderTable';
import OrderForm from './OrderForm';
import OrderLineTable from './OrderLineTable';

export default function OrderPage({ token, apiBaseUrl }) {
  const order = useEntity('order', 'orderLine', { token, apiBaseUrl });

  const detailTitle = order.editing?.id
    ? `Order ${order.editing.documentNo || order.editing.id}`
    : 'New Order';

  return (
    <div className="flex h-[calc(100vh-4rem)] gap-0">
      {/* Left panel: Table */}
      <div className={`flex flex-col border-r transition-all duration-300 ${order.editing ? 'w-2/5' : 'w-full'}`}>
        <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/20">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Orders</h2>
            <p className="text-xs text-muted-foreground">
              {order.loading ? 'Loading...' : `${order.items.length} records`}
            </p>
          </div>
          <Button onClick={order.handleNew} size="sm">+ New</Button>
        </div>
        <div className="flex-1 overflow-auto p-3">
          {order.loading ? (
            <div className="animate-pulse space-y-3">
              <div className="h-10 bg-muted rounded" />
              <div className="h-8 bg-muted/60 rounded" />
              <div className="h-8 bg-muted/40 rounded" />
              <div className="h-8 bg-muted/60 rounded" />
              <div className="h-8 bg-muted/40 rounded" />
            </div>
          ) : (
            <OrderTable
              data={order.items}
              onRowSelect={order.handleSelect}
              selectedId={order.selected?.id}
              compact={!!order.editing}
            />
          )}
        </div>
      </div>

      {/* Right panel: Form + Detail */}
      {order.editing && (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b bg-muted/20">
            <h2 className="text-lg font-semibold text-foreground">{detailTitle}</h2>
            <button
              onClick={() => order.handleSelect(null)}
              className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              aria-label="Close detail"
            >
              &times;
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
            <OrderForm
              data={order.editing}
              onChange={order.handleChange}
              onSave={order.handleSave}
              onDelete={order.selected ? order.handleDelete : undefined}
              onProcess={order.handleProcess}
            />
            <Separator />
            <div>
              <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-3">Order Lines</h3>
              <OrderLineTable data={order.children} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
