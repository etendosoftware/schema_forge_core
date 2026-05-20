import { useUI } from '@/i18n';
import DocumentStatusPill from '@/components/contract-ui/DocumentStatusPill';

export default function GoodsShipmentBillingBadge({ data }) {
  const ui = useUI();

  const isCompleted = data?.documentStatus === 'CO';
  if (!isCompleted) return null;

  const ci = data?.completelyInvoiced;
  const fallbackPct = (ci === true || ci === 'true' || ci === 'Y') ? 100 : 0;
  const pct = data?.invoiceStatus != null ? Number(data.invoiceStatus) : fallbackPct;

  const tone = pct >= 100 ? 'success' : pct > 0 ? 'warning' : 'neutral';
  const label = pct >= 100 ? ui('invoiced') : pct > 0 ? ui('partiallyInvoiced') : ui('pending');

  return <DocumentStatusPill tone={tone} label={label} status="billing" />;
}
