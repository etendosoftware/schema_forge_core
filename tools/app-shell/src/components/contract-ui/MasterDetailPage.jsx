import React, { useState } from 'react';
import { Button } from '@/components/ui/button.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Skeleton } from '@/components/ui/skeleton.jsx';
import { Card, CardHeader, CardContent } from '@/components/ui/card.jsx';
import { Separator } from '@/components/ui/separator.jsx';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip.jsx';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet.jsx';
import { Search, X } from 'lucide-react';
import { useEntity } from '@/hooks/useEntity';

/**
 * Map a status string to a Badge variant + optional className override.
 */
function getStatusBadgeProps(status) {
  if (!status) return { variant: 'outline', children: status };
  const s = String(status).toLowerCase();
  if (s === 'draft' || s === 'dr') {
    return { variant: 'secondary' };
  }
  if (s === 'completed' || s === 'complete' || s === 'booked' || s === 'co') {
    return { variant: 'default', className: 'bg-emerald-600 hover:bg-emerald-500 text-white border-transparent' };
  }
  if (s === 'voided' || s === 'cancelled' || s === 'void' || s === 'vo') {
    return { variant: 'destructive' };
  }
  return { variant: 'outline' };
}

function statusLabel(status) {
  const MAP = { DR: 'Draft', CO: 'Complete', VO: 'Void', IP: 'In Process' };
  return MAP[status] || status;
}

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
  catalogs,
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

  const addLineForm = (
    <form
      onSubmit={(e) => { e.preventDefault(); handleAddLine(); }}
      className="space-y-4"
    >
      <div className="grid grid-cols-2 gap-3">
        {allEntryFields.map(f => {
          const isSearch = f.type === 'search';
          const isSelector = f.type === 'selector';
          const isDependent = f.type === 'dependent';
          const inputType = f.type === 'number' ? 'number' : 'text';
          const isLookupTrigger = f.key === lookupTriggerKey;

          if (isSelector) {
            const options = catalogs?.[f.reference] ?? [];
            return (
              <div key={f.key} className="min-w-0">
                <label className="text-xs text-slate-500 mb-1 block">
                  {f.label}{f.required ? ' *' : ''}
                </label>
                <select
                  name={f.key}
                  value={newLine[f.key] ?? ''}
                  onChange={(e) => setNewLine(prev => ({ ...prev, [f.key]: e.target.value }))}
                  className="w-full h-8 text-sm rounded-md border border-input bg-white px-2 focus:ring-2 focus:ring-primary focus:outline-none"
                  required={f.required}
                >
                  <option value="">Select...</option>
                  {options.map(opt => (
                    <option key={opt.id} value={opt.id}>{opt.name}</option>
                  ))}
                </select>
              </div>
            );
          }

          if (isDependent) {
            const parentVal = newLine[f.dependsOn?.field];
            const allOpts = catalogs?.[f.reference] ?? [];
            const options = parentVal
              ? allOpts.filter(opt => opt[f.dependsOn?.filterKey] === parentVal)
              : [];
            return (
              <div key={f.key} className="min-w-0">
                <label className="text-xs text-slate-500 mb-1 block">
                  {f.label}{f.required ? ' *' : ''}
                </label>
                <select
                  name={f.key}
                  value={newLine[f.key] ?? ''}
                  onChange={(e) => setNewLine(prev => ({ ...prev, [f.key]: e.target.value }))}
                  className="w-full h-8 text-sm rounded-md border border-input bg-white px-2 focus:ring-2 focus:ring-primary focus:outline-none"
                  required={f.required}
                  disabled={!parentVal}
                >
                  <option value="">{parentVal ? 'Select...' : `Select ${f.dependsOn?.field} first`}</option>
                  {options.map(opt => (
                    <option key={opt.id} value={opt.id}>{opt.name}</option>
                  ))}
                </select>
              </div>
            );
          }

          return (
            <div key={f.key} className="min-w-0">
              <label className="text-xs text-slate-500 mb-1 block">
                {f.label}{f.required ? ' *' : ''}
              </label>
              <div className="relative">
                {isSearch && (
                  <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                )}
                <input
                  name={f.key}
                  type={inputType}
                  placeholder={isSearch ? `Search ${f.label}...` : f.label}
                  value={newLine[f.key] ?? ''}
                  onChange={(e) => setNewLine(prev => ({ ...prev, [f.key]: e.target.value }))}
                  onBlur={isLookupTrigger ? (e) => { if (e.target.value) handleProductLookup(e.target.value); } : undefined}
                  className={`w-full h-8 text-sm rounded-md border border-input bg-white px-2 focus:ring-2 focus:ring-primary focus:outline-none ${isSearch ? 'pl-7' : ''}`}
                  required={f.required}
                  autoComplete="off"
                />
              </div>
            </div>
          );
        })}
      </div>
      {allDerivedFields.length > 0 && (
        <>
          <Separator />
          <div className="grid grid-cols-2 gap-3">
            {allDerivedFields.map(f => (
              <div key={f.key} className="min-w-0">
                <label className="text-xs text-slate-400 mb-1 block">{f.label}</label>
                <div className="h-8 text-sm rounded-md border border-dashed border-slate-200 bg-slate-50 px-2 flex items-center text-slate-600 tabular-nums">
                  {newLine[f.key] || '\u2014'}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
      <div className="flex justify-end pt-2">
        <Button type="submit" size="sm">Add Line</Button>
      </div>
    </form>
  );

  return (
    <TooltipProvider>
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
              <div className="space-y-3">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            ) : (
              <Table
                entity={entity}
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
              {statusField && hook.editing?.[statusField] && (
                <Badge {...getStatusBadgeProps(hook.editing[statusField])}>
                  {statusLabel(hook.editing[statusField])}
                </Badge>
              )}
              <div className="flex-1" />
              <div className="flex items-center gap-2">
                {processes.length > 0 && <Separator orientation="vertical" className="h-5" />}
                {processes.map(p => {
                  const btnClass = p.style === 'destructive'
                    ? 'border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100'
                    : 'border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100';
                  return (
                    <Tooltip key={p.name}>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className={btnClass}
                          onClick={() => hook.handleProcess?.(p.name)}
                        >
                          {p.label}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{p.label}</p>
                      </TooltipContent>
                    </Tooltip>
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
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Summary strip: read-only reference fields */}
            <Card className="mx-5 mt-3 rounded-lg shadow-none border">
              <CardHeader className="p-0">
                <CardContent className="flex items-center gap-5 px-4 py-2.5 text-xs">
                  {summary.map(field => (
                    <div key={field.key} className="flex items-center gap-1.5">
                      <span className="text-slate-500">{field.label}:</span>
                      <span className={`font-semibold text-foreground ${field.type === 'amount' || field.type === 'number' ? 'tabular-nums' : ''}`}>
                        {renderSummaryValue(field)}
                      </span>
                    </div>
                  ))}
                </CardContent>
              </CardHeader>
            </Card>

            {/* Form zone: editable fields only */}
            <div className="px-5 pt-4 pb-3 border-b">
              <Form
                entity={entity}
                data={hook.editing}
                onChange={hook.handleChange}
                catalogs={catalogs}
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

              {/* Sheet for add-line form */}
              <Sheet open={showAddLine} onOpenChange={setShowAddLine}>
                <SheetContent side="bottom" className="max-h-[50vh]">
                  <SheetHeader>
                    <SheetTitle>Add {detailLabel || detailEntity}</SheetTitle>
                    <SheetDescription>
                      Fill in the fields below and click Add Line to create a new entry.
                    </SheetDescription>
                  </SheetHeader>
                  <div className="pt-4">
                    {addLineForm}
                  </div>
                </SheetContent>
              </Sheet>

              <div className="flex-1 overflow-auto">
                <DetailTable data={hook.children} />
              </div>
            </div>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
