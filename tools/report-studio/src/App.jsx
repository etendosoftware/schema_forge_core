import { useState, useEffect, useCallback } from 'react';
import ArtifactSelector from './components/ArtifactSelector.jsx';
import ContractEditor from './components/ContractEditor.jsx';
import AvailableFields from './components/AvailableFields.jsx';
import FilterPanel from './components/FilterPanel.jsx';
import ReportViewer from './components/ReportViewer.jsx';

const JSREPORT_URL = '/api/report';

export default function App() {
  const [artifacts, setArtifacts] = useState([]);
  const [selectedArtifact, setSelectedArtifact] = useState(null);
  const [contract, setContract] = useState(null);
  const [schema, setSchema] = useState(null);
  const [mockData, setMockData] = useState([]);
  const [previewHtml, setPreviewHtml] = useState('');
  const [locale, setLocale] = useState('en_US');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Scan artifacts directory for reports
  useEffect(() => {
    fetch('/api/artifacts')
      .then(r => r.json())
      .then(setArtifacts)
      .catch(() => setArtifacts([]));
  }, []);

  // Load artifact data when selected
  useEffect(() => {
    if (!selectedArtifact) return;
    Promise.all([
      fetch(`/api/artifacts/${selectedArtifact}/report-contract.json`).then(r => r.ok ? r.json() : null),
      fetch(`/api/artifacts/${selectedArtifact}/schema-curated.json`).then(r => r.ok ? r.json() : null),
      fetch(`/api/artifacts/${selectedArtifact}/reports/listing/mockData.json`).then(r => r.ok ? r.json() : []),
    ]).then(([c, s, m]) => {
      setContract(c);
      setSchema(s);
      setMockData(m);
      setError(null);
    }).catch(err => setError(err.message));
  }, [selectedArtifact]);

  const renderPreview = useCallback(async () => {
    if (!contract) return;
    setLoading(true);
    setError(null);
    try {
      // Load template and CSS
      const [templateRes, cssRes, overrideCssRes, helpersRes] = await Promise.all([
        fetch(`/api/artifacts/${selectedArtifact}/reports/listing/template.hbs`),
        fetch('/api/templates/reports/base.css'),
        fetch(`/api/artifacts/${selectedArtifact}/reports/listing/style.css`).catch(() => ({ ok: false })),
        fetch('/api/templates/reports/helpers/jsreport-helpers.js'),
      ]);

      const templateContent = templateRes.ok ? await templateRes.text() : '';
      const baseCss = cssRes.ok ? await cssRes.text() : '';
      const overrideCss = overrideCssRes.ok ? await overrideCssRes.text() : '';
      const helpersCode = helpersRes.ok ? await helpersRes.text() : '';
      const css = [baseCss, overrideCss].filter(Boolean).join('\n');

      // Resolve i18n
      const resolveLabel = (obj) => {
        if (typeof obj === 'string') return obj;
        return obj?.[locale] ?? obj?.en_US ?? Object.values(obj ?? {})[0] ?? '';
      };

      const columns = (contract.columns ?? []).map(col => ({
        key: col.field,
        label: resolveLabel(col.label),
        type: col.type,
        width: col.width,
      }));

      const payload = {
        template: {
          content: templateContent,
          engine: 'handlebars',
          recipe: 'html',
          helpers: helpersCode,
        },
        data: {
          css,
          meta: {
            title: resolveLabel(contract.title),
            generatedAt: new Date().toISOString(),
            locale,
            filters: [],
            truncated: false,
          },
          columns,
          rows: mockData,
          summary: {
            totalRows: contract.summary?.totalRows ? mockData.length : undefined,
          },
        },
      };

      const res = await fetch(JSREPORT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`jsreport error: ${errText.slice(0, 200)}`);
      }

      const html = await res.text();
      setPreviewHtml(html);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [contract, selectedArtifact, mockData, locale]);

  // Auto-render on contract/data/locale change
  useEffect(() => {
    if (contract && selectedArtifact) {
      renderPreview();
    }
  }, [contract, selectedArtifact, locale, renderPreview]);

  const handleContractChange = (newContract) => {
    setContract(newContract);
  };

  const handleAddField = (field) => {
    if (!contract) return;
    const updated = {
      ...contract,
      columns: [
        ...contract.columns,
        {
          field: field.name,
          label: { en_US: field.name, es_ES: field.name },
          type: field.type,
          width: 'auto',
        },
      ],
    };
    setContract(updated);
  };

  const handleRemoveColumn = (fieldName) => {
    if (!contract) return;
    setContract({
      ...contract,
      columns: contract.columns.filter(c => c.field !== fieldName),
    });
  };

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <header className="bg-slate-900 text-white px-4 py-2 flex items-center gap-4 shrink-0">
        <h1 className="text-sm font-semibold tracking-wide">Report Studio</h1>
        <ArtifactSelector
          artifacts={artifacts}
          selected={selectedArtifact}
          onChange={setSelectedArtifact}
        />
        <div className="flex items-center gap-2 ml-auto">
          <select
            value={locale}
            onChange={e => setLocale(e.target.value)}
            className="bg-slate-800 text-white text-xs px-2 py-1 rounded border border-slate-700"
          >
            <option value="en_US">English</option>
            <option value="es_ES">Spanish</option>
          </select>
          <button
            onClick={renderPreview}
            disabled={loading || !contract}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs px-3 py-1 rounded font-medium"
          >
            {loading ? 'Rendering...' : 'Refresh'}
          </button>
        </div>
      </header>

      {/* Error bar */}
      {error && (
        <div className="bg-red-50 border-b border-red-200 px-4 py-2 text-red-700 text-xs">
          {error}
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left panel */}
        <div className="w-96 border-r border-slate-200 bg-white overflow-y-auto flex flex-col">
          {contract ? (
            <>
              <ContractEditor
                contract={contract}
                onChange={handleContractChange}
                onRemoveColumn={handleRemoveColumn}
              />
              {schema && (
                <AvailableFields
                  schema={schema}
                  contract={contract}
                  onAdd={handleAddField}
                />
              )}
              <FilterPanel
                filters={contract.filters ?? []}
                locale={locale}
              />
            </>
          ) : (
            <div className="p-4 text-slate-400 text-sm">
              {selectedArtifact
                ? 'No report-contract.json found. Run sf-report-contract first.'
                : 'Select an artifact to begin.'}
            </div>
          )}
        </div>

        {/* Right panel — Preview */}
        <div className="flex-1 bg-slate-100">
          <ReportViewer html={previewHtml} loading={loading} />
        </div>
      </div>
    </div>
  );
}
