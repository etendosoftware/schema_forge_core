import { useUI } from '@/i18n';
import { InfoRow } from './SummaryCard.jsx';

function SectionCard({ title, children }) {
  return (
    <div className="mx-4 mt-5">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{title}</span>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden px-4 py-2">
        {children}
      </div>
    </div>
  );
}

/**
 * CategorizationCard — generic list of label/value rows.
 *
 * Props:
 *   rows   Array<{ label: string, value: string | null }>
 */
export default function CategorizationCard({ rows = [] }) {
  const ui = useUI();

  if (rows.length === 0) return null;

  return (
    <SectionCard title={ui('previewCardCategorization')}>
      {rows.map(({ label, value }) => (
        <InfoRow key={label} label={label} value={value} />
      ))}
    </SectionCard>
  );
}
