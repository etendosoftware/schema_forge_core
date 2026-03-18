export default function AvailableFields({ schema, contract, onAdd }) {
  if (!schema?.entities?.[0]) return null;

  const entity = schema.entities[0];
  const usedFields = new Set((contract.columns ?? []).map(c => c.field));

  const available = entity.fields.filter(
    f => f.visibility !== 'system' && f.visibility !== 'discarded' && !usedFields.has(f.name)
  );

  if (available.length === 0) return null;

  return (
    <div className="border-b border-slate-200">
      <div className="px-3 py-2 bg-slate-50 border-b border-slate-100">
        <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
          Available Fields ({available.length})
        </span>
      </div>
      <div className="divide-y divide-slate-100">
        {available.map(f => (
          <div
            key={f.name}
            className="flex items-center gap-2 py-1.5 px-2 hover:bg-blue-50 cursor-pointer group"
            onClick={() => onAdd(f)}
          >
            <span className="text-xs text-slate-600 flex-1">{f.name}</span>
            <span className="text-xs text-slate-400">{f.type}</span>
            <span className="text-xs text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity">
              + add
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
