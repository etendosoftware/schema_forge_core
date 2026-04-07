import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { useWarehouseStock } from './useWarehouseStock';

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function buildChartData(transactions) {
  const year = new Date().getFullYear();
  const monthly = Array(12).fill(0);

  for (const tx of transactions) {
    const d = new Date(tx.movementDate);
    if (d.getFullYear() !== year) continue;
    monthly[d.getMonth()] += Number(tx.movementQuantity) || 0;
  }

  let running = 0;
  return monthly.map((net, i) => {
    running += net;
    return { month: MONTH_LABELS[i], stock: Math.max(0, running) };
  });
}

export default function WarehouseSummary({ data, token, apiBaseUrl }) {
  const { loading, error, products, transactions } = useWarehouseStock(data?.id, token, apiBaseUrl);

  const totalProducts = products.length;
  const totalUnits = products.reduce((sum, p) => sum + p.qty, 0);
  const chartData = buildChartData(transactions);

  if (loading) return <div className="text-sm text-muted-foreground">Loading stock data…</div>;
  if (error) return <div className="text-sm text-destructive">Could not load stock data.</div>;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-muted-foreground mb-1">Total products</p>
          <p className="text-3xl font-light tabular-nums">{totalProducts.toFixed(2)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1">Total units</p>
          <p className="text-3xl font-light tabular-nums">{totalUnits.toFixed(2)}</p>
        </div>
      </div>

      <div>
        <p className="text-sm font-medium mb-3">Stock</p>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="stockGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#93c5fd" stopOpacity={0.7} />
                <stop offset="95%" stopColor="#93c5fd" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border, #e5e7eb)" />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} width={36} />
            <Tooltip formatter={(v) => [v.toFixed(2), 'Stock']} />
            <Area type="monotone" dataKey="stock" stroke="#3b82f6" fill="url(#stockGrad)" strokeWidth={2} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
