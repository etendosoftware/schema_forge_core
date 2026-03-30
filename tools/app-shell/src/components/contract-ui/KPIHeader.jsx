import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown } from 'lucide-react';

/**
 * Format a KPI value according to the specified format type.
 *
 * Supported formats:
 * - 'currency': locale-formatted with $ symbol (e.g. $1,234.56)
 * - 'percent': one decimal place with % suffix (e.g. 12.3%)
 * - 'number': locale-formatted integer/decimal (e.g. 1,234)
 * - default: raw value as-is
 */
function formatValue(value, format) {
  if (value == null) return '-';

  switch (format) {
    case 'currency':
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }).format(value);

    case 'percent':
      return `${Number(value).toFixed(1)}%`;

    case 'number':
      return new Intl.NumberFormat('en-US').format(value);

    default:
      return String(value);
  }
}

/**
 * A single KPI metric card.
 */
function KPICard({ label, value, format, trend, previousValue, icon: Icon }) {
  const hasTrend = trend != null && trend !== 0;
  const isPositive = trend > 0;

  return (
    <Card className="flex-1 min-w-[160px]">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-muted-foreground truncate">
              {label}
            </p>
            <p className="text-2xl font-bold tracking-tight mt-1">
              {formatValue(value, format)}
            </p>
          </div>
          {Icon && (
            <div className="h-8 w-8 shrink-0 rounded-md bg-primary/10 flex items-center justify-center">
              <Icon className="h-4 w-4 text-primary" />
            </div>
          )}
        </div>

        {hasTrend && (
          <div
            className={cn(
              'flex items-center gap-1 mt-2 text-xs font-medium',
              isPositive ? 'text-emerald-600' : 'text-red-600'
            )}
          >
            {isPositive ? (
              <TrendingUp className="h-3.5 w-3.5" />
            ) : (
              <TrendingDown className="h-3.5 w-3.5" />
            )}
            <span>
              {isPositive ? '+' : ''}
              {Number(trend).toFixed(1)}%
            </span>
          </div>
        )}

        {previousValue != null && hasTrend && (
          <p className="text-xs text-muted-foreground mt-1">
            vs {formatValue(previousValue, format)} prev. month
          </p>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * KPIHeader - A responsive row of KPI metric cards for module overview pages.
 *
 * Renders a horizontal row of cards that wraps on smaller screens.
 * Each card displays a label, large formatted value, optional icon,
 * and optional trend indicator with directional arrow.
 */
export function KPIHeader({ kpis = [] }) {
  if (kpis.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-4 mb-6" role="group" aria-label="Key performance indicators">
      {kpis.map((kpi, index) => (
        <KPICard
          key={kpi.label || index}
          label={kpi.label}
          value={kpi.value}
          format={kpi.format}
          trend={kpi.trend}
          previousValue={kpi.previousValue}
          icon={kpi.icon}
        />
      ))}
    </div>
  );
}
