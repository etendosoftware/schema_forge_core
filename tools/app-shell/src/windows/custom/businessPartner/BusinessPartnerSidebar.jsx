import { useState, useEffect } from 'react';
import { DollarSign, CreditCard } from 'lucide-react';
import { KPICard } from '@/components/contract-ui/KPIHeader';

const ICON_MAP = { DollarSign, CreditCard };

export default function BusinessPartnerSidebar({ recordId, token, apiBaseUrl }) {
  const [kpis, setKpis] = useState(null);

  useEffect(() => {
    if (!recordId || !token || !apiBaseUrl) return;

    setKpis(null);

    const headers = { Authorization: `Bearer ${token}` };
    fetch(`${apiBaseUrl}/bp-stats?businessPartnerId=${recordId}`, { headers })
      .then(r => (r.ok ? r.json() : null))
      .then(data => setKpis(data?.response?.data ?? []))
      .catch(() => setKpis([]));
  }, [recordId, token, apiBaseUrl]);

  if (kpis === null) {
    return (
      <div className="flex flex-col gap-3 animate-pulse">
        <div className="h-24 rounded-xl bg-gray-100" />
        <div className="h-24 rounded-xl bg-gray-100" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {kpis.map(kpi => (
        <KPICard
          key={kpi.key}
          kpiKey={kpi.key}
          label={kpi.label}
          value={kpi.value}
          format={kpi.format}
          trend={kpi.trend || null}
          previousValue={kpi.previousValue || null}
          icon={ICON_MAP[kpi.icon]}
        />
      ))}
    </div>
  );
}
