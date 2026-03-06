import React, { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Search } from 'lucide-react';

/**
 * Combobox-style search input for foreign key fields.
 * Filters results from catalogs when typing.
 */
function SearchInput({ field, value, onChange, catalogs }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value ?? '');

  React.useEffect(() => {
    setQuery(value ?? '');
  }, [value]);

  const options = catalogs?.[field.reference] ?? [];
  const filtered = useMemo(() => {
    if (!query || query.length === 0) return [];
    const q = query.toLowerCase();
    return options.filter(opt => opt.name.toLowerCase().includes(q)).slice(0, 10);
  }, [query, options]);

  const handleSelect = (opt) => {
    setQuery(opt.name);
    onChange?.(opt.id);
    setOpen(false);
  };

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
      {open && filtered.length > 0 && (
        <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-white border rounded-md shadow-lg max-h-48 overflow-auto">
          {filtered.map(opt => (
            <button
              key={opt.id}
              type="button"
              className="w-full text-left px-3 py-2 text-sm hover:bg-muted/50 cursor-pointer"
              onMouseDown={() => handleSelect(opt)}
            >
              {opt.name}
            </button>
          ))}
        </div>
      )}
      {open && query.length > 0 && filtered.length === 0 && (
        <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-white border rounded-md shadow-lg max-h-48 overflow-auto">
          <div className="px-3 py-2 text-xs text-muted-foreground">
            No results for "{query}"
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Dropdown selector for FK fields with few options (inputMode: selector).
 */
function SelectorInput({ field, value, onChange, catalogs }) {
  const options = catalogs?.[field.reference] ?? [];
  return (
    <select
      id={field.key}
      name={field.key}
      value={value ?? ''}
      onChange={(e) => onChange?.(e.target.value)}
      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus:ring-2 focus:ring-primary focus:outline-none"
      required={field.required}
    >
      <option value="">Select {field.label}...</option>
      {options.map(opt => (
        <option key={opt.id} value={opt.id}>{opt.name}</option>
      ))}
    </select>
  );
}

/**
 * Dependent dropdown that filters options by a parent field value (inputMode: dependent).
 */
function DependentSelect({ field, value, onChange, catalogs, formData }) {
  const parentValue = formData?.[field.dependsOn?.field];
  const allOptions = catalogs?.[field.reference] ?? [];
  const options = parentValue
    ? allOptions.filter(opt => opt[field.dependsOn?.filterKey] === parentValue)
    : [];

  return (
    <select
      id={field.key}
      name={field.key}
      value={value ?? ''}
      onChange={(e) => onChange?.(e.target.value)}
      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus:ring-2 focus:ring-primary focus:outline-none"
      required={field.required}
      disabled={!parentValue}
    >
      <option value="">
        {parentValue ? `Select ${field.label}...` : `Select ${field.dependsOn?.field} first`}
      </option>
      {options.map(opt => (
        <option key={opt.id} value={opt.id}>{opt.name}</option>
      ))}
    </select>
  );
}

/**
 * Generic entity form driven by field declarations.
 *
 * Props:
 *  - fields: Array<{ key, label, type, required, reference, inputMode, dependsOn }>
 *  - data: object with current field values
 *  - onChange: (fieldKey, value) => void
 *  - catalogs: Record<string, Array<{ id, name, ... }>> for FK reference data
 */
export function EntityForm({ fields = [], data, onChange, catalogs }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {fields.map(f => {
        if (f.type === 'dependent') {
          return (
            <div key={f.key} className="space-y-1.5">
              <Label htmlFor={f.key} className="text-sm text-foreground font-medium">
                {f.label}{f.required ? ' *' : ''}
              </Label>
              <DependentSelect
                field={f}
                value={data?.[f.key] ?? ''}
                onChange={(val) => onChange?.(f.key, val)}
                catalogs={catalogs}
                formData={data}
              />
            </div>
          );
        }
        if (f.type === 'selector') {
          return (
            <div key={f.key} className="space-y-1.5">
              <Label htmlFor={f.key} className="text-sm text-foreground font-medium">
                {f.label}{f.required ? ' *' : ''}
              </Label>
              <SelectorInput
                field={f}
                value={data?.[f.key] ?? ''}
                onChange={(val) => onChange?.(f.key, val)}
                catalogs={catalogs}
              />
            </div>
          );
        }
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
                catalogs={catalogs}
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
