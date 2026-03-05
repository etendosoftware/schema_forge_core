import { useState, useMemo } from 'react';
import ImpactWarning from './ImpactWarning.jsx';

const VISIBILITIES = ['editable', 'readOnly', 'system', 'discarded'];
const SYSTEM_CATEGORIES = ['fromConfig', 'fromParent', 'fromField', 'lookup', 'computed', 'sequence'];

const visColors = {
  editable: '#27ae60',
  readOnly: '#2980b9',
  system: '#7f8c8d',
  discarded: '#c0392b',
};

const cellStyle = { padding: '6px 10px', borderBottom: '1px solid #eee' };
const headerStyle = {
  ...cellStyle,
  background: '#f8f9fa',
  fontWeight: 600,
  position: 'sticky',
  top: 0,
};

/**
 * FieldEditor — table of fields grouped by entity.
 * Props:
 *   fields          — array of field objects from schema-raw.json
 *   impactMessages  — object from impact-messages.json
 *   onFieldChange   — (fieldId, changes) => void
 */
export default function FieldEditor({ fields, impactMessages, onFieldChange }) {
  const [warning, setWarning] = useState(null);

  // Group fields by entity
  const grouped = useMemo(() => {
    const map = {};
    for (const f of fields) {
      const entity = f.entity || 'Unknown';
      if (!map[entity]) map[entity] = [];
      map[entity].push(f);
    }
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }, [fields]);

  const handleVisibilityChange = (field, newVis) => {
    if (newVis === 'discarded') {
      // Determine impact category — use field.impactCategory or fallback to 'internal'
      const category = field.impactCategory || 'internal';
      const message = impactMessages[category] || 'This action may have unintended side effects.';
      setWarning({
        fieldId: field.id || field.name,
        fieldName: field.name,
        message,
        newVis,
      });
    } else {
      onFieldChange(field.id || field.name, { visibility: newVis });
    }
  };

  const confirmDiscard = () => {
    if (warning) {
      onFieldChange(warning.fieldId, { visibility: warning.newVis });
      setWarning(null);
    }
  };

  return (
    <div style={{ flex: 1, overflow: 'auto', borderRight: '1px solid #ddd' }}>
      <h2 style={{ padding: '12px 16px', margin: 0, background: '#f0f0f0', fontSize: 16 }}>
        Field Editor
      </h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr>
            <th style={headerStyle}>Name</th>
            <th style={headerStyle}>Column</th>
            <th style={headerStyle}>Visibility</th>
            <th style={headerStyle}>System Category</th>
            <th style={headerStyle}>Derivation</th>
          </tr>
        </thead>
        <tbody>
          {grouped.map(([entity, entityFields]) => (
            <EntityGroup
              key={entity}
              entity={entity}
              fields={entityFields}
              onVisChange={handleVisibilityChange}
              onFieldChange={onFieldChange}
            />
          ))}
        </tbody>
      </table>

      {warning && (
        <ImpactWarning
          itemName={warning.fieldName}
          message={warning.message}
          onConfirm={confirmDiscard}
          onCancel={() => setWarning(null)}
        />
      )}
    </div>
  );
}

function EntityGroup({ entity, fields, onVisChange, onFieldChange }) {
  return (
    <>
      <tr>
        <td
          colSpan={5}
          style={{
            padding: '8px 10px',
            background: '#e8ecf1',
            fontWeight: 700,
            fontSize: 13,
          }}
        >
          {entity}
        </td>
      </tr>
      {fields.map((f) => {
        const id = f.id || f.name;
        const vis = f.visibility || 'editable';
        return (
          <tr key={id}>
            <td style={{ ...cellStyle, color: visColors[vis] || '#333' }}>{f.name}</td>
            <td style={cellStyle}>{f.column || '—'}</td>
            <td style={cellStyle}>
              <select
                value={vis}
                onChange={(e) => onVisChange(f, e.target.value)}
                style={{
                  border: '1px solid #ccc',
                  borderRadius: 3,
                  padding: '2px 4px',
                  color: visColors[vis],
                  fontWeight: 600,
                }}
              >
                {VISIBILITIES.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </td>
            <td style={cellStyle}>
              {vis === 'system' ? (
                <select
                  value={f.systemCategory || ''}
                  onChange={(e) => onFieldChange(id, { systemCategory: e.target.value })}
                  style={{ border: '1px solid #ccc', borderRadius: 3, padding: '2px 4px' }}
                >
                  <option value="">—</option>
                  {SYSTEM_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              ) : (
                '—'
              )}
            </td>
            <td style={cellStyle}>
              {vis === 'system' ? (
                <input
                  type="text"
                  value={f.derivation || ''}
                  placeholder="derivation expression"
                  onChange={(e) => onFieldChange(id, { derivation: e.target.value })}
                  style={{
                    border: '1px solid #ccc',
                    borderRadius: 3,
                    padding: '2px 6px',
                    width: '100%',
                    boxSizing: 'border-box',
                  }}
                />
              ) : (
                '—'
              )}
            </td>
          </tr>
        );
      })}
    </>
  );
}
