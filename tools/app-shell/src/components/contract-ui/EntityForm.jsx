import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/**
 * Generic entity form driven by field declarations.
 *
 * Props:
 *  - fields: Array<{ key, label, type, required }>  (type: 'text' | 'number' | 'date')
 *  - data: object with current field values
 *  - onChange: (fieldKey, value) => void
 */
export function EntityForm({ fields = [], data, onChange }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {fields.map(f => {
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
