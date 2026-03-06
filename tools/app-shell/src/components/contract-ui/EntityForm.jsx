import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Search } from 'lucide-react';

/**
 * Combobox-style search input for foreign key fields.
 * Displays a search icon and a dropdown placeholder when typing.
 */
function SearchInput({ field, value, onChange }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value ?? '');

  // Sync with external value changes
  React.useEffect(() => {
    setQuery(value ?? '');
  }, [value]);

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          id={field.key}
          name={field.key}
          type="text"
          placeholder={`Search ${field.label}...`}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            onChange?.(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 200)}
          className="pl-8 focus:ring-2 focus:ring-primary focus:outline-none"
          required={field.required}
          autoComplete="off"
        />
      </div>
      {open && query.length > 0 && (
        <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-white border rounded-md shadow-lg max-h-48 overflow-auto">
          <div className="px-3 py-2 text-xs text-muted-foreground">
            Search {field.reference ?? field.label}...
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Generic entity form driven by field declarations.
 *
 * Props:
 *  - fields: Array<{ key, label, type, required, reference }>  (type: 'text' | 'number' | 'date' | 'search')
 *  - data: object with current field values
 *  - onChange: (fieldKey, value) => void
 */
export function EntityForm({ fields = [], data, onChange }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {fields.map(f => {
        if (f.type === 'search') {
          return (
            <div key={f.key} className="space-y-1.5">
              <Label htmlFor={f.key} className="text-sm text-foreground font-medium">
                {f.label}{f.required ? ' *' : ''}
              </Label>
              <SearchInput
                field={f}
                value={data?.[f.key] ?? ''}
                onChange={(val) => onChange?.(f.key, val)}
              />
            </div>
          );
        }
        const inputType = f.type === 'number' ? 'number' : 'text';
        return (
          <div key={f.key} className="space-y-1.5">
            <Label htmlFor={f.key} className="text-sm text-foreground font-medium">
              {f.label}{f.required ? ' *' : ''}
            </Label>
            <Input
              id={f.key}
              name={f.key}
              type={inputType}
              value={data?.[f.key] ?? ''}
              onChange={(e) => onChange?.(f.key, e.target.value)}
              className="focus:ring-2 focus:ring-primary focus:outline-none"
              required={f.required}
            />
          </div>
        );
      })}
    </div>
  );
}
