import { useState, useCallback, useRef } from 'react';
import FieldEditor from './components/FieldEditor.jsx';
import RuleCatalog from './components/RuleCatalog.jsx';

// Default impact messages — overwritten if core-maps file is loaded
const DEFAULT_IMPACT = {
  accounting: 'Removing this field will prevent accounting entries from being generated.',
  inventory: 'Removing this field will prevent inventory movements and stock reservations.',
  costing: 'Removing this field will break cost calculations.',
  audit: 'This field is required for audit trail compliance.',
  tax: 'Removing this field will prevent tax calculations.',
  integration: 'This field is used by external integrations.',
  internal: 'This is an internal system field required for Etendo platform operations.',
};

const containerStyle = {
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  height: '100vh',
  display: 'flex',
  flexDirection: 'column',
};

const toolbarStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '10px 16px',
  background: '#2c3e50',
  color: '#ecf0f1',
  flexShrink: 0,
};

const btnStyle = {
  padding: '6px 14px',
  border: 'none',
  borderRadius: 4,
  cursor: 'pointer',
  fontWeight: 600,
  fontSize: 13,
};

function readJsonFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        resolve(JSON.parse(reader.result));
      } catch (e) {
        reject(new Error(`Invalid JSON in ${file.name}`));
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

function downloadJson(obj, filename) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function App() {
  const [fields, setFields] = useState([]);
  const [rules, setRules] = useState([]);
  const [impactMessages, setImpactMessages] = useState(DEFAULT_IMPACT);
  const [decisionsLog, setDecisionsLog] = useState([]);
  const [loaded, setLoaded] = useState(false);

  const schemaInputRef = useRef(null);
  const rulesInputRef = useRef(null);

  // Try loading impact-messages from core-maps (relative path in dev)
  useState(() => {
    fetch('../../core-maps/impact-messages.json')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setImpactMessages(data);
      })
      .catch(() => {
        // Fallback to defaults — already set
      });
  });

  const loadSchema = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const data = await readJsonFile(file);
      // Normalize: accept { entities: [...] } or flat array
      const fieldList = Array.isArray(data)
        ? data
        : Array.isArray(data.fields)
          ? data.fields
          : Array.isArray(data.entities)
            ? data.entities.flatMap((ent) =>
                (ent.fields || []).map((f) => ({ ...f, entity: ent.name || ent.entity }))
              )
            : [];
      setFields(fieldList);
      setLoaded(true);
    } catch (err) {
      alert(err.message);
    }
  };

  const loadRules = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const data = await readJsonFile(file);
      const ruleList = Array.isArray(data) ? data : Array.isArray(data.rules) ? data.rules : [];
      setRules(ruleList);
      setLoaded(true);
    } catch (err) {
      alert(err.message);
    }
  };

  const logChange = useCallback((type, id, changes) => {
    setDecisionsLog((prev) => [
      ...prev,
      { timestamp: new Date().toISOString(), type, id, changes },
    ]);
  }, []);

  const handleFieldChange = useCallback(
    (fieldId, changes) => {
      setFields((prev) =>
        prev.map((f) => {
          const id = f.id || f.name;
          return id === fieldId ? { ...f, ...changes } : f;
        })
      );
      logChange('field', fieldId, changes);
    },
    [logChange]
  );

  const handleRuleChange = useCallback(
    (ruleId, changes) => {
      setRules((prev) =>
        prev.map((r) => {
          const id = r.id || r.name;
          return id === ruleId ? { ...r, ...changes } : r;
        })
      );
      logChange('rule', ruleId, changes);
    },
    [logChange]
  );

  const handleSave = () => {
    downloadJson(fields, 'schema-curated.json');
    downloadJson(rules, 'rules-curated.json');
    downloadJson(decisionsLog, 'decisions-log.json');
  };

  return (
    <div style={containerStyle}>
      {/* Toolbar */}
      <div style={toolbarStyle}>
        <strong style={{ fontSize: 15 }}>Schema Forge — Decision Panel</strong>
        <span style={{ flex: 1 }} />

        <label style={{ ...btnStyle, background: '#3498db', color: '#fff' }}>
          Load Schema
          <input
            ref={schemaInputRef}
            type="file"
            accept=".json"
            style={{ display: 'none' }}
            onChange={loadSchema}
          />
        </label>

        <label style={{ ...btnStyle, background: '#3498db', color: '#fff' }}>
          Load Rules
          <input
            ref={rulesInputRef}
            type="file"
            accept=".json"
            style={{ display: 'none' }}
            onChange={loadRules}
          />
        </label>

        <button
          style={{ ...btnStyle, background: '#27ae60', color: '#fff' }}
          onClick={handleSave}
          disabled={!loaded}
        >
          Save Curated
        </button>

        <span style={{ fontSize: 12, color: '#bdc3c7' }}>
          {fields.length} fields | {rules.length} rules | {decisionsLog.length} changes
        </span>
      </div>

      {/* Panels */}
      {loaded ? (
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          <FieldEditor
            fields={fields}
            impactMessages={impactMessages}
            onFieldChange={handleFieldChange}
          />
          <RuleCatalog
            rules={rules}
            impactMessages={impactMessages}
            onRuleChange={handleRuleChange}
          />
        </div>
      ) : (
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#7f8c8d',
            fontSize: 18,
          }}
        >
          Load a schema or rules JSON file to get started.
        </div>
      )}
    </div>
  );
}
