import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '../ui/button.jsx';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog.jsx';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../ui/select.jsx';

const DEFAULT_LABELS = {
  notImported: 'Not imported',
  mappedSummary: '{mapped}/{total} columns mapped',
  editMatch: 'Edit match',
  editTitle: 'Edit column match',
  save: 'Save',
  cancel: 'Cancel',
};
const UNMAPPED_VALUE = '__unmapped__';

function formatTemplate(template, vars) {
  return template.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? '');
}

function targetLabel(importFields, target) {
  if (!target) return null;
  return importFields.find((f) => f.target === target)?.label ?? target;
}

/**
 * The full editable grid — one label+select pair per detected CSV header.
 * Only ever mounted inside the edit modal, operating on draft state owned by
 * the parent; nothing here touches the dialog's real mapping until Save.
 */
function MappingGrid({ headers, importFields, mapping, onMappingChange, text }) {
  return (
    <div className="flex flex-wrap gap-2 py-2">
      {headers.map((header) => {
        const target = mapping[header];
        return (
          <div key={header} className="flex flex-col gap-1 min-w-[140px]">
            <span className="text-xs font-medium text-muted-foreground" data-testid={`ImportColumnMapping__header-${header}`}>{header}</span>
            <Select
              value={target ?? UNMAPPED_VALUE}
              onValueChange={(value) => onMappingChange(header, value === UNMAPPED_VALUE ? null : value)}
              data-testid="Select__bf9e7b">
              <SelectTrigger data-testid={`ImportColumnMapping__select-${header}`} className="h-9">
                <SelectValue data-testid="SelectValue__bf9e7b" />
              </SelectTrigger>
              <SelectContent data-testid="SelectContent__bf9e7b">
                <SelectItem value={UNMAPPED_VALUE} data-testid="SelectItem__bf9e7b">{text.notImported}</SelectItem>
                {importFields.map((field) => (
                  <SelectItem
                    key={field.target}
                    value={field.target}
                    data-testid={"SelectItem__" + field.target}>{field.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        );
      })}
    </div>
  );
}

export function ImportColumnMapping({ headers, importFields, mapping, onApplyMapping, labels }) {
  const text = { ...DEFAULT_LABELS, ...labels };
  const [open, setOpen] = useState(false);
  const [draftMapping, setDraftMapping] = useState(mapping);

  const mappedCount = headers.filter((h) => mapping[h]).length;

  const handleOpen = () => {
    setDraftMapping(mapping);
    setOpen(true);
  };

  const handleDraftChange = (header, target) => {
    setDraftMapping((prev) => ({ ...prev, [header]: target }));
  };

  const handleSave = () => {
    onApplyMapping(draftMapping);
    setOpen(false);
  };

  return (
    <div className="flex flex-col gap-2 py-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground" data-testid="ImportColumnMapping__summaryCount">
          {mappedCount < headers.length && (
            <AlertTriangle className="h-3.5 w-3.5 text-amber-600" aria-hidden="true" data-testid="ImportColumnMapping__summaryWarning" />
          )}
          {formatTemplate(text.mappedSummary, { mapped: mappedCount, total: headers.length })}
        </div>
        <Button type="button" variant="outline" size="sm" onClick={handleOpen} data-testid="ImportColumnMapping__editButton">
          {text.editMatch}
        </Button>
      </div>
      <div className="flex flex-wrap gap-1.5" data-testid="ImportColumnMapping__chips">
        {headers.map((header) => {
          const label = targetLabel(importFields, mapping[header]);
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
            mapping={draftMapping}
            onMappingChange={handleDraftChange}
            text={text}
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
