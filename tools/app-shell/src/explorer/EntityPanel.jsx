import { cn } from '@/lib/utils';
import { useSpecDetail } from './useDiscovery';

const METHOD_COLORS = {
  GET: 'bg-green-600/20 text-green-400',
  POST: 'bg-blue-600/20 text-blue-400',
  PUT: 'bg-amber-600/20 text-amber-400',
  PATCH: 'bg-orange-600/20 text-orange-400',
  DELETE: 'bg-red-600/20 text-red-400',
};

export default function EntityPanel({ specName, selectedEntity, onSelectEntity }) {
  const { spec, loading, error } = useSpecDetail(specName);

  if (!specName) {
    return <div className="p-4 text-sm text-zinc-500">Select a spec</div>;
  }
  if (loading) return <div className="p-4 text-sm text-zinc-400">Loading...</div>;
  if (error) return <div className="p-4 text-sm text-red-400">{error}</div>;
  if (!spec) return null;

  const entities = spec.entities || [];

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="px-3 py-2 border-b border-zinc-800">
        <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
          {spec.name}
        </div>
        <div className="text-[10px] text-zinc-500 mt-0.5">
          {spec.type === 'W' ? 'Window' : 'Process'} · {entities.length} entities
        </div>
      </div>

      {entities.map(entity => (
        <button
          key={entity.name}
          onClick={() => onSelectEntity(entity)}
          className={cn(
            'w-full text-left px-3 py-3 border-b border-zinc-800/50 transition-colors',
            selectedEntity?.name === entity.name
              ? 'bg-zinc-800'
              : 'hover:bg-zinc-800/50'
          )}
          style={{ paddingLeft: `${12 + (entity.tabLevel || 0) * 16}px` }}
        >
          <div className="flex items-center gap-2">
            <span className="text-sm text-zinc-200 font-medium">{entity.name}</span>
            {entity.tabLevel > 0 && (
              <span className="text-[10px] text-zinc-600">L{entity.tabLevel}</span>
            )}
          </div>
          <div className="flex gap-1 mt-1.5 flex-wrap">
            {(entity.methods || []).map(m => (
              <span
                key={m}
                className={cn(
                  'px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold',
                  METHOD_COLORS[m] || 'bg-zinc-700 text-zinc-300'
                )}
              >
                {m}
              </span>
            ))}
          </div>
          {entity.fields && (
            <div className="text-[10px] text-zinc-500 mt-1">
              {entity.fields.length} fields
            </div>
          )}
        </button>
      ))}
    </div>
  );
}
