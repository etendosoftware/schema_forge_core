import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '../ui/button.jsx';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog.jsx';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../ui/select.jsx';

const DEFAULT_LABELS = {
  notImported: 'Not imported',
  mappedSummary: '{mapped}/{total} fields mapped',
  alreadyAssigned: 'already fills {field}',
  editMatch: 'Edit match',
  editTitle: 'Choose the column that fills each field',
  save: 'Save',
  cancel: 'Cancel',
};
const UNMAPPED_VALUE = '__unmapped__';

function formatTemplate(template, vars) {
  return template.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? '');
}

/**
 * A field's caption in the session language.
 *
 * ETP-5223: this used to read `field.label` straight off the descriptor, which is the ENGLISH
 * text declared in decisions.json — so the mapping chips and the "Editar correspondencia"
 * dropdown printed "Search Key" / "Sales Price" no matter what language the session was in,
 * even though the dialog already resolved the localized caption for the CSV template header.
 * `fieldLabelFn` is that same resolver (AD label dictionary, or the field's `labelKey`),
 * threaded down here so one field carries one name everywhere in the flow.
 */
function labelOf(field, fieldLabelFn) {
  if (!field) return null;
  const resolved = typeof fieldLabelFn === 'function' ? fieldLabelFn(field) : null;
  return resolved || field.label || field.target;
}

function targetLabel(importFields, target, fieldLabelFn) {
  if (!target) return null;
  const field = importFields.find((f) => f.target === target);
  return field ? labelOf(field, fieldLabelFn) : target;
}

/**
 * `{header: target}` → `{target: header}` — the shape the editor works in.
 */
function sourcesByTarget(mapping) {
  const out = {};
  for (const [header, target] of Object.entries(mapping ?? {})) {
    if (target) out[target] = header;
  }
  return out;
}

/**
 * `{target: header}` → `{header: target}` — the shape every consumer reads.
 *
 * A header nothing points at is simply absent, which every consumer already treats as unmapped.
 * The relation is one-to-one in both directions: a field has a single source by construction
 * (one select), and a column cannot be picked by a second field (see `takenBy` below).
 */
function targetsByHeader(sourceByTarget, importFields) {
  const out = {};
  for (const field of importFields) {
    const header = sourceByTarget[field.target];
    if (header) out[header] = field.target;
  }
  return out;
}

/**
 * `{header: target}` for every column already claimed by some field — what makes a column
 * un-pickable by a second one.
 */
function takenBy(sourceByTarget) {
  const out = {};
  for (const [target, header] of Object.entries(sourceByTarget)) {
    if (header) out[header] = target;
  }
  return out;
}

/**
 * The full editable grid — one label+select pair per importable FIELD.
 *
 * Keyed by field, not by file column, and that direction is the point. Keyed by column it asked
 * "this column — which field?", which let two columns name the same field: the second silently
 * overwrote the first, so a user who mapped two columns onto `Fecha` saved without a warning,
 * found the other column's data gone from the review table, and was shown an error about the
 * value ("the date is not valid") that said nothing about the real cause.
 *
 * Asking "this field — which column?" makes that unrepresentable: a field has exactly one
 * select, so nothing can be overwritten. The other half of the one-to-one — a column feeding
 * two fields — is blocked by disabling a column in every OTHER field's list once some field
 * claims it. The disabled option stays visible and says which field holds it, so the rule
 * explains itself instead of a column silently vanishing from the list.
 *
 * Only ever mounted inside the edit modal, operating on draft state owned by the parent;
 * nothing here touches the dialog's real mapping until Save.
 */
function MappingGrid({ headers, importFields, sourceByTarget, onSourceChange, text, fieldLabelFn }) {
  const claimed = takenBy(sourceByTarget);
  const fieldLabel = (target) => labelOf(importFields.find((f) => f.target === target), fieldLabelFn) ?? target;
  return (
    <div className="flex flex-wrap gap-2 py-2">
      {importFields.map((field) => {
        const header = sourceByTarget[field.target];
        return (
          <div key={field.target} className="flex flex-col gap-1 min-w-[140px]">
            <span className="text-xs font-medium text-muted-foreground" data-testid={`ImportColumnMapping__field-${field.target}`}>
              {labelOf(field, fieldLabelFn)}
              {field.required ? ' *' : ''}
            </span>
            <Select
              value={header ?? UNMAPPED_VALUE}
              onValueChange={(value) => onSourceChange(field.target, value === UNMAPPED_VALUE ? null : value)}
              data-testid="Select__bf9e7b">
              <SelectTrigger data-testid={`ImportColumnMapping__select-${field.target}`} className="h-9">
                <SelectValue data-testid="SelectValue__bf9e7b" />
              </SelectTrigger>
              <SelectContent data-testid="SelectContent__bf9e7b">
                <SelectItem value={UNMAPPED_VALUE} data-testid="SelectItem__bf9e7b">{text.notImported}</SelectItem>
                {headers.map((h) => {
                  // Claimed by ANOTHER field — not by this one, whose own value must stay
                  // selectable or the select could not render what it already holds.
                  const owner = claimed[h] === field.target ? null : claimed[h];
                  return (
                    <SelectItem
                      key={h}
                      value={h}
                      disabled={Boolean(owner)}
                      data-testid={"SelectItem__" + h}>
                      {owner
                        ? `${h} — ${formatTemplate(text.alreadyAssigned, { field: fieldLabel(owner) })}`
                        : h}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
        );
      })}
    </div>
  );
}

export function ImportColumnMapping({ headers, importFields, mapping, onApplyMapping, labels, fieldLabelFn }) {
  const text = { ...DEFAULT_LABELS, ...labels };
  const [open, setOpen] = useState(false);
  // The editor works field-first (`{target: header}`); the mapping crosses the props boundary
  // column-first (`{header: target|target[]}`), which is what `mapColumns` produces and what
  // every consumer reads. Converted on open and on save so neither side has to know the other's.
  const [draftSources, setDraftSources] = useState(() => sourcesByTarget(mapping));

  // Counts FIELDS with a source, not columns with a destination: a column feeding two fields is
  // one column and two fields, and the number that tells the user whether the import is complete
  // is how many fields will be filled.
  const mappedCount = importFields.filter((f) => sourcesByTarget(mapping)[f.target]).length;

  const handleOpen = () => {
    setDraftSources(sourcesByTarget(mapping));
    setOpen(true);
  };

  const handleSourceChange = (target, header) => {
    setDraftSources((prev) => ({ ...prev, [target]: header }));
  };

  const handleSave = () => {
    onApplyMapping(targetsByHeader(draftSources, importFields));
    setOpen(false);
  };

  return (
    <div className="flex flex-col gap-2 py-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground" data-testid="ImportColumnMapping__summaryCount">
          {mappedCount < importFields.length && (
            <AlertTriangle className="h-3.5 w-3.5 text-amber-600" aria-hidden="true" data-testid="ImportColumnMapping__summaryWarning" />
          )}
          {formatTemplate(text.mappedSummary, { mapped: mappedCount, total: importFields.length })}
        </div>
        <Button type="button" variant="outline" size="sm" onClick={handleOpen} data-testid="ImportColumnMapping__editButton">
          {text.editMatch}
        </Button>
      </div>
      <div className="flex flex-wrap gap-1.5" data-testid="ImportColumnMapping__chips">
        {headers.map((header) => {
          const label = targetLabel(importFields, mapping[header], fieldLabelFn);
          return (
            <span
              key={header}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-xs"
              data-testid={`ImportColumnMapping__chip-${header}`}
            >
              <span className="text-muted-foreground">{header}</span>
              <span aria-hidden="true">&rarr;</span>
              <span className={label ? '' : 'italic text-muted-foreground'}>{label ?? text.notImported}</span>
            </span>
          );
        })}
      </div>
      <Dialog open={open} onOpenChange={setOpen} data-testid="Dialog__columnMappingEdit">
        <DialogContent data-testid="DialogContent__columnMappingEdit">
          <DialogHeader data-testid="DialogHeader__columnMappingEdit">
            <DialogTitle data-testid="DialogTitle__columnMappingEdit">{text.editTitle}</DialogTitle>
          </DialogHeader>
          <MappingGrid
            headers={headers}
            importFields={importFields}
            sourceByTarget={draftSources}
            onSourceChange={handleSourceChange}
            text={text}
            fieldLabelFn={fieldLabelFn}
            data-testid="MappingGrid__bf9e7b" />
          <DialogFooter data-testid="DialogFooter__columnMappingEdit">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} data-testid="ImportColumnMapping__cancelButton">
              {text.cancel}
            </Button>
            <Button type="button" onClick={handleSave} data-testid="ImportColumnMapping__saveButton">
              {text.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
