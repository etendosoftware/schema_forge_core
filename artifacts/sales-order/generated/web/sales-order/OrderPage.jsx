import React from 'react';
import { Button } from '@/components/ui/button';
import { useEntity } from '@/hooks/useEntity';
import { StatusBadge } from '@/components/ui/status-badge';
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

      {/* Right panel: Toolbar + Summary + Form + Detail */}
      {order.editing && (
        <div className="flex-1 flex flex-col overflow-hidden bg-white">
          {/* Toolbar: title, status, process actions, save/delete */}
          <div className="flex items-center gap-2 px-5 py-2.5 border-b border-slate-200 bg-white shadow-sm">
            <h2 className="text-base font-semibold text-foreground truncate">{detailTitle}</h2>
            <StatusBadge status={order.editing?.docStatus} />
            <div className="flex-1" />
            <div className="flex items-center gap-2">
            <div className="h-5 w-px bg-border" />
            <Button variant="outline" size="sm" className="border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100" onClick={() => order.handleProcess?.('completeOrder')}>Complete Order</Button>
            <Button variant="outline" size="sm" className="border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100" onClick={() => order.handleProcess?.('voidOrder')}>Void Order</Button>
              <Button size="sm" onClick={() => order.handleSave(order.editing)}>Save</Button>
              {order.selected && (
                <Button variant="destructive" size="sm" onClick={order.handleDelete}>Delete</Button>
              )}
              <button
                onClick={() => order.handleSelect(null)}
                className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                aria-label="Close detail"
              >
                &times;
              </button>
            </div>
          </div>

          {/* Summary strip: read-only reference fields */}
          <div className="flex items-center gap-5 px-5 py-2.5 border-b border-slate-200 bg-slate-50 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500">Document No:</span>
              <span className="font-semibold text-foreground ">{order.editing?.documentNo ?? '—'}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500">Currency:</span>
              <span className="font-semibold text-foreground ">{order.editing?.currency ?? '—'}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500">Total Lines:</span>
              <span className="font-semibold text-foreground tabular-nums">{order.editing?.totalLines?.toLocaleString() ?? '—'}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500">Grand Total:</span>
              <span className="font-semibold text-foreground tabular-nums">{order.editing?.grandTotal?.toLocaleString() ?? '—'}</span>
            </div>
          </div>

          {/* Form zone: editable fields only */}
          <div className="px-5 pt-4 pb-3 border-b">
            <OrderForm
              data={order.editing}
              onChange={order.handleChange}
            />
          </div>

          {/* Detail zone: fills remaining height */}
          <div className="flex-1 flex flex-col overflow-hidden px-5 py-3">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Order Lines</h3>
            <div className="flex-1 overflow-auto">
              <OrderLineTable data={order.children} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
