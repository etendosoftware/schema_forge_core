import { useState } from 'react';
import { useUI } from '@/i18n';
import { useWarehouseStock } from './useWarehouseStock';
import MoveStockModal from './MoveStockModal';

export default function WarehouseProductsTab({ data, token, apiBaseUrl }) {
  const ui = useUI();
  const [refreshKey, setRefreshKey] = useState(0);
  const { loading, error, products } = useWarehouseStock(data?.id, token, apiBaseUrl, refreshKey);
  const [moveTarget, setMoveTarget] = useState(null);

  if (loading) return <div className="text-sm text-muted-foreground p-6">{ui('warehouseLoadingProducts')}</div>;
  if (error) return <div className="text-sm text-destructive p-6">{ui('warehouseProductsError', { error })}</div>;
  if (products.length === 0) return <div className="text-sm text-muted-foreground p-6">{ui('warehouseNoStock')}</div>;

  return (
    <>
      <div className="overflow-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th className="text-left py-2 px-4 font-medium">{ui('warehouseProduct')}</th>
              <th className="text-left py-2 px-4 font-medium">{ui('warehouseUom')}</th>
              <th className="text-right py-2 px-4 font-medium">{ui('warehouseQtyOnHand')}</th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {products.map(p => (
              <tr key={p.id} className="border-b border-border/50 hover:bg-muted/30">
                <td className="py-2 px-4">{p.label}</td>
                <td className="py-2 px-4 text-muted-foreground">{p.uom}</td>
                <td className="py-2 px-4 text-right tabular-nums">{p.qty.toFixed(2)}</td>
                <td className="py-1 px-2 text-right">
                  <button
                    type="button"
                    onClick={() => setMoveTarget(p)}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      padding: '3px 10px', borderRadius: 6, border: '0.5px solid #E5E7EB',
                      background: 'transparent', cursor: 'pointer', color: '#6B7280',
                      fontSize: 12, lineHeight: 1, whiteSpace: 'nowrap',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#F3F4F6'; e.currentTarget.style.color = '#111827'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#6B7280'; }}
                  >
                    <span style={{ fontSize: 13 }}>⇄</span>
                    {ui('warehouseMoveActionTooltip')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {moveTarget && (
        <MoveStockModal
          product={moveTarget}
          currentWarehouseId={data?.id}
          data={data}
          token={token}
          apiBaseUrl={apiBaseUrl}
          onSuccess={() => setRefreshKey(k => k + 1)}
          onClose={() => setMoveTarget(null)}
        />
      )}
    </>
  );
}
