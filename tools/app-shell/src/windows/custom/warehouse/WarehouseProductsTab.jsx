import { useWarehouseStock } from './useWarehouseStock';

export default function WarehouseProductsTab({ data, token, apiBaseUrl }) {
  const { loading, error, products } = useWarehouseStock(data?.id, token, apiBaseUrl);

  if (loading) return <div className="text-sm text-muted-foreground p-6">Loading products…</div>;
  if (error) return <div className="text-sm text-destructive p-6">Could not load products: {error}</div>;
  if (products.length === 0) return <div className="text-sm text-muted-foreground p-6">No stock found for this warehouse.</div>;

  return (
    <div className="overflow-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-muted-foreground">
            <th className="text-left py-2 px-4 font-medium">Product</th>
            <th className="text-left py-2 px-4 font-medium">UoM</th>
            <th className="text-right py-2 px-4 font-medium">Qty on Hand</th>
          </tr>
        </thead>
        <tbody>
          {products.map(p => (
            <tr key={p.id} className="border-b border-border/50 hover:bg-muted/30">
              <td className="py-2 px-4">{p.label}</td>
              <td className="py-2 px-4 text-muted-foreground">{p.uom}</td>
              <td className="py-2 px-4 text-right tabular-nums">{p.qty.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
