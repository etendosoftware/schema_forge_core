import { ChevronDown } from 'lucide-react';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../ui/select.jsx';

const DEFAULT_LABELS = { notImported: 'Not imported' };
const UNMAPPED_VALUE = '__unmapped__';

export function ImportColumnMapping({ headers, importFields, mapping, onMappingChange, labels }) {
  const text = { ...DEFAULT_LABELS, ...labels };

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
                <ChevronDown className="h-3 w-3 opacity-50" data-testid="ChevronDown__bf9e7b" />
              </SelectTrigger>
              <SelectContent data-testid="SelectContent__bf9e7b">
                <SelectItem value={UNMAPPED_VALUE} data-testid="SelectItem__bf9e7b">{text.notImported}</SelectItem>
                {importFields.map((field) => (
                  <SelectItem
                    key={field.target}
                    value={field.target}
                    data-testid={"SelectItem__" + field.id}>{field.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        );
      })}
    </div>
  );
}
