import { useState, useEffect } from 'react';
import { Boxes, Lock, PackageCheck } from 'lucide-react';

function StatCard({ icon: Icon, label, value, subtitle, color = 'blue' }) {
  const colorMap = {
    blue:   { bg: 'bg-blue-50',   text: 'text-blue-700',   icon: 'text-blue-400'   },
    amber:  { bg: 'bg-amber-50',  text: 'text-amber-700',  icon: 'text-amber-400'  },
    green:  { bg: 'bg-green-50',  text: 'text-green-700',  icon: 'text-green-400'  },
    red:    { bg: 'bg-red-50',    text: 'text-red-600',    icon: 'text-red-400'    },
  };
  const c = colorMap[color] ?? colorMap.blue;
  return (
    <div className={`flex items-center gap-3 ${c.bg} rounded-lg px-5 py-3 flex-1 min-w-0`}>
      <Icon size={20} className={`${c.icon} flex-shrink-0`} />
      <div className="min-w-0">
        <div className={`text-xl font-semibold leading-tight ${c.text}`}>
          {value === null ? <span className="text-gray-300">—</span> : value}
        </div>
        <div className="text-xs text-gray-500">{label}</div>
        {subtitle && <div className="text-xs text-gray-400 mt-0.5">{subtitle}</div>}
      </div>
    </div>
  );
}

const DOT_COLORS = ['#3b82f6','#f97316','#10b981','#8b5cf6','#ec4899','#14b8a6','#f59e0b','#6366f1'];

function StockByLocation({ stockRows }) {
  const rows = stockRows
    .filter(r => Number(r.quantityOnHand) > 0)
    .sort((a, b) => Number(b.quantityOnHand) - Number(a.quantityOnHand));

  if (rows.length === 0) return null;

  return (
    <div className="border rounded-lg p-3 flex flex-col gap-1.5 flex-1 min-w-0">
      <div className="text-xs text-gray-400 font-medium mb-0.5">By location</div>
      {rows.map((r, i) => {
        const name = r['storageBin$_identifier'] ?? r.storageBin ?? `Bin ${i + 1}`;
        const qty  = Number(r.quantityOnHand).toLocaleString();
        return (
          <div key={r.id ?? i} className="flex items-center justify-between gap-2 text-sm">
            <div className="flex items-center gap-2 min-w-0">
              <span
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: DOT_COLORS[i % DOT_COLORS.length] }}
              />
              <span className="text-gray-600 truncate">{name}</span>
            </div>
            <span className="font-medium text-gray-800 flex-shrink-0">{qty}</span>
          </div>
        );
      })}
    </div>
  );
}

function StockChart({ transactions }) {
  const byMonth = transactions.reduce((acc, t) => {
    const d = new Date(t.movementDate);
    if (isNaN(d)) return acc;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    acc[key] = (acc[key] || 0) + Number(t.movementQuantity || 0);
    return acc;
  }, {});

  const allMonths = Object.keys(byMonth).sort();
  if (allMonths.length === 0) return null;

  const months = allMonths.slice(-24);

  let cum = 0;
  const values = months.map(m => { cum += byMonth[m] || 0; return cum; });
  if (values.every(v => v === 0)) return null;

  const maxVal = Math.max(...values, 1);
  const minVal = Math.min(...values, 0);
  const range  = maxVal - minVal || 1;

  const W = 420, H = 88, PAD_X = 36, PAD_Y = 8;
  const xStep = (W - PAD_X * 2) / Math.max(values.length - 1, 1);
  const toY   = v => PAD_Y + (H - PAD_Y * 2) * (1 - (v - minVal) / range);
  const toX   = i => PAD_X + i * xStep;

  const pts      = values.map((v, i) => `${toX(i)},${toY(v)}`).join(' ');
  const areaPts  = `${toX(0)},${H} ${pts} ${toX(values.length - 1)},${H}`;

  // Y-axis: max, mid, 0
  const yLabels = [
    { v: maxVal,                    label: maxVal >= 1000 ? `${(maxVal / 1000).toFixed(0)}k` : String(maxVal) },
    { v: (maxVal + minVal) / 2,     label: null },
    { v: minVal,                    label: minVal >= 1000 ? `${(minVal / 1000).toFixed(0)}k` : String(Math.round(minVal)) },
  ].filter((y, i) => i === 0 || i === 2 || Math.abs(y.v - minVal) > range * 0.1);

  // X labels every 3 months, prefer year transitions
  const labels = months.map((m, i) => {
    const [yr, mo] = m.split('-');
    const prev = i > 0 ? months[i - 1].split('-')[0] : null;
    if (prev !== yr) return { x: toX(i), text: `${mo}/${yr.slice(2)}` };
    if (i % 3 === 0) return { x: toX(i), text: mo };
    return { x: toX(i), text: null };
  });

  return (
    <div className="flex flex-col flex-[2] min-w-0">
      <div className="text-xs text-gray-400 font-medium mb-1">Stock movement</div>
      <svg viewBox={`0 0 ${W} ${H + 14}`} className="w-full" style={{ height: 102 }}>
        <defs>
          <linearGradient id="sgChartGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#3b82f6" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {/* Y-axis labels */}
        {yLabels.map((yl, i) => yl.label && (
          <text key={i} x={PAD_X - 4} y={toY(yl.v) + 3} textAnchor="end" fontSize="8" fill="#9ca3af">
            {yl.label}
          </text>
        ))}
        {/* Zero baseline */}
        {minVal < 0 && (
          <line x1={PAD_X} y1={toY(0)} x2={W - PAD_X} y2={toY(0)}
            stroke="#e5e7eb" strokeWidth="1" strokeDasharray="3,2" />
        )}
        {/* Top/bottom guide lines */}
        <line x1={PAD_X} y1={PAD_Y} x2={W - PAD_X} y2={PAD_Y}
          stroke="#f3f4f6" strokeWidth="1" />
        <line x1={PAD_X} y1={H - PAD_Y} x2={W - PAD_X} y2={H - PAD_Y}
          stroke="#f3f4f6" strokeWidth="1" />
        <polygon points={areaPts} fill="url(#sgChartGrad)" />
        <polyline points={pts} fill="none" stroke="#3b82f6" strokeWidth="1.8"
          strokeLinejoin="round" strokeLinecap="round" />
        {labels.map((l, i) => l.text && (
          <text key={i} x={l.x} y={H + 11} textAnchor="middle" fontSize="8" fill="#9ca3af">
            {l.text}
          </text>
        ))}
      </svg>
    </div>
  );
}

export default function ProductDetailHeader({ recordId, token, apiBaseUrl }) {
  const [stockRows,    setStockRows]    = useState(null);
  const [transactions, setTransactions] = useState(null);

  useEffect(() => {
    if (!recordId || !token) return;
    const headers = { Authorization: `Bearer ${token}` };

    fetch(`${apiBaseUrl}/stock?parentId=${recordId}&_startRow=0&_endRow=200`, { headers })
      .then(r => (r.ok ? r.json() : null))
      .then(data => setStockRows(data?.response?.data ?? []))
      .catch(() => setStockRows([]));

    fetch(`${apiBaseUrl}/transactions?parentId=${recordId}&_startRow=0&_endRow=500`, { headers })
      .then(r => (r.ok ? r.json() : null))
      .then(data => setTransactions(data?.response?.data ?? []))
      .catch(() => setTransactions([]));
  }, [recordId, token, apiBaseUrl]);

  const onHand   = stockRows?.reduce((s, r) => s + (Number(r.quantityOnHand) || 0), 0) ?? null;
  const reserved = stockRows?.reduce((s, r) => s + (Number(r.reservedQty)     || 0), 0) ?? null;
  const binCount = stockRows ? new Set(stockRows.map(r => r.storageBin ?? r.id)).size : 0;

  const available = (onHand !== null && reserved !== null) ? onHand - reserved : null;
  const fmt       = v => (v === null ? null : v.toLocaleString());

  const onHandColor    = onHand === 0 ? 'red' : 'blue';
  const availableColor = available === null ? 'blue'
    : available <= 0 ? 'red'
    : onHand > 0 && available <= onHand * 0.1 ? 'amber'
    : 'green';

  const onHandSubtitle   = binCount > 0 ? `${binCount} location${binCount !== 1 ? 's' : ''}` : null;
  const availablePct     = onHand > 0 && available !== null ? Math.round((available / onHand) * 100) : null;
  const availableSubtitle = availablePct !== null ? `${availablePct}% free` : null;

  const hasChart    = transactions !== null && transactions.length > 0;
  const hasLocation = stockRows !== null && stockRows.some(r => Number(r.quantityOnHand) > 0);
  const showBottom  = hasChart || hasLocation;

  return (
    <div className="pt-4 pb-4 mb-3 border-b border-gray-100">
      <div className="bg-gray-50/70 rounded-xl p-4 flex flex-col gap-3">
        <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Summary</div>

        {/* Stats row */}
        <div className="flex gap-3">
          <StatCard
            icon={Boxes}
            label="On Hand"
            value={fmt(onHand)}
            subtitle={onHandSubtitle}
            color={onHandColor}
          />
          <StatCard
            icon={PackageCheck}
            label="Available"
            value={fmt(available)}
            subtitle={availableSubtitle}
            color={availableColor}
          />
          <StatCard
            icon={Lock}
            label="Reserved"
            value={fmt(reserved)}
            subtitle={reserved !== null && reserved > 0 ? 'units held' : null}
            color="amber"
          />
        </div>

        {/* Chart + by-location row */}
        {showBottom && (
          <div className="flex gap-3 items-stretch">
            {hasChart && <StockChart transactions={transactions} />}
            {hasLocation && <StockByLocation stockRows={stockRows} />}
          </div>
        )}
      </div>
    </div>
  );
}
