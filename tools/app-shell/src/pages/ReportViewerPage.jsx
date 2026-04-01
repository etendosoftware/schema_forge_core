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

function SelectorPopup({ open, onClose, onSelect, selector, title }) {
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [focusIdx, setFocusIdx] = useState(-1);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) { setQuery(''); setOptions([]); setFocusIdx(-1); setTimeout(() => inputRef.current?.focus(), 50); }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    const t = setTimeout(() => {
      fetch(`/api/report-selectors/${selector}?q=${encodeURIComponent(query)}`)
        .then(r => r.json())
        .then(data => { setOptions(data); setFocusIdx(-1); })
        .catch(() => setOptions([]))
        .finally(() => setLoading(false));
    }, query ? 300 : 0);
    return () => clearTimeout(t);
  }, [query, selector, open]);

  const handleKey = (e) => {
    if (e.key === 'Escape') { onClose(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setFocusIdx(i => Math.min(i + 1, options.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setFocusIdx(i => Math.max(i - 1, 0)); }
    if (e.key === 'Enter' && focusIdx >= 0 && options[focusIdx]) { onSelect(options[focusIdx]); onClose(); }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onMouseDown={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-96 max-h-[480px] flex flex-col" onMouseDown={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/30">
          <span className="text-sm font-semibold">{title}</span>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
        <div className="px-4 py-2 border-b border-border/20">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Search..."
            className="w-full h-8 px-2 text-sm border border-border rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-primary/30"
          />
        </div>
        <div className="flex-1 overflow-auto py-1">
          {loading && <div className="flex justify-center py-6 text-muted-foreground text-xs">Loading...</div>}
          {!loading && options.length === 0 && (
            <div className="text-center py-6 text-muted-foreground text-xs">No results</div>
          )}
          {options.map((o, idx) => (
            <button
              key={o.id}
              onClick={() => { onSelect(o); onClose(); }}
              className={['w-full text-left px-4 py-2 text-sm truncate', idx === focusIdx ? 'bg-primary/10 text-primary' : 'hover:bg-muted/50'].join(' ')}
            >
              {o.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function ReportParamsForm({ parameters, values, onChange, onSubmit, loading }) {
  if (!parameters || parameters.length === 0) return null;
  const [displayValues, setDisplayValues] = useState({});
  const [popup, setPopup] = useState(null); // { name, selector, label }
  const [errors, setErrors] = useState({});

  const handleSubmit = () => {
    const missing = {};
    for (const p of parameters || []) {
      if (p.required && !values[p.name]) missing[p.name] = true;
    }
    if (Object.keys(missing).length > 0) { setErrors(missing); return; }
    setErrors({});
    onSubmit(values);
  };

  return (
    <div className="px-4 py-3 border-b border-border/30 bg-white shrink-0">
      {popup && (
        <SelectorPopup
          open
          onClose={() => setPopup(null)}
          selector={popup.selector}
          title={popup.label}
          onSelect={(item) => {
            onChange(popup.name, item.id);
            onChange('_display_' + popup.name, item.name);
            setDisplayValues(prev => ({ ...prev, [popup.name]: item.name }));
            setPopup(null);
          }}
        />
      )}
      <div className="flex items-end gap-3 flex-wrap">
        {parameters.map(p => {
          if (p.hidden) return null;
          const label = p.label?.en_US || p.name;

          const errCls = errors[p.name] ? 'border-destructive ring-1 ring-destructive/40' : 'border-border';

          // Search selector — popup modal
          if (p.type === 'search') {
            const display = displayValues[p.name] || '';
            return (
              <div key={p.name} className="flex flex-col gap-1">
                <label className="text-xs font-medium text-muted-foreground">{label}</label>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => { setPopup({ name: p.name, selector: p.selector, label }); setErrors(e => ({...e, [p.name]: false})); }}
                    className={`h-8 px-3 text-xs border rounded-md bg-white hover:bg-muted/50 text-left w-44 truncate text-muted-foreground ${errCls}`}
                  >
                    {display || <span className="opacity-50">Select...</span>}
                  </button>
                  {display && (
                    <button
                      type="button"
                      onClick={() => { onChange(p.name, ''); onChange('_display_' + p.name, ''); setDisplayValues(prev => ({ ...prev, [p.name]: '' })); }}
                      className="h-8 w-6 flex items-center justify-center text-muted-foreground hover:text-destructive"
                    ><X className="h-3.5 w-3.5" /></button>
                  )}
                </div>
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
                  onChange={e => { onChange(p.name, e.target.value); setErrors(er => ({...er, [p.name]: false})); }}
                  className={`h-8 px-2 text-sm border rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-primary/30 ${errCls}`}
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
                onChange={e => { onChange(p.name, e.target.value); setErrors(er => ({...er, [p.name]: false})); }}
                className={`h-8 px-2 text-sm border rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-primary/30 w-36 ${errCls}`}
              />
            </div>
          );
        })}
        <button
          onClick={handleSubmit}
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

  // No auto-render on mount — wait for user to click Run Report

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
          {!loading && !error && !previewHtmlRef.current && (
            <div className="absolute inset-0 overflow-hidden">
              {/* Skeleton table background */}
              <div className="p-6 opacity-30 pointer-events-none select-none blur-[2px]">
                <div className="h-4 w-48 bg-slate-200 rounded mb-6" />
                <div className="space-y-0">
                  <div className="grid grid-cols-6 gap-3 pb-2 border-b border-slate-200 mb-1">
                    {[40,15,15,15,15,15].map((w,i) => (
                      <div key={i} className="h-3 bg-slate-300 rounded" style={{width:`${w}%`}} />
                    ))}
                  </div>
                  {Array.from({length: 8}).map((_, r) => (
                    <div key={r} className="grid grid-cols-6 gap-3 py-2.5 border-b border-slate-100">
                      {[40,15,15,15,15,15].map((w,i) => (
                        <div key={i} className="h-3 rounded" style={{width:`${w}%`, background: r%2===0?'#e2e8f0':'#edf2f7'}} />
                      ))}
                    </div>
                  ))}
                </div>
              </div>
              {/* Centered message */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <p className="text-base font-semibold text-foreground mb-1">Your report is ready to go</p>
                  <p className="text-sm text-muted-foreground">Choose your filters above and hit <span className="font-medium text-foreground">Run Report</span></p>
                </div>
              </div>
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
