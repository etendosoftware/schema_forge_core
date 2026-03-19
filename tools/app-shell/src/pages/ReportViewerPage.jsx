import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FileText, Printer, FileDown, FileSpreadsheet, Eye, Loader2, X, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/auth/AuthContext.jsx';

const FORMATS = [
  { id: 'preview', label: 'Preview', icon: Eye },
  { id: 'pdf', label: 'PDF', icon: FileDown },
  { id: 'xlsx', label: 'Excel', icon: FileSpreadsheet },
  { id: 'csv', label: 'CSV', icon: FileText },
];

function ReportCard({ report, onRun }) {
  return (
    <button
      onClick={() => onRun(report)}
      className="flex items-start gap-4 p-4 rounded-xl border border-border/50 bg-white hover:border-primary/30 hover:shadow-md transition-all text-left w-full"
    >
      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
        <FileText className="h-5 w-5 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-semibold text-foreground">{report.title?.en_US || report.id}</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          {report.type === 'grouped-listing' ? 'Grouped Report' : 'Listing Report'}
          {report.orientation === 'landscape' ? ' — Landscape' : ''}
        </p>
        <div className="flex gap-1 mt-2">
          {(report.outputs || []).map(o => (
            <span key={o} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground uppercase font-medium">{o}</span>
          ))}
        </div>
      </div>
    </button>
  );
}

function SearchInput({ selector, value, displayValue, onChange, multi }) {
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState([]);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState([]); // [{id, name}]
  const ref = useRef(null);

  useEffect(() => {
    if (!query || query.length < 2) { setOptions([]); return; }
    const t = setTimeout(() => {
      fetch(`/api/report-selectors/${selector}?q=${encodeURIComponent(query)}`)
        .then(r => r.json())
        .then(setOptions)
        .catch(() => setOptions([]));
    }, 300);
    return () => clearTimeout(t);
  }, [query, selector]);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const addItem = (item) => {
    if (multi) {
      const next = [...selected.filter(s => s.id !== item.id), item];
      setSelected(next);
      onChange(next.map(s => s.id).join(','), next.map(s => s.name).join(', '));
      setQuery('');
    } else {
      onChange(item.id, item.name);
      setQuery(item.name);
      setOpen(false);
    }
  };

  const removeItem = (id) => {
    const next = selected.filter(s => s.id !== id);
    setSelected(next);
    onChange(next.map(s => s.id).join(','), next.map(s => s.name).join(', '));
  };

  const selectedIds = new Set(selected.map(s => s.id));

  return (
    <div className="relative" ref={ref}>
      {multi && selected.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-1">
          {selected.map(s => (
            <span key={s.id} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-medium">
              {s.name}
              <button onClick={() => removeItem(s.id)} className="ml-0.5 hover:text-destructive">&times;</button>
            </span>
          ))}
        </div>
      )}
      <input
        type="text"
        value={multi ? query : (query || displayValue || '')}
        onChange={e => { setQuery(e.target.value); setOpen(true); if (!multi && !e.target.value) onChange('', ''); }}
        onFocus={() => { if (options.length) setOpen(true); }}
        placeholder="Search..."
        className="h-8 px-2 text-sm border border-border rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-primary/30 w-44"
      />
      {open && options.length > 0 && (
        <div className="absolute z-50 top-full left-0 mt-1 w-56 max-h-48 overflow-auto rounded-lg border bg-white shadow-lg py-1">
          {options.filter(o => !selectedIds.has(o.id)).map(o => (
            <button key={o.id} onClick={() => addItem(o)}
              className="w-full text-left px-3 py-1.5 text-sm hover:bg-muted/50 truncate">{o.name}</button>
          ))}
        </div>
      )}
    </div>
  );
}

function ReportParamsForm({ parameters, values, onChange, onSubmit, loading }) {
  if (!parameters || parameters.length === 0) return null;
  const [displayValues, setDisplayValues] = useState({});

  return (
    <div className="px-4 py-3 border-b border-border/30 bg-white shrink-0">
      <div className="flex items-end gap-3 flex-wrap">
        {parameters.map(p => {
          if (p.hidden) return null;
          const label = p.label?.en_US || p.name;

          // Search selector (BP, Product, Account, Org)
          if (p.type === 'search') {
            return (
              <div key={p.name} className="flex flex-col gap-1">
                <label className="text-xs font-medium text-muted-foreground">{label}</label>
                <SearchInput
                  selector={p.selector}
                  value={values[p.name] || ''}
                  displayValue={displayValues[p.name] || ''}
                  onChange={(id, name) => { onChange(p.name, id); onChange('_display_' + p.name, name); setDisplayValues(prev => ({ ...prev, [p.name]: name })); }}
                  multi={p.multi}
                />
              </div>
            );
          }

          // Select dropdown
          if (p.type === 'select') {
            return (
              <div key={p.name} className="flex flex-col gap-1">
                <label className="text-xs font-medium text-muted-foreground">{label}</label>
                <select
                  value={values[p.name] || ''}
                  onChange={e => onChange(p.name, e.target.value)}
                  className="h-8 px-2 text-sm border border-border rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-primary/30"
                >
                  <option value="">All</option>
                  {(p.options || []).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            );
          }

          // Standard inputs
          return (
            <div key={p.name} className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">{label}</label>
              <input
                type={p.type === 'date' ? 'date' : p.type === 'number' ? 'number' : 'text'}
                value={values[p.name] || ''}
                onChange={e => onChange(p.name, e.target.value)}
                className="h-8 px-2 text-sm border border-border rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-primary/30 w-36"
              />
            </div>
          );
        })}
        <button
          onClick={() => onSubmit(values)}
          disabled={loading}
          className="h-8 px-4 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          Run Report
        </button>
      </div>
    </div>
  );
}

function ReportViewer({ report, onBack, token }) {
  const iframeRef = useRef(null);
  const [activeFormat, setActiveFormat] = useState('preview');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [recordCount, setRecordCount] = useState(null);
  const previewHtmlRef = useRef('');
  const [params, setParams] = useState(() => {
    const defaults = {};
    for (const p of report.parameters || []) {
      if (p.default === '__TODAY__') {
        defaults[p.name] = new Date().toISOString().split('T')[0];
      } else {
        defaults[p.name] = p.default || '';
      }
    }
    return defaults;
  });

  const renderReport = useCallback(async (format) => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/reports/${report.id}/render`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ format, params }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(data.error || `Render failed: ${res.status}`);
      }

      if (format === 'html' || format === 'preview') {
        const html = await res.text();
        previewHtmlRef.current = html;
        // Count rows from the rendered HTML
        const rowMatch = html.match(/(\d+) records/);
        if (rowMatch) setRecordCount(parseInt(rowMatch[1], 10));

        const iframe = iframeRef.current;
        iframe.src = 'about:blank';
        iframe.onload = () => {
          try {
            const doc = iframe.contentDocument;
            doc.open();
            doc.write(html);
            doc.close();
          } catch { /* cross-origin */ }
          iframe.onload = null;
        };
        setActiveFormat('preview');
      } else if (format === 'pdf') {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        iframeRef.current.src = url;
        setActiveFormat('pdf');
      } else {
        // xlsx, csv — download
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${report.id}.${format}`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      setError(err.message);
    }

    setLoading(false);
  }, [report.id, token, params]);

  // Auto-render preview on mount (only once)
  const initialRender = useRef(false);
  useEffect(() => {
    if (!initialRender.current) {
      initialRender.current = true;
      renderReport('html');
    }
  }, []);

  const handleFormatClick = (fmt) => {
    if (fmt === 'preview') {
      if (previewHtmlRef.current) {
        const iframe = iframeRef.current;
        iframe.src = 'about:blank';
        iframe.onload = () => {
          try {
            const doc = iframe.contentDocument;
            doc.open();
            doc.write(previewHtmlRef.current);
            doc.close();
          } catch { /* */ }
          iframe.onload = null;
        };
        setActiveFormat('preview');
      } else {
        renderReport('html');
      }
    } else {
      renderReport(fmt);
    }
  };

  const handlePrint = () => {
    if (activeFormat === 'preview' && iframeRef.current?.contentDocument?.body?.innerHTML) {
      iframeRef.current.contentWindow.print();
    } else if (previewHtmlRef.current) {
      const w = window.open('', '_blank', 'width=1200,height=800');
      w.document.open();
      w.document.write(previewHtmlRef.current);
      w.document.close();
      w.onload = () => { w.print(); w.close(); };
    }
  };

  const title = report.title?.en_US || report.id;

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-6 py-3 bg-white border-b border-border/30 shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <h2 className="text-sm font-semibold">{title}</h2>
          {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          {recordCount != null && !loading && (
            <span className="text-xs text-muted-foreground">{recordCount} records</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {FORMATS.map(fmt => {
            const Icon = fmt.icon;
            const isActive = activeFormat === fmt.id;
            return (
              <button
                key={fmt.id}
                onClick={() => handleFormatClick(fmt.id)}
                disabled={loading}
                className={[
                  'inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium transition-colors',
                  isActive ? 'bg-primary text-primary-foreground' : 'bg-white border border-border text-foreground hover:bg-muted/50',
                  loading ? 'opacity-40' : '',
                ].join(' ')}
              >
                <Icon className="h-3.5 w-3.5" />
                {fmt.label}
              </button>
            );
          })}
          <div className="w-px h-6 bg-border/50 mx-1" />
          <button
            onClick={handlePrint}
            disabled={loading}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            <Printer className="h-3.5 w-3.5" />
            Print
          </button>
        </div>
      </div>

      <ReportParamsForm
        parameters={report.parameters}
        values={params}
        onChange={(name, value) => setParams(prev => ({ ...prev, [name]: value }))}
        onSubmit={() => renderReport(activeFormat === 'pdf' ? 'html' : activeFormat)}
        loading={loading}
      />

      {/* Preview */}
      <div className="flex-1 overflow-hidden bg-slate-100 p-4">
        <div className="bg-white rounded-lg shadow-lg h-full overflow-hidden relative">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10 gap-2 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Rendering report...</span>
            </div>
          )}
          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/90 z-10 text-destructive text-sm px-8 text-center">
              {error}
            </div>
          )}
          <iframe ref={iframeRef} title="Report" className="w-full h-full border-0" />
        </div>
      </div>
    </div>
  );
}

const CATEGORY_LABELS = {
  purchases: { en: 'Purchases', es: 'Compras' },
  finance: { en: 'Finance', es: 'Finanzas' },
  sales: { en: 'Sales', es: 'Ventas' },
  inventory: { en: 'Inventory', es: 'Inventario' },
  other: { en: 'Other', es: 'Otros' },
};

export default function ReportViewerPage() {
  const { token } = useAuth();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();
  const categoryFilter = searchParams.get('category');
  const reportId = searchParams.get('report');

  useEffect(() => {
    fetch('/api/reports')
      .then(r => r.json())
      .then(setReports)
      .catch(() => setReports([]))
      .finally(() => setLoading(false));
  }, []);

  const selectedReport = reportId ? reports.find(r => r.id === reportId) : null;

  const selectReport = (report) => {
    const params = new URLSearchParams(searchParams);
    params.set('report', report.id);
    setSearchParams(params);
  };

  const clearReport = () => {
    const params = new URLSearchParams(searchParams);
    params.delete('report');
    setSearchParams(params);
  };

  if (selectedReport) {
    return <ReportViewer report={selectedReport} onBack={clearReport} token={token} />;
  }

  // Group reports by category, optionally filtering
  const filtered = categoryFilter
    ? reports.filter(r => r.category === categoryFilter)
    : reports;

  const grouped = {};
  for (const r of filtered) {
    const cat = r.category || 'other';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(r);
  }

  const categoryTitle = categoryFilter && CATEGORY_LABELS[categoryFilter]
    ? CATEGORY_LABELS[categoryFilter].es
    : null;

  return (
    <div className="h-full flex flex-col">
      <div className="px-6 pt-6 pb-4">
        <h1 className="text-xl font-bold text-foreground">
          {categoryTitle ? `Informes — ${categoryTitle}` : 'Reports'}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Available reports — click to run with real data</p>
      </div>
      <div className="flex-1 overflow-auto px-6 pb-6">
        {loading ? (
          <div className="flex items-center justify-center h-32 gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading reports...
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center text-muted-foreground py-12">
            <FileText className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p>No reports found</p>
            <p className="text-xs mt-1">No reports configured yet</p>
          </div>
        ) : (
          <div className="space-y-6 max-w-2xl">
            {Object.entries(grouped).map(([cat, catReports]) => (
              <div key={cat}>
                {!categoryFilter && Object.keys(grouped).length > 1 && (
                  <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                    {CATEGORY_LABELS[cat]?.es || cat}
                  </h2>
                )}
                <div className="grid gap-3">
                  {catReports.map(r => (
                    <ReportCard key={r.id} report={r} onRun={selectReport} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
