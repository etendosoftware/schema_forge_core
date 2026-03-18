export default function FilterPanel({ filters, locale }) {
  if (!filters || filters.length === 0) return null;

  const resolveLabel = (obj) => {
    if (typeof obj === 'string') return obj;
    return obj?.[locale] ?? obj?.en_US ?? '';
  };

  return (
    <div className="border-b border-slate-200">
      <div className="px-3 py-2 bg-slate-50 border-b border-slate-100">
        <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
          Filters ({filters.length})
        </span>
      </div>
      <div className="p-2 space-y-2">
        {filters.map(f => (
          <div key={f.field} className="flex flex-col gap-1">
            <label className="text-xs text-slate-500">{resolveLabel(f.label)}</label>
            {f.type === 'boolean' ? (
              <select className="text-xs border border-slate-200 rounded px-2 py-1">
                <option value="">All</option>
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            ) : (
              <input
                type="text"
                placeholder={resolveLabel(f.label)}
                className="text-xs border border-slate-200 rounded px-2 py-1"
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
