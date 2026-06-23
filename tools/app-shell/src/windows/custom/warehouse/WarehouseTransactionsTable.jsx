import { useMemo, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { useUI } from '@/i18n';
import { useWarehouseStock } from './useWarehouseStock';

const TYPE_KEY_MAP = {
  'V+': 'movTypeVendorReceipt',
  'I+': 'movTypeInventoryIn',
  'I-': 'movTypeInventoryOut',
  'M+': 'movTypeMovementTo',
  'M-': 'movTypeMovementFrom',
  'P+': 'movTypeProductionIn',
  'P-': 'movTypeProductionOut',
  'C-': 'movTypeCustomerShipment',
  'D-': 'movTypeInternalConsumption',
};

function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  const day   = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year  = d.getFullYear();
  return `${day}/${month}/${year}`;
}

function fmtQty(val) {
  const n = Number(val);
  return isNaN(n) ? '—' : n.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

export default function WarehouseTransactionsTable({ parentId, token, apiBaseUrl, onCount }) {
  const ui = useUI();
  const { loading, error, transactions } = useWarehouseStock(parentId, token, apiBaseUrl);

  useEffect(() => {
    if (!loading && !error && transactions) {
      onCount?.(transactions.length);
    }
  }, [loading, error, transactions?.length]);

  const resolveTypeLabel = (tx) =>
    tx['movementType$_identifier'] ?? (TYPE_KEY_MAP[tx.movementType] ? ui(TYPE_KEY_MAP[tx.movementType]) : tx.movementType) ?? '';

  const sorted = useMemo(() => {
    if (!transactions) return [];
    return [...transactions].sort((a, b) =>
      new Date(b.movementDate).getTime() - new Date(a.movementDate).getTime()
    );
  }, [transactions]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        {ui('warehouseLoadingTransactions')}
      </div>
    );
  }

  if (error) {
    return <p className="py-8 text-sm text-destructive">{ui('warehouseTransactionsError', { error })}</p>;
  }

  if (sorted.length === 0) {
    return <p className="py-8 text-sm text-muted-foreground text-center">{ui('warehouseNoTransactions')}</p>;
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-border/50">
          <th className="text-left py-2 pr-3 font-medium text-muted-foreground w-[180px]">{ui('warehouseDate')}</th>
          <th className="text-left py-2 pr-3 font-medium text-muted-foreground w-[200px]">{ui('warehouseType')}</th>
          <th className="text-left py-2 pr-3 font-medium text-muted-foreground">{ui('warehouseProduct')}</th>
          <th className="text-right py-2 font-medium text-muted-foreground">{ui('warehouseQty')}</th>
        </tr>
      </thead>
      <tbody>
        {sorted.map((tx, i) => {
          const qty = Number(tx.movementQuantity);
          const typeLabel = resolveTypeLabel(tx);
          const product = tx['product$_identifier'] ?? tx.product ?? '—';
          return (
            <tr key={tx.id ?? i} className="border-b border-border/30 hover:bg-muted/30 transition-colors h-10">
              <td className="py-2.5 pr-3 font-semibold text-[#121217] tabular-nums whitespace-nowrap">{fmtDate(tx.movementDate)}</td>
              <td className="py-2.5 pr-3 text-muted-foreground">{typeLabel}</td>
              <td className="py-2.5 pr-3 text-[#121217]">{product}</td>
              <td className={`py-2.5 text-right tabular-nums font-semibold ${qty < 0 ? 'text-destructive' : 'text-emerald-600'}`}>
                {qty >= 0 ? '+' : ''}{fmtQty(qty)}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
