import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { useEntity } from '@/hooks/useEntity';

/**
 * Generic master-detail page with Split View layout (40/60).
 *
 * Props:
 *  - entity: string (primary entity name)
 *  - detailEntity: string (child entity name)
 *  - Table: React component for the master table
 *  - Form: React component for the edit form
 *  - DetailTable: React component for the child table
 *  - summary: Array<{ key, label, type }> (read-only summary fields)
 *  - statusField: string (field key used for status badge in toolbar)
 *  - processes: Array<{ name, label, style }> (style: 'positive' | 'destructive')
 *  - addLineFields: { entry: Array<{ key, label, type, required, lookup }>, derived: Array<{ key, label, type }> }
 *  - token: string
 *  - apiBaseUrl: string
 *  - entityLabel: string (human-readable entity name, e.g. 'Order')
 *  - detailLabel: string (human-readable detail name, e.g. 'Order Line')
 *  - titleField: string (field key for display title, defaults to 'documentNo')
 */
export function MasterDetailPage({
  entity,
  detailEntity,
  Table,
  Form,
  DetailTable,
  summary = [],
  statusField,
  processes = [],
  addLineFields = { entry: [], derived: [] },
  token,
  apiBaseUrl,
  entityLabel,
  detailLabel,
  titleField = 'documentNo',
}) {
  const hook = useEntity(entity, detailEntity, { token, apiBaseUrl });
  const [showAddLine, setShowAddLine] = useState(false);

  const allEntryFields = addLineFields.entry ?? [];
  const allDerivedFields = addLineFields.derived ?? [];
  const allDetailFields = [...allEntryFields, ...allDerivedFields];

  const emptyLine = Object.fromEntries(allDetailFields.map(f => [f.key, '']));
  const [newLine, setNewLine] = useState(emptyLine);

  const detailTitle = hook.editing?.id
    ? `${entityLabel || entity} ${hook.editing[titleField] || hook.editing.id}`
    : `New ${entityLabel || entity}`;

  const handleAddLine = () => {
    hook.handleAddChild?.(newLine);
    setNewLine({ ...emptyLine });
    setShowAddLine(false);
  };

  const handleProductLookup = async (value) => {
    const defaults = await hook.lookupChildDefaults?.(value);
    if (defaults) {
      setNewLine(prev => ({ ...prev, ...defaults }));
    }
  };

  const renderSummaryValue = (field) => {
    const val = hook.editing?.[field.key];
    if (val == null) return '\u2014';
    if (field.type === 'amount' || field.type === 'number') {
      return val.toLocaleString?.() ?? val;
    }
    return val;
  };

  // Find the lookup trigger field (first entry field with lookup: true, or first entry field)
  const lookupTriggerKey = allEntryFields.find(f => f.lookup)?.key ?? allEntryFields[0]?.key;

  return (
    <div className="flex h-[calc(100vh-4rem)] gap-0">
      {/* Left panel: Table */}
      <div className={`flex flex-col border-r transition-all duration-300 ${hook.editing ? 'w-2/5' : 'w-full'}`}>
        <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/20">
          <div>
            <h2 className="text-lg font-semibold text-foreground">{entityLabel || entity}s</h2>
            <p className="text-xs text-muted-foreground">
              {hook.loading ? 'Loading...' : `${hook.items.length} records`}
            </p>
          </div>
          <Button onClick={hook.handleNew} size="sm">+ New</Button>
        </div>
        <div className="flex-1 overflow-auto p-3">
          {hook.loading ? (
            <div className="animate-pulse space-y-3">
              <div className="h-10 bg-muted rounded" />
              <div className="h-8 bg-muted/60 rounded" />
              <div className="h-8 bg-muted/40 rounded" />
              <div className="h-8 bg-muted/60 rounded" />
              <div className="h-8 bg-muted/40 rounded" />
            </div>
          ) : (
            <Table
              data={hook.items}
              onRowSelect={hook.handleSelect}
              selectedId={hook.selected?.id}
              compact={!!hook.editing}
            />
          )}
        </div>
      </div>

      {/* Right panel: Toolbar + Summary + Form + Detail */}
      {hook.editing && (
        <div className="flex-1 flex flex-col overflow-hidden bg-white">
          {/* Toolbar: title, status, process actions, save/delete */}
          <div className="flex items-center gap-2 px-5 py-2.5 border-b border-slate-200 bg-white shadow-sm">
            <h2 className="text-base font-semibold text-foreground truncate">{detailTitle}</h2>
            {statusField && <StatusBadge status={hook.editing?.[statusField]} />}
            <div className="flex-1" />
            <div className="flex items-center gap-2">
              {processes.length > 0 && <div className="h-5 w-px bg-border" />}
              {processes.map(p => {
                const btnClass = p.style === 'destructive'
                  ? 'border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100'
                  : 'border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100';
                return (
                  <Button
                    key={p.name}
                    variant="outline"
                    size="sm"
                    className={btnClass}
                    onClick={() => hook.handleProcess?.(p.name)}
                  >
                    {p.label}
                  </Button>
                );
              })}
              <Button size="sm" onClick={() => hook.handleSave(hook.editing)}>Save</Button>
              {hook.selected && (
                <Button variant="destructive" size="sm" onClick={hook.handleDelete}>Delete</Button>
              )}
              <button
                onClick={() => hook.handleSelect(null)}
                className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                aria-label="Close detail"
              >
                &times;
              </button>
            </div>
          </div>

          {/* Summary strip: read-only reference fields */}
          <div className="flex items-center gap-5 px-5 py-2.5 border-b border-slate-200 bg-slate-50 text-xs">
            {summary.map(field => (
              <div key={field.key} className="flex items-center gap-1.5">
                <span className="text-slate-500">{field.label}:</span>
                <span className={`font-semibold text-foreground ${field.type === 'amount' || field.type === 'number' ? 'tabular-nums' : ''}`}>
                  {renderSummaryValue(field)}
                </span>
              </div>
            ))}
          </div>

          {/* Form zone: editable fields only */}
          <div className="px-5 pt-4 pb-3 border-b">
            <Form
              data={hook.editing}
              onChange={hook.handleChange}
            />
          </div>

          {/* Detail zone: fills remaining height */}
          <div className="flex-1 flex flex-col overflow-hidden px-5 py-3">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">{detailLabel || detailEntity}s</h3>
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-7"
                onClick={() => setShowAddLine(!showAddLine)}
              >
                {showAddLine ? 'Cancel' : '+ Add Line'}
              </Button>
            </div>
            {showAddLine && (
              <form
                onSubmit={(e) => { e.preventDefault(); handleAddLine(); }}
                className="flex items-end gap-2 mb-3 p-3 rounded-lg border border-dashed border-primary/30 bg-primary/5"
              >
                {allEntryFields.map(f => {
                  const inputType = f.type === 'number' ? 'number' : 'text';
                  const isLookupTrigger = f.key === lookupTriggerKey;
                  return (
                    <div key={f.key} className="flex-1 min-w-0">
                      <label className="text-xs text-slate-500 mb-1 block">
                        {f.label}{f.required ? ' *' : ''}
                      </label>
                      <input
                        name={f.key}
                        type={inputType}
                        placeholder={f.label}
                        value={newLine[f.key] ?? ''}
                        onChange={(e) => setNewLine(prev => ({ ...prev, [f.key]: e.target.value }))}
                        onBlur={isLookupTrigger ? (e) => { if (e.target.value) handleProductLookup(e.target.value); } : undefined}
                        className="w-full h-8 text-sm rounded-md border border-input bg-white px-2 focus:ring-2 focus:ring-primary focus:outline-none"
                        required={f.required}
                      />
                    </div>
                  );
                })}
                {allDerivedFields.length > 0 && (
                  <div className="w-px h-8 bg-slate-200 self-end mb-0.5" />
                )}
                {allDerivedFields.map(f => (
                  <div key={f.key} className="flex-1 min-w-0">
                    <label className="text-xs text-slate-400 mb-1 block">{f.label}</label>
                    <div className="h-8 text-sm rounded-md border border-dashed border-slate-200 bg-slate-50 px-2 flex items-center text-slate-600 tabular-nums">
                      {newLine[f.key] || '\u2014'}
                    </div>
                  </div>
                ))}
                <Button type="submit" size="sm" className="h-8 shrink-0">Add</Button>
              </form>
            )}
            <div className="flex-1 overflow-auto">
              <DetailTable data={hook.children} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
