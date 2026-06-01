import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useUI } from '@etendosoftware/app-shell-core';
import { LayoutGrid, Settings2, ListFilter, ArrowUpDown } from 'lucide-react';
import { StatusPillMenu, ResultPill, EmptyState } from './FmCommon.jsx';
import { ConfigDrawer, NewDeclModal } from './FmOverlays.jsx';
import FmCatalogPage from './FmCatalogPage.jsx';
import { formatAmount, STATUS_COLOR, computeUpcomingDeadlines, checkModified303, checkModified349, compute349Operators } from './fiscalModelsUtils.js';
import useFiscalAutoCompute from './useFiscalAutoCompute.js';

// Real-mode only: throws on fetch failure instead of falling back to mock data.
async function computeBoxes303Real(decl, { token, apiBaseUrl } = {}) {
  if (!token || !apiBaseUrl) throw new Error('missing credentials');
  const base = apiBaseUrl.replace(/\/[^/]+$/, '');
  const params = new URLSearchParams({ year: decl.year, period: decl.period });
  const res = await fetch(`${base}/fiscal303/boxes?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`boxes fetch failed: ${res.status}`);
  return await res.json();
}

async function computeOperators349Real(decl, { token, apiBaseUrl } = {}) {
  return compute349Operators(decl, { token, apiBaseUrl });
}

function StatusSelect({ value, options, onChange }) {
  const t = useUI();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const handler = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);
  const label = value === 'all'
    ? `${t('fm.filter.all')} · ${t('fm.col.status')}`
    : t(`fm.status.${value}`) ?? value;
  const active = value !== 'all';
  return (
    <div className="fm-status-select" ref={ref}>
      <button
        className={`fm-toolbar__pill fm-status-select__trigger${active ? ' fm-toolbar__pill--active-dark' : ''}`}
        onClick={() => setOpen(o => !o)}
        aria-haspopup="listbox"
      >
        {active && <span className={`fm-status-dot fm-status-dot--${STATUS_COLOR[value]}`} />}
        {label}
        <span className="fm-status-select__caret" aria-hidden="true">▾</span>
      </button>
      {open && (
        <div className="fm-status-select__menu" role="listbox">
          <button
            className={`fm-status-select__item${value === 'all' ? ' fm-status-select__item--active' : ''}`}
            role="option" aria-selected={value === 'all'}
            onClick={() => { onChange('all'); setOpen(false); }}
          >
            {t('fm.filter.all')} · {t('fm.col.status')}
          </button>
          {options.map(s => (
            <button
              key={s}
              className={`fm-status-select__item${value === s ? ' fm-status-select__item--active' : ''}`}
              role="option" aria-selected={value === s}
              onClick={() => { onChange(s); setOpen(false); }}
            >
              <span className={`fm-status-dot fm-status-dot--${STATUS_COLOR[s]}`} />
              {t(`fm.status.${s}`) ?? s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}


const DEFAULT_ACTIVE = { '303': true, '349': true };

function normDecl(d) {
  return {
    ...d,
    updatedAt: d.updatedAt ? new Date(d.updatedAt).toLocaleDateString('es-ES') : '—',
    result: d.result ?? null,
    incidents: d.incidents ?? { blocking: 0, warning: 0 },
  };
}

// ── Upcoming deadlines helpers ───────────────────────────────────
const MONTH_NAMES_ES = ['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE'];
const MONTH_LABELS_ES = ['', 'Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

function formatDeadlineHeader(date) {
  return `${date.getDate()} ${MONTH_NAMES_ES[date.getMonth()]}`;
}

function formatPeriodLabel(period) {
  if (/^T\d$/.test(period)) return `T${period[1]}`;
  if (/^\d{2}$/.test(period)) return MONTH_LABELS_ES[parseInt(period, 10)] ?? period;
  return period;
}

function UpcomingDeadlines({ decls, onSelect, t }) {
  const items = computeUpcomingDeadlines(decls);
  const groups = [];
  const seen = {};
  for (const item of items) {
    const key = item.deadline.toISOString().slice(0, 10);
    if (!seen[key]) { seen[key] = []; groups.push({ key, date: item.deadline, items: seen[key] }); }
    seen[key].push(item);
  }
  return (
    <div className="fm-upcoming">
      <div className="fm-upcoming__header">{t('fm.upcoming.title')}</div>
      {groups.length === 0
        ? <div className="fm-upcoming__empty">{t('fm.upcoming.empty')}</div>
        : groups.map(g => (
          <div key={g.key} className="fm-upcoming__group">
            <div className="fm-upcoming__date-label">{formatDeadlineHeader(g.date)}</div>
            {g.items.map(({ decl }) => (
              <div key={decl.id} className="fm-upcoming__row" onClick={() => onSelect?.(decl)}>
                <div className={`fm-upcoming__badge fm-upcoming__badge--${decl.model}`}>
                  <span className="fm-upcoming__badge-label">Modelo</span>
                  <span className="fm-upcoming__badge-num">{decl.model}</span>
                </div>
                <div className="fm-upcoming__info">
                  <div className="fm-upcoming__model-label">{t(`fm.catalog.${decl.model}.name`) ?? `Modelo ${decl.model}`}</div>
                  <div className="fm-upcoming__meta">
                    <span className="fm-upcoming__period">{formatPeriodLabel(decl.period)}</span>
                    <span className={`fm-upcoming__status fm-upcoming__status--${STATUS_COLOR[decl.status]}`}>
                      {t(`fm.status.${decl.status}`) ?? decl.status}
                    </span>
                  </div>
                </div>
                <span className="fm-upcoming__arrow">›</span>
              </div>
            ))}
          </div>
        ))
      }
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────
function ModelBadge({ model }) {
  return <span className={`fm-model-badge fm-model-badge--${model}`}>{model}</span>;
}

function FileCell({ file, fileExternal }) {
  if (!file && !fileExternal) return <span className="fm-file fm-file--none">—</span>;
  if (fileExternal) return <span className="fm-file fm-file--external">↗ Externa</span>;
  return <span className="fm-file">▣ {file}</span>;
}

function IncidentsCell({ blocking, warning, t }) {
  if (!blocking && !warning) return <span className="fm-incidents-ok">{t('fm.incidents.none')}</span>;
  return (
    <span style={{ display: 'inline-flex', gap: 4 }}>
      {blocking > 0 && <span className="fm-incidents-warn"><span className="fm-incidents-warn__dot">!</span>{blocking}</span>}
      {warning  > 0 && <span className="fm-incidents-warn" style={{ color: '#d97706' }}><span className="fm-incidents-warn__dot" style={{ background: '#fef3c7', borderColor: '#fcd34d', color: '#d97706' }}>!</span>{warning}</span>}
    </span>
  );
}

function ResultCell({ isComputing, error, result, t }) {
  if (isComputing) return <span style={{ color: '#6b7280', fontSize: 12 }}>…</span>;
  if (error) {
    return (
      <span className="fm-status-pill fm-status-pill--red" title={error} style={{ fontSize: 11 }}>
        {t('fm.status.error')}
      </span>
    );
  }
  if (!result?.kind) return <span style={{ color: '#9ca3af' }}>—</span>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
      <ResultPill kind={result.kind} label={t(`fm.result.${result.kind}`) ?? result.kind} />
      {result.kind !== 'N' && result.amount != null && (
        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12 }}>
          {formatAmount(result.amount)}
        </span>
      )}
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────
export default function FmListPage({ declarations: propDecls, onSelect, onStatusChange, token, apiBaseUrl }) {
  const ui = useUI();
  const t  = ui;

  const [decls, setDecls] = useState(propDecls ?? []);

  useEffect(() => {
    if (!token || !apiBaseUrl) return;
    const base = apiBaseUrl.replace(/\/[^/]+$/, '');
    fetch(`${base}/fiscal303/declarations`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(data => setDecls((Array.isArray(data) ? data : (data?.data ?? [])).map(normDecl)))
      .catch(() => {});
  }, [token, apiBaseUrl]);

  const draftDecls303 = useMemo(
    () => decls.filter(d => d.model === '303' && d.status === 'draft'),
    [decls]
  );

  const draftDecls349 = useMemo(
    () => decls.filter(d => d.model === '349' && d.status === 'draft'),
    [decls]
  );

  const { computedMap } = useFiscalAutoCompute(draftDecls303, {
    computeFn:       computeBoxes303Real,
    checkModifiedFn: checkModified303,
    token,
    apiBaseUrl,
    pollIntervalMs:  180_000,
  });

  const { computedMap: computedMap349 } = useFiscalAutoCompute(draftDecls349, {
    computeFn:       computeOperators349Real,
    checkModifiedFn: checkModified349,
    token,
    apiBaseUrl,
    pollIntervalMs:  180_000,
  });

  const [modelFilter, setModelFilter]   = useState('all');
  const [yearFilter,  setYearFilter]    = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [activeModels, setActiveModels] = useState(DEFAULT_ACTIVE);
  const [showCatalog,  setShowCatalog]  = useState(false);
  const [showConfig,   setShowConfig]   = useState(false);
  const [showNewDecl,  setShowNewDecl]  = useState(false);
  const [selected,     setSelected]     = useState(new Set());

  const handleStatusChange = useCallback((id, newStatus) => {
    if (token && apiBaseUrl) {
      const base = apiBaseUrl.replace(/\/[^/]+$/, '');
      fetch(`${base}/fiscal303/declarations?id=${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
        .then(r => {
          if (!r.ok) throw new Error(r.status);
          setDecls(ds =>
            ds.map(d => d.id === id
              ? { ...d, status: newStatus, updatedAt: new Date().toLocaleDateString('es-ES') }
              : d)
          );
          onStatusChange?.(id, newStatus);
        })
        .catch(() => {});
    }
  }, [onStatusChange, token, apiBaseUrl]);

  const handleNewDecl = useCallback(({ model, year, period, status }) => {
    if (token && apiBaseUrl) {
      const base = apiBaseUrl.replace(/\/[^/]+$/, '');
      fetch(`${base}/fiscal303/declarations`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, year: parseInt(year, 10), period, status }),
      })
        .then(r => r.ok ? r.json() : Promise.reject(r.status))
        .then(created => setDecls(ds => [normDecl(created?.data ?? created), ...ds]))
        .catch(() => {});
    }
  }, [token, apiBaseUrl]);

  const years = ['all', ...Array.from(new Set(decls.map(d => String(d.year)))).sort((a,b) => b - a)];
  const statuses = ['all', ...Array.from(new Set(decls.map(d => d.status)))];

  const modelYearFiltered = decls.filter(d =>
    (modelFilter === 'all' || d.model === modelFilter) &&
    (yearFilter  === 'all' || String(d.year) === yearFilter)
  );

  const filtered = modelYearFiltered.filter(d =>
    statusFilter === 'all' || d.status === statusFilter
  );

  const activeCount = Object.values(activeModels).filter(Boolean).length;

  const toggleSelect = (id) => setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const allSelected = filtered.length > 0 && filtered.every(d => selected.has(d.id));
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(filtered.map(d => d.id)));

  return (
    <div className="fm-page">

      {/* ── Toolbar ──────────────────────────────────────────────── */}
      <div className="fm-toolbar">
        {/* Year pills */}
        {years.map(y => (
          <button key={y} className={`fm-toolbar__pill${yearFilter === y ? ' fm-toolbar__pill--active-dark' : ''}`} onClick={() => setYearFilter(y)}>
            {y === 'all' ? t('fm.filter.all') : y}
          </button>
        ))}

        <div className="fm-toolbar__sep" />

        {/* Model pills */}
        {['all','303','349'].map(f => (
          <button key={f} className={`fm-toolbar__pill${modelFilter === f ? ' fm-toolbar__pill--active-blue' : ''}`} onClick={() => setModelFilter(f)}>
            {f === 'all' ? t('fm.filter.all') : `${t('fm.filter.model_prefix')} ${f}`}
          </button>
        ))}

        {/* Status dropdown */}
        <StatusSelect
          value={statusFilter}
          options={statuses.filter(s => s !== 'all')}
          onChange={setStatusFilter}
        />

        <div className="fm-toolbar__space" />

        {/* Catalog */}
        <button className="fm-toolbar__btn" onClick={() => setShowCatalog(true)}>
          <LayoutGrid size={14} strokeWidth={1.75} />
          {t('fm.catalog.title')}
          <span className="fm-toolbar__count-badge">{activeCount}</span>
          {activeCount > 0 && <span className="fm-toolbar__active-dot" />}
        </button>

        {/* Config */}
        <button className="fm-toolbar__btn" onClick={() => setShowConfig(true)}>
          <Settings2 size={14} strokeWidth={1.75} />
          {t('fm.config.title')}
        </button>

        {/* New declaration */}
        <button className="fm-toolbar__btn fm-toolbar__btn--primary" onClick={() => setShowNewDecl(true)}>
          + {t('fm.action.create')}
        </button>
      </div>

      {/* ── Body: sidebar + main ─────────────────────────────────── */}
      <div className="fm-list-body">

        <UpcomingDeadlines
          decls={modelYearFiltered}
          onSelect={decl => {
            const precomputed = decl.model === '349' ? computedMap349[decl.id] : computedMap[decl.id];
            onSelect?.({ ...decl, _precomputed: precomputed });
          }}
          t={t}
        />

        <div className="fm-list-main">
          {/* ── Section header ─────────────────────────────────── */}
          <div className="fm-section-header">
            <span className="fm-section-header__title">{t('fm.list.title')}</span>
            <span className="fm-section-header__count">{filtered.length} {t('fm.list.count')}</span>
            <div className="fm-section-header__actions">
              <button className="fm-section-header__icon-btn" title={t('fm.action.filter')} aria-label={t('fm.action.filter')}><ListFilter size={14} strokeWidth={1.75} /></button>
              <button className="fm-section-header__icon-btn" title={t('fm.action.sort')} aria-label={t('fm.action.sort')}><ArrowUpDown size={14} strokeWidth={1.75} /></button>
            </div>
          </div>

          {/* ── Table ──────────────────────────────────────────── */}
          <div className="fm-table-wrap">
        {filtered.length === 0
          ? <EmptyState />
          : (
            <table className="fm-table">
              <thead>
                <tr>
                  <th style={{ width: 32 }}>
                    <input type="checkbox" className="fm-table__cb" checked={allSelected} onChange={toggleAll} />
                  </th>
                  <th>{t('fm.col.model')}</th>
                  <th>{t('fm.col.period')}</th>
                  <th>{t('fm.col.type')}</th>
                  <th style={{ minWidth: 180 }}>{t('fm.col.status')}</th>
                  <th style={{ textAlign: 'right' }}>{t('fm.col.result')}</th>
                  <th>{t('fm.col.incidents')}</th>
                  <th>{t('fm.col.file')}</th>
                  <th>{t('fm.col.updated_at')}</th>
                  <th>{t('fm.col.action')}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(decl => {
                  const computed = decl.model === '349' ? computedMap349[decl.id] : computedMap[decl.id];
                  const isComputingThis = (decl.model === '303' || decl.model === '349')
                    && decl.status === 'draft' && !computed;
                  const computeError = computed?.error ?? null;

                  let displayResult = decl.result;
                  if (computed?.summary && !computed.error) {
                    const r = computed.summary.result;
                    let kind;
                    if (r > 0) kind = 'I';
                    else if (r < 0) kind = 'C';
                    else kind = 'N';
                    displayResult = { kind, amount: Math.abs(r) };
                  }

                  return (
                  <tr
                    key={decl.id}
                    className={decl.current ? 'fm-table__row--current' : ''}
                    onClick={() => onSelect?.({ ...decl, _precomputed: computed })}
                  >
                    <td onClick={e => e.stopPropagation()}>
                      <input type="checkbox" className="fm-table__cb" checked={selected.has(decl.id)} onChange={() => toggleSelect(decl.id)} />
                    </td>
                    <td>
                      <ModelBadge model={decl.model} />
                      <span className="fm-model-year">{decl.year}</span>
                    </td>
                    <td><span className="fm-period">{decl.period}</span></td>
                    <td>{decl.type === 'ord' ? t('fm.type.ordinary') : t('fm.type.complementary')}</td>
                    <td onClick={e => e.stopPropagation()}>
                      <StatusPillMenu status={decl.status} onStatusChange={s => handleStatusChange(decl.id, s)} />
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <ResultCell isComputing={isComputingThis} error={computeError} result={displayResult} t={t} />
                    </td>
                    <td>
                      <IncidentsCell blocking={decl.incidents?.blocking ?? 0} warning={decl.incidents?.warning ?? 0} t={t} />
                    </td>
                    <td><FileCell file={decl.file} fileExternal={decl.fileExternal} /></td>
                    <td><span className="fm-date">{decl.updatedAt ?? '—'}</span></td>
                    <td onClick={e => e.stopPropagation()}>
                      <button className="fm-table-action" onClick={() => onSelect?.({ ...decl, _precomputed: computed })}>
                        {t('fm.action.open')} ›
                      </button>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>{/* fm-table-wrap */}
        </div>{/* fm-list-main */}

      </div>{/* fm-list-body */}

      {/* ── Overlays ─────────────────────────────────────────────── */}
      {showConfig  && <ConfigDrawer onClose={() => setShowConfig(false)} token={token} apiBaseUrl={apiBaseUrl} />}
      {showNewDecl && <NewDeclModal onConfirm={handleNewDecl} onClose={() => setShowNewDecl(false)} />}

      {/* ── Catalog drawer (slides from right) ───────────────────── */}
      {showCatalog && (
        <>
          <div className="fm-catalog-overlay" onClick={() => setShowCatalog(false)} />
          <div className="fm-catalog-drawer">
            <FmCatalogPage
              activeModels={activeModels}
              onBack={() => setShowCatalog(false)}
              onSave={(newActive) => { setActiveModels(newActive); setShowCatalog(false); }}
              token={token}
              apiBaseUrl={apiBaseUrl}
            />
          </div>
        </>
      )}
    </div>
  );
}
