import React from 'react';
import { Button } from '@/components/ui/button';
import { useEntity } from '@/hooks/useEntity';

/**
 * Generic single-entity page with split view (table left, form right).
 *
 * Props:
 *  - entity: string (entity name for API calls)
 *  - Table: React component for the data table
 *  - Form: React component for the edit form
 *  - catalogs: object with reference data for FK fields
 *  - token: string
 *  - apiBaseUrl: string
 *  - entityLabel: string (human-readable entity name)
 */
export function SingleEntityPage({
  entity,
  Table,
  Form,
  catalogs,
  token,
  apiBaseUrl,
  entityLabel,
}) {
  const hook = useEntity(entity, null, { token, apiBaseUrl });

  const detailTitle = hook.editing?.id
    ? `${entityLabel || entity} - ${hook.editing.name || hook.editing.id}`
    : `New ${entityLabel || entity}`;

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

      {/* Right panel: Form */}
      {hook.editing && (
        <div className="flex-1 flex flex-col overflow-hidden bg-white">
          {/* Toolbar */}
          <div className="flex items-center gap-2 px-5 py-2.5 border-b border-slate-200 bg-white shadow-sm">
            <h2 className="text-base font-semibold text-foreground truncate">{detailTitle}</h2>
            <div className="flex-1" />
            <div className="flex items-center gap-2">
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

          {/* Form zone */}
          <div className="flex-1 overflow-auto px-5 pt-4 pb-3">
            <Form
              data={hook.editing}
              onChange={hook.handleChange}
              catalogs={catalogs}
            />
          </div>
        </div>
      )}
    </div>
  );
}
