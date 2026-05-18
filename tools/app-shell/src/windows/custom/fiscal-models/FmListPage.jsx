import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useUI } from '@/i18n';
import { LayoutGrid, Settings2, ListFilter, ArrowUpDown } from 'lucide-react';
import { StatusPillMenu, EmptyState } from './FmCommon.jsx';
import { ConfigDrawer, NewDeclModal } from './FmOverlays.jsx';
import FmCatalogPage from './FmCatalogPage.jsx';
import { formatAmount, STATUS_COLOR, STATUS_ORDER, computeUpcomingDeadlines } from './fiscalModelsUtils.js';

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

const MOCK_DECLARATIONS = [
  { id:'349-2025-12', model:'349', year:2025, period:'12', type:'ord', status:'presentadoAcuse',  result:{kind:'informativa',amount:0}, incidents:{blocking:0,warning:0}, file:'2025_12.349',  updatedAt:'19/01/2026' },
  { id:'349-2025-11', model:'349', year:2025, period:'11', type:'ord', status:'presentadoAcuse',  result:{kind:'informativa',amount:0}, incidents:{blocking:0,warning:0}, file:'2025_11.349',  updatedAt:'18/12/2025' },
  { id:'349-2025-10', model:'349', year:2025, period:'10', type:'ord', status:'presentadoOtra',   result:{kind:'informativa',amount:0}, incidents:{blocking:0,warning:0}, file:null, fileExternal:true, updatedAt:'15/11/2025' },
  { id:'349-2025-09', model:'349', year:2025, period:'09', type:'ord', status:'omitido',          result:{kind:'informativa',amount:0}, incidents:{blocking:0,warning:0}, file:null,           updatedAt:'12/10/2025' },
  { id:'349-2025-08', model:'349', year:2025, period:'08', type:'ord', status:'presentadoAcuse',  result:{kind:'informativa',amount:0}, incidents:{blocking:0,warning:0}, file:'2025_08.349',  updatedAt:'18/09/2025' },
  { id:'349-2025-07', model:'349', year:2025, period:'07', type:'ord', status:'presentado',       result:{kind:'informativa',amount:0}, incidents:{blocking:0,warning:1}, file:'2025_07.349',  updatedAt:'18/08/2025' },
  { id:'349-2025-06', model:'349', year:2025, period:'06', type:'ord', status:'presentadoAcuse',  result:{kind:'informativa',amount:0}, incidents:{blocking:0,warning:0}, file:'2025_06.349',  updatedAt:'19/07/2025' },
  { id:'349-2025-05', model:'349', year:2025, period:'05', type:'ord', status:'presentadoAcuse',  result:{kind:'informativa',amount:0}, incidents:{blocking:0,warning:0}, file:'2025_05.349',  updatedAt:'18/06/2025' },
  { id:'349-2025-04', model:'349', year:2025, period:'04', type:'ord', status:'omitido',          result:{kind:'informativa',amount:0}, incidents:{blocking:0,warning:0}, file:null,           updatedAt:'10/05/2025' },
  { id:'349-2025-03', model:'349', year:2025, period:'03', type:'ord', status:'presentadoAcuse',  result:{kind:'informativa',amount:0}, incidents:{blocking:0,warning:0}, file:'2025_03.349',  updatedAt:'19/04/2025' },
  { id:'349-2026-T1', model:'349', year:2026, period:'T1', type:'ord', status:'pendiente',   result:{kind:'informativa',amount:0}, incidents:{blocking:0,warning:0}, file:null, updatedAt:'—' },
  { id:'303-2026-T1', model:'303', year:2026, period:'T1', type:'ord', status:'borrador',         result:{kind:'compensar',amount:2816.31}, incidents:{blocking:2,warning:3,items:[
    { severity:'block', origin:'Casilla 28', message:'El total de cuota devengada no coincide con la suma de las cuotas parciales', suggestion:'Revisa las cuotas de los tipos 21%, 10% y 4%' },
    { severity:'block', origin:'Casilla 69', message:'El resultado de la liquidación está pendiente de confirmar', suggestion:'Verifica que el resultado neto sea correcto antes de generar el fichero' },
    { severity:'warn',  origin:'Casilla 48', message:'No se han detectado facturas de compra para este período', suggestion:'Comprueba si hay facturas de compra no registradas' },
    { severity:'warn',  origin:'Casilla 64', message:'El total deducible es inferior al período anterior en más de un 30%', suggestion:'Verifica si es coherente con la actividad del trimestre' },
    { severity:'warn',  origin:'NIF declarante', message:'El NIF del declarante no está verificado en la AEAT', suggestion:'Confirma el NIF en la configuración del declarante' },
  ]}, file:null, boxes:{ 7:3248, 9:682.08, 27:682.08, 28:16659, 29:3498.39, 45:3498.39, 46:-2816.31 }, summary:{ accrued:682.08, deductible:3498.39, result:-2816.31 }, updatedAt:'14/05/2026', current:true },
  { id:'303-2025-T4', model:'303', year:2025, period:'T4', type:'ord', status:'presentadoAcuse',  result:{kind:'compensar',amount:2100}, incidents:{blocking:0,warning:0}, file:'2025_T4.303', updatedAt:'28/01/2026' },
];

const DEFAULT_ACTIVE = { '303': true, '349': true };

// ── Upcoming deadlines helpers ───────────────────────────────────
const MONTH_NAMES_ES = ['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE'];

function formatDeadlineHeader(date) {
  return `${date.getDate()} ${MONTH_NAMES_ES[date.getMonth()]}`;
}

function formatPeriodLabel(period) {
  if (/^T\d$/.test(period)) return `T${period[1]}`;
  if (/^\d{2}$/.test(period)) return `${parseInt(period, 10)}M`;
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
                <span className={`fm-upcoming__badge fm-upcoming__badge--${decl.model}`}>{decl.model}</span>
                <div className="fm-upcoming__info">
                  <div className="fm-upcoming__model-label">{t(`fm.catalog.${decl.model}.name`) ?? `Modelo ${decl.model}`}</div>
                  <div className="fm-upcoming__period">{decl.year} · {formatPeriodLabel(decl.period)}</div>
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

// ── Main component ───────────────────────────────────────────────
export default function FmListPage({ declarations: propDecls, onSelect, onStatusChange, token, apiBaseUrl }) {
  const ui = useUI();
  const t  = ui;

  const [decls, setDecls]               = useState(propDecls ?? MOCK_DECLARATIONS);
  const [modelFilter, setModelFilter]   = useState('all');
  const [yearFilter,  setYearFilter]    = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [activeModels, setActiveModels] = useState(DEFAULT_ACTIVE);
  const [showCatalog,  setShowCatalog]  = useState(false);
  const [showConfig,   setShowConfig]   = useState(false);
  const [showNewDecl,  setShowNewDecl]  = useState(false);
  const [selected,     setSelected]     = useState(new Set());

  const handleStatusChange = useCallback((id, newStatus) => {
    setDecls(ds => ds.map(d => d.id === id ? { ...d, status: newStatus } : d));
    onStatusChange?.(id, newStatus);
  }, [onStatusChange]);

  const handleNewDecl = useCallback(({ model, year, period, status }) => {
    const id = `${model}-${year}-${period}`;
    setDecls(ds => [{ id, model, year, period, type:'ord', status, result:{kind:'informativa',amount:0}, incidents:{blocking:0,warning:0}, file:null, updatedAt: new Date().toLocaleDateString('es-ES') }, ...ds]);
  }, []);

  const years = ['all', ...Array.from(new Set(decls.map(d => String(d.year)))).sort((a,b) => b - a)];
  const statuses = ['all', ...Array.from(new Set(decls.map(d => d.status)))];

  const filtered = decls.filter(d => {
    if (modelFilter !== 'all'  && d.model  !== modelFilter)  return false;
    if (yearFilter  !== 'all'  && String(d.year) !== yearFilter) return false;
    if (statusFilter !== 'all' && d.status !== statusFilter) return false;
    return true;
  });

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

      {/* ── Upcoming deadlines ───────────────────────────────────── */}
      <UpcomingDeadlines decls={decls} onSelect={onSelect} t={t} />

      {/* ── Section header ───────────────────────────────────────── */}
      <div className="fm-section-header">
        <span className="fm-section-header__title">{t('fm.list.title')}</span>
        <span className="fm-section-header__count">{filtered.length} {t('fm.list.count')}</span>
        <div className="fm-section-header__actions">
          <button className="fm-section-header__icon-btn" title="Filtrar" aria-label="Filtrar"><ListFilter size={14} strokeWidth={1.75} /></button>
          <button className="fm-section-header__icon-btn" title="Ordenar" aria-label="Ordenar"><ArrowUpDown size={14} strokeWidth={1.75} /></button>
        </div>
      </div>

      {/* ── Table ────────────────────────────────────────────────── */}
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
                {filtered.map(decl => (
                  <tr
                    key={decl.id}
                    className={decl.current ? 'fm-table__row--current' : ''}
                    onClick={() => onSelect?.(decl)}
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
                      {decl.result?.kind === 'informativa'
                        ? <span style={{ color: '#9ca3af' }}>—</span>
                        : <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12 }}>{formatAmount(decl.result?.amount)}</span>
                      }
                    </td>
                    <td>
                      <IncidentsCell blocking={decl.incidents?.blocking ?? 0} warning={decl.incidents?.warning ?? 0} t={t} />
                    </td>
                    <td><FileCell file={decl.file} fileExternal={decl.fileExternal} /></td>
                    <td><span className="fm-date">{decl.updatedAt ?? '—'}</span></td>
                    <td onClick={e => e.stopPropagation()}>
                      <button className="fm-table-action" onClick={() => onSelect?.(decl)}>
                        {t('fm.action.open')} ›
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
      </div>

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
