import { useState } from 'react';

function ColumnRow({ col, onRemove }) {
  return (
    <div className="flex items-center gap-2 py-1.5 px-2 hover:bg-slate-50 group">
      <span className="text-xs font-medium text-slate-700 flex-1">{col.field}</span>
      <span className="text-xs text-slate-400">{col.type}</span>
      <span className="text-xs text-slate-400 w-12 text-right">{col.width ?? 'auto'}</span>
      <button
        onClick={() => onRemove(col.field)}
        className="text-red-400 hover:text-red-600 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
        title="Remove column"
      >
        ×
      </button>
    </div>
  );
}

export default function ContractEditor({ contract, onChange, onRemoveColumn }) {
  const [showJson, setShowJson] = useState(false);
  const [jsonText, setJsonText] = useState('');

  const handleToggleJson = () => {
    if (!showJson) {
      setJsonText(JSON.stringify(contract, null, 2));
    }
    setShowJson(!showJson);
  };

  const handleJsonSave = () => {
    try {
      const parsed = JSON.parse(jsonText);
      onChange(parsed);
      setShowJson(false);
    } catch {
      // invalid JSON — don't save
    }
  };

  return (
    <div className="border-b border-slate-200">
      <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border-b border-slate-200">
        <h2 className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Contract</h2>
        <button
          onClick={handleToggleJson}
          className="text-xs text-blue-600 hover:text-blue-800"
        >
          {showJson ? 'Visual' : 'JSON'}
        </button>
      </div>

      {showJson ? (
        <div className="p-2">
          <textarea
            value={jsonText}
            onChange={e => setJsonText(e.target.value)}
            className="w-full h-64 text-xs mono bg-slate-900 text-green-400 p-2 rounded border-0 resize-none"
            spellCheck={false}
          />
          <button
            onClick={handleJsonSave}
            className="mt-1 text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700"
          >
            Apply
          </button>
        </div>
      ) : (
        <div>
          {/* Report info */}
          <div className="px-3 py-2 text-xs text-slate-500 border-b border-slate-100">
            <span className="font-medium text-slate-700">{contract.reportId}</span>
            <span className="mx-1">·</span>
            <span>{contract.type}</span>
            <span className="mx-1">·</span>
            <span>{contract.outputs?.join(', ')}</span>
          </div>

          {/* Columns */}
          <div className="px-3 py-1.5 bg-slate-50 border-b border-slate-100">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Columns ({contract.columns?.length ?? 0})
            </span>
          </div>
          <div className="divide-y divide-slate-100">
            {(contract.columns ?? []).map(col => (
              <ColumnRow key={col.field} col={col} onRemove={onRemoveColumn} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
