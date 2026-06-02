import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useUI } from '@/i18n';
import { StatusTag } from '@/components/ui/status-tag';
import { useCurrency } from '@/hooks/useCurrency';
import { formatCurrency } from '@/lib/formatCurrency';

function StatusBadge({ isProcessed, ui }) {
  return (
    <StatusTag
      status={isProcessed ? 'CO' : 'IP'}
      label={isProcessed ? ui('assetsStatusProcessed') : ui('assetsStatusPlanned')}
    />
  );
}

function getLineStatuses(lines, depreciatedValue) {
  const statuses = new Map();
  let cumulative = 0;
  for (const line of lines) {
    cumulative += Number(line.amortizationAmount ?? 0);
    statuses.set(line.id ?? line.sEQNoAsset, cumulative <= depreciatedValue && depreciatedValue > 0);
  }
  return statuses;
}

export default function AssetsAmortizationPanel({ data, recordId: recordIdProp, token, apiBaseUrl, onCountChange }) {
  const ui = useUI();
  const navigate = useNavigate();
  const orgCurrency = useCurrency() ?? 'USD';
  const [lines, setLines] = useState([]);
  const [loading, setLoading] = useState(false);
  const recordId = recordIdProp ?? data?.id;

  const fetchLines = useCallback(() => {
    if (!recordId || !apiBaseUrl) return;
    setLoading(true);
    const url = `${apiBaseUrl}/amortizationLine?parentId=${recordId}&_startRow=0&_endRow=500&_sortBy=sEQNoAsset+asc`;
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : { data: [] })
      .then(json => {
        const rows = json?.response?.data ?? json?.data ?? json?.rows ?? [];
        const normalizedRows = Array.isArray(rows) ? rows : [];
        setLines(normalizedRows);
        onCountChange?.(normalizedRows.length);
      })
      .catch(() => setLines([]))
      .finally(() => setLoading(false));
  }, [recordId, apiBaseUrl, token]);

  useEffect(() => {
    fetchLines();
  }, [fetchLines]);

  useEffect(() => {
    if (!recordId) return undefined;

    function handleProcessSuccess(event) {
      const detail = event?.detail ?? {};
      if (detail.entity !== 'assets') return;
      if (String(detail.recordId) !== String(recordId)) return;
      fetchLines();
    }

    window.addEventListener('neo:processSuccess', handleProcessSuccess);
    return () => window.removeEventListener('neo:processSuccess', handleProcessSuccess);
  }, [recordId, fetchLines]);

  const depreciatedValue = Number(data?.depreciatedValue ?? 0);
  const lineStatuses = getLineStatuses(lines, depreciatedValue);
  const plannedCount = [...lineStatuses.values()].filter(v => !v).length;
  const totalAmount = lines.reduce((sum, l) => sum + Number(l.amortizationAmount ?? 0), 0);

  return (
    <div className="pt-2 pb-5">
      {loading ? (
        <div className="text-xs text-gray-400 py-4 text-center inline-flex items-center gap-1.5 justify-center w-full">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          {ui('assetsLoading')}
        </div>
      ) : lines.length === 0 ? (
        <div className="text-xs text-gray-400 py-6 text-center border border-dashed border-gray-200 rounded-lg">
          {ui('assetsNoAmortizationLines')}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50">
                <th className="text-left text-sm font-semibold text-foreground py-2.5 pr-4">{ui('assetsPeriod')}</th>
                <th className="text-left text-sm font-semibold text-foreground py-2.5 pr-4">{ui('assetsPercentage')}</th>
                <th className="text-left text-sm font-semibold text-foreground py-2.5 pr-4">{ui('amount')}</th>
                <th className="text-left text-sm font-semibold text-foreground py-2.5">{ui('assetsStatus')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {lines.map((line) => (
                <tr
                  key={line.id ?? line.sEQNoAsset}
                  className="hover:bg-muted/30 cursor-pointer"
                  onClick={() => line.amortization && navigate(`/amortization/${line.amortization}`)}
                >
                  <td className="py-3 pr-4 text-foreground">{line['amortization$_identifier'] ?? line.amortization ?? '—'}</td>
                  <td className="py-3 pr-4 text-foreground">
                    {line.amortizationPercentage != null
                      ? `${Number(line.amortizationPercentage).toFixed(2)}%`
                      : '—'}
                  </td>
                  <td className="py-3 pr-4 text-foreground">{formatCurrency(orgCurrency, line.amortizationAmount)}</td>
                  <td className="py-3">
                    <StatusBadge isProcessed={lineStatuses.get(line.id ?? line.sEQNoAsset)} ui={ui} />
                  </td>
                </tr>
              ))}
            </tbody>
            {totalAmount > 0 && (
              <tfoot>
                <tr className="border-t border-border/50">
                  <td colSpan={2} />
                  <td colSpan={2} className="py-3 text-right text-sm font-semibold text-foreground pr-4">
                    {ui('assetsTotalPlanned')} {formatCurrency(orgCurrency, totalAmount)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  );
}
