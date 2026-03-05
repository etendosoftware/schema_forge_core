import React, { useState, useCallback } from 'react';

const styles = {
  container: { fontFamily: 'system-ui, sans-serif', maxWidth: 1200, margin: '0 auto', padding: 24 },
  header: { borderBottom: '2px solid #333', paddingBottom: 12, marginBottom: 24 },
  title: { fontSize: 24, fontWeight: 700, margin: 0 },
  subtitle: { color: '#666', marginTop: 4 },
  columns: { display: 'flex', gap: 24 },
  panel: { flex: 1, border: '1px solid #ddd', borderRadius: 8, padding: 16, minHeight: 400 },
  panelTitle: { fontSize: 16, fontWeight: 600, marginBottom: 12 },
  textarea: { width: '100%', minHeight: 300, fontFamily: 'monospace', fontSize: 13, padding: 8, border: '1px solid #ccc', borderRadius: 4, resize: 'vertical', boxSizing: 'border-box' },
  button: { padding: '8px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', marginTop: 8, marginRight: 8 },
  buttonSecondary: { padding: '8px 16px', background: '#6b7280', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', marginTop: 8 },
  preview: { border: '1px solid #e5e7eb', borderRadius: 4, padding: 16, minHeight: 200, background: '#fafafa' },
  error: { color: '#dc2626', fontFamily: 'monospace', fontSize: 13, whiteSpace: 'pre-wrap' },
  fileInput: { marginBottom: 12 },
  mockPanel: { marginTop: 16, padding: 12, background: '#f0f9ff', borderRadius: 4, border: '1px solid #bae6fd' },
  mockTitle: { fontWeight: 600, marginBottom: 8, fontSize: 14 }
};

function generateMockData(schemaText) {
  try {
    const schema = JSON.parse(schemaText);
    const mockData = {};
    for (const entity of (schema.entities || [])) {
      const record = {};
      for (const field of (entity.fields || [])) {
        if (field.visibility === 'system' || field.visibility === 'discarded') continue;
        switch (field.type) {
          case 'string': record[field.name] = `Sample ${field.label || field.name}`; break;
          case 'number': case 'integer': record[field.name] = 42; break;
          case 'boolean': record[field.name] = true; break;
          case 'date': record[field.name] = '2026-01-15'; break;
          case 'id': record[field.name] = 'abc-123'; break;
          default: record[field.name] = `(${field.type})`;
        }
      }
      mockData[entity.name] = [record];
    }
    return JSON.stringify(mockData, null, 2);
  } catch {
    return '// Paste a valid schema JSON to generate mock data';
  }
}

export default function App() {
  const [source, setSource] = useState('// Paste or load a generated JSX component here\nexport default function Preview() {\n  return <div>Hello from Schema Forge</div>;\n}');
  const [schemaText, setSchemaText] = useState('{"entities":[]}');
  const [rendered, setRendered] = useState(null);
  const [error, setError] = useState(null);

  const handleFileLoad = useCallback((e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setSource(ev.target.result);
    reader.readAsText(file);
  }, []);

  const handleSchemaLoad = useCallback((e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setSchemaText(ev.target.result);
    reader.readAsText(file);
  }, []);

  const handlePreview = useCallback(() => {
    setError(null);
    setRendered(null);
    try {
      // Strip import/export and convert to plain function
      let code = source
        .replace(/^import\s+.*$/gm, '')
        .replace(/^export\s+default\s+/m, 'return ')
        .replace(/^export\s+/gm, '');

      // Wrap in a function that receives React
      const factory = new Function('React', 'useState', 'useEffect', 'useCallback', 'useMemo', code);
      const Component = factory(React, React.useState, React.useEffect, React.useCallback, React.useMemo);

      if (typeof Component !== 'function') {
        setError('Component must be a function. Make sure source has a default export.');
        return;
      }

      setRendered(React.createElement(Component));
    } catch (err) {
      setError(err.message);
    }
  }, [source]);

  const mockData = generateMockData(schemaText);

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Schema Forge UI Preview</h1>
        <p style={styles.subtitle}>Load generated React components and preview them with mock data</p>
      </div>

      <div style={styles.columns}>
        <div style={styles.panel}>
          <div style={styles.panelTitle}>Component Source</div>
          <div style={styles.fileInput}>
            <label>Load JSX file: </label>
            <input type="file" accept=".jsx,.js,.tsx" onChange={handleFileLoad} />
          </div>
          <textarea
            style={styles.textarea}
            value={source}
            onChange={(e) => setSource(e.target.value)}
            spellCheck={false}
          />
          <button style={styles.button} onClick={handlePreview}>Preview</button>
        </div>

        <div style={styles.panel}>
          <div style={styles.panelTitle}>Preview</div>
          <div style={styles.preview}>
            {error && <div style={styles.error}>{error}</div>}
            {rendered}
            {!error && !rendered && <span style={{ color: '#999' }}>Click "Preview" to render the component</span>}
          </div>

          <div style={styles.mockPanel}>
            <div style={styles.mockTitle}>Mock Data (from schema)</div>
            <div style={styles.fileInput}>
              <label>Load schema JSON: </label>
              <input type="file" accept=".json" onChange={handleSchemaLoad} />
            </div>
            <pre style={{ fontSize: 12, maxHeight: 200, overflow: 'auto', margin: 0 }}>{mockData}</pre>
          </div>
        </div>
      </div>
    </div>
  );
}
