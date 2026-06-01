import React, { useState } from 'react';
import { useUI } from '@/i18n';
import { ArrowLeft, Download, FileDown, Play, OctagonAlert, CircleCheck, Search, RefreshCw, Globe, Eye, Lock } from 'lucide-react';
import { StatusPillMenu } from '../../FmCommon.jsx';
import { PresentModal, FileGenModal } from '../../FmOverlays.jsx';
import { formatAmount, compute349Operators, generate349File } from '../../fiscalModelsUtils.js';
import { use349Pdf } from './use349Pdf.js';
import { DocumentPreview } from '../../../../../components/contract-ui/DocumentPreview.jsx';
import '../../fiscal-models.css';

// ── Constants ────────────────────────────────────────────────────
const STEPPER_INDEX = {
  pending:0, draft:1, ready:2,
  submitted:3, submitted_ext:3, submitted_ack:3,
  skipped:-1,
};

const KEY_IDS = ['E', 'S', 'A', 'I'];

const MOCK_OPERATORS = [
  { id:1, nif:'IT12345678901', name:'Bramini Vino S.r.l.',        key:'A', base:12450.00, vies:'valid',   origin:'4 facturas compra' },
  { id:2, nif:'FR40123456789', name:'Olives de Provence SARL',    key:'A', base:6800.00,  vies:'valid',   origin:'2 facturas compra' },
  { id:3, nif:'DE123456789',   name:'Bayern Technik GmbH',        key:'E', base:17600.00, vies:'valid',   origin:'3 facturas venta' },
  { id:4, nif:'PT501234567',   name:'Lusitana Serviços Lda',      key:'S', base:650.00,   vies:'pending', origin:'1 factura servicio' },
  { id:5, nif:'NL123456789B01',name:'Amsterdam Trading BV',       key:'I', base:1450.00,  vies:'valid',   origin:'2 facturas recibidas' },
  { id:7, nif:'PL1234567890',  name:'Kraków Components sp.z.o.o.',key:'A', base:3200.00,  vies:'valid',   origin:'1 factura compra' },
];

// ── Sub-components ───────────────────────────────────────────────
function KeyBadge({ k }) {
  return <span className={`fm-key fm-key--${k}`}>{k}</span>;
}

function ViesBadge({ status }) {
  const t = useUI();
  const map = { valid: ['✓', 'valid'], pending: ['○', 'pending'], invalid: ['×', 'invalid'] };
  const [icon, cls] = map[status] ?? map.pending;
  return <span className={`fm-vies fm-vies--${cls}`}>{icon} {t(`fm.m349.vies.${status ?? 'pending'}`)}</span>;
}

function NumberedStepper({ steps, current }) {
  return (
    <div className="fm-stepper-num" role="list">
      {steps.map((label, i) => {
        const done   = i < current;
        const active = i === current;
        return (
          <React.Fragment key={label}>
            {i > 0 && <span className="fm-stepper-num__sep" aria-hidden="true">—</span>}
            <span
              role="listitem"
              className={`fm-stepper-num__step${active ? ' fm-stepper-num__step--active' : ''}${done ? ' fm-stepper-num__step--done' : ''}`}
            >
              <span className="fm-stepper-num__circle">
                {done ? '✓' : i + 1}
              </span>
              {label}
            </span>
          </React.Fragment>
        );
      })}
    </div>
  );
}

function Banner349({ type, icon, title, sub, actions }) {
  return (
    <div className={`fm-349-banner fm-349-banner--${type}`}>
      <div className="fm-349-banner__icon">{icon}</div>
      <div className="fm-349-banner__body">
        <div className="fm-349-banner__title">{title}</div>
        {sub && <div className="fm-349-banner__sub">{sub}</div>}
      </div>
      {actions && <div className="fm-349-banner__actions">{actions}</div>}
    </div>
  );
}

function TotalsCard({ operators }) {
  const t = useUI();
  const totals = {};
  KEY_IDS.forEach(k => { totals[k] = operators.filter(o => o.key === k).reduce((s,o) => s + o.base, 0); });
  return (
    <div className="fm-349-totals">
      <div className="fm-349-totals__header">
        <div className="fm-349-totals__title">
          {t('fm.m349.totals.title')} <span style={{ fontSize: 11, fontWeight: 400, color: '#6b7280' }}>({t('fm.m349.totals.readonly')})</span>
        </div>
        <div className="fm-349-totals__sub">{t('fm.m349.totals.sub')}</div>
      </div>
      <div className="fm-349-totals__grid">
        {KEY_IDS.map(k => (
          <div key={k} className="fm-349-total-cell">
            <div className="fm-349-total-cell__head">
              <KeyBadge k={k} />
              <Lock size={10} strokeWidth={2} style={{ color: '#9ca3af' }} />
            </div>
            <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>{t(`fm.m349.key.${k}`)}</div>
            <div className={`fm-349-total-cell__amount${totals[k] === 0 ? ' fm-349-total-cell__amount--zero' : ''}`}>
              {formatAmount(totals[k])}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────────
export default function FmModel349Page({ decl, onBack, onStatusChange, token, apiBaseUrl }) {
  const ui = useUI();
  const t = ui;

  const [status,      setStatus]      = useState(decl.status);
  const [activeTab,   setActiveTab]   = useState('operators');
  const [keyFilter,   setKeyFilter]   = useState('all');
  const [showPresent, setShowPresent] = useState(false);
  const [showFilegen, setShowFilegen] = useState(false);
  const [selected,     setSelected]     = useState(new Set());
  const [liveOperators, setLiveOperators] = useState(decl._precomputed?.operators ?? null);
  const [liveInvoices,  setLiveInvoices]  = useState(decl._precomputed?.invoices  ?? null);
  const [invoiceNifFilter, setInvoiceNifFilter] = useState(null);
  const [computing,    setComputing]    = useState(false);
  const [generating,   setGenerating]   = useState(false);
  const [showPdf,      setShowPdf]      = useState(false);
  const { pdfUrl, loading: pdfLoading, generatePdf, clearPdf } = use349Pdf();

  const operators = liveOperators ?? decl.operators ?? MOCK_OPERATORS;
  const stepIdx   = STEPPER_INDEX[status] ?? 0;

  const monthNum  = /^\d{2}$/.test(decl.period) ? parseInt(decl.period, 10) : null;
  const monthName = monthNum
    ? new Intl.DateTimeFormat(undefined, { month: 'long' }).format(new Date(2000, monthNum - 1, 1))
    : null;
  const periodLabel = monthName ? `${decl.year} / ${monthName}` : `${decl.year} ${decl.period}`;

  const blocking     = decl.incidents?.blocking ?? 0;
  const viesPending  = operators.filter(o => o.vies === 'pending').length;
  const totalBase    = operators.reduce((s,o) => s + o.base, 0);
  const rectifications = decl.rectifications ?? 1;

  const stepLabels = ['pending', 'draft', 'ready', 'submitted'].map(id => t(`fm.status.${id}`));

  function handleStatusChange(newStatus) {
    setStatus(newStatus);
    onStatusChange?.(decl.id, newStatus);
  }

  async function handleCompute() {
    setComputing(true);
    try {
      const res = await compute349Operators(decl, { token, apiBaseUrl });
      if (res?.operators) setLiveOperators(res.operators);
      if (res?.invoices)  setLiveInvoices(res.invoices);
    } finally {
      setComputing(false);
    }
  }

  async function handleGenerate({ phone, contact } = {}) {
    setGenerating(true);
    const ok = await generate349File(decl, { token, apiBaseUrl, phone, contact });
    setGenerating(false);
    if (!ok) console.error('generate349File failed for', decl.year, decl.period);
  }

  async function handlePreviewPdf() {
    const url = await generatePdf(decl, operators);
    if (url) setShowPdf(true);
  }

  const filteredOps  = keyFilter === 'all' ? operators : operators.filter(o => o.key === keyFilter);
  const toggleSelect = id => setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const allSelected  = filteredOps.length > 0 && filteredOps.every(o => selected.has(o.id));

  // Derive invoice counts per NIF from liveInvoices (same compute, no extra request)
  const originByNif = React.useMemo(() => {
    if (!liveInvoices) return {};
    const map = {};
    liveInvoices.forEach(inv => {
      const k = inv.nifIva;
      if (!map[k]) map[k] = { Compra: 0, Venta: 0 };
      map[k][inv.type] = (map[k][inv.type] ?? 0) + 1;
    });
    return map;
  }, [liveInvoices]);

  function formatOrigin(op) {
    if (op.origin) return op.origin; // mock or manually set
    const counts = originByNif[op.nif];
    if (!counts) return null;
    const c = counts['Compra'] ?? 0;
    const v = counts['Venta']  ?? 0;
    if (c > 0 && v > 0) return `${c} compra, ${v} venta`;
    if (c > 0) return `${c} factura${c !== 1 ? 's' : ''} compra`;
    if (v > 0) return `${v} factura${v !== 1 ? 's' : ''} venta`;
    return null;
  }

  const declNif = decl.nif ?? '';

  const TABS = [
    { id:'operators', label: t('fm.m349.tab.operators'), count: operators.length },
    { id:'rectif',    label: t('fm.m349.tab.rectif'),    count: rectifications },
    { id:'invoices',  label: t('fm.m349.tab.invoices'),  count: liveInvoices?.length ?? null },
    { id:'incidents', label: t('fm.m349.tab.incidents'), count: blocking },
    { id:'files',     label: t('fm.m349.tab.files'),     count: 1 },
    { id:'history',   label: t('fm.m349.tab.history'),   count: null },
  ];

  return (
    <div className="fm-page">

      {/* ── Header ───────────────────────────────────────────────── */}
      <div className="fm-349-header">
        <div className="fm-349-header__back">
          <button className="fm-349-header__back-btn" onClick={onBack}>
            <ArrowLeft size={14} strokeWidth={1.75} /> {t('fm.action.back')}
          </button>
        </div>
        <div className="fm-349-header__main">
          <div>
            <div className="fm-349-header__title-row">
              <span className="fm-model-badge fm-model-badge--349">349</span>
              <span className="fm-349-header__title">Modelo 349 · {periodLabel}</span>
              <div style={{ marginLeft: 4 }}>
                <StatusPillMenu status={status} onStatusChange={handleStatusChange} />
              </div>
            </div>
            <div className="fm-349-header__subtitle">
              {t('fm.m349.subtitle')} · {decl.type === 'ord' ? t('fm.m349.type.ord') : t('fm.m349.type.com')}
              {declNif && ` · NIF: ${declNif}`} · {t('fm.m349.periodicity')}: {t('fm.m349.monthly')}
            </div>
          </div>
          <div className="fm-349-header__actions">
            <button className="fm-349-header__btn" onClick={handleCompute} disabled={computing}>
              <RefreshCw size={14} strokeWidth={1.75} style={computing ? { animation: 'spin 1s linear infinite' } : {}} />
              {computing ? (t('fm.action.computing') ?? 'Calculando…') : t('fm.action.recalc')}
            </button>
            <button className="fm-349-header__btn"><Globe size={14} strokeWidth={1.75} /> VIES</button>
            <button className="fm-349-header__btn" onClick={handlePreviewPdf} disabled={pdfLoading}>
              <Eye size={14} strokeWidth={1.75} />
              {pdfLoading ? (t('fm.action.generating') ?? 'Generando…') : t('fm.action.preview_pdf')}
            </button>
            <button className="fm-349-header__btn" onClick={() => setShowFilegen(true)} disabled={generating}>
              <FileDown size={14} strokeWidth={1.75} />
              {generating ? (t('fm.action.generating') ?? 'Generando…') : t('fm.action.generate_file')}
            </button>
            <button className="fm-349-header__btn fm-349-header__btn--primary" onClick={() => setShowPresent(true)}>
              <Play size={13} strokeWidth={1.75} fill="currentColor" /> {t('fm.action.present')}
            </button>
          </div>
        </div>
      </div>

      {/* ── Numbered Stepper ─────────────────────────────────────── */}
      <NumberedStepper steps={stepLabels} current={stepIdx} />

      {/* ── Body ─────────────────────────────────────────────────── */}
      <div className="fm-page__body">

        {/* Banners */}
        {blocking > 0 && (
          <Banner349
            type="error"
            icon={<OctagonAlert size={18} strokeWidth={1.75} />}
            title={t('fm.m349.banner.blocking_title', { count: blocking })}
            sub={t('fm.m349.banner.blocking_sub')}
            actions={<button className="fm-349-banner__btn fm-349-banner__btn--outline">{t('fm.m349.banner.blocking_action')}</button>}
          />
        )}
        {viesPending > 0 && (
          <Banner349
            type="info"
            icon={<Globe size={18} strokeWidth={1.75} />}
            title={t('fm.m349.banner.vies_title', { count: viesPending })}
            sub={t('fm.m349.banner.vies_sub')}
            actions={<button className="fm-349-banner__btn fm-349-banner__btn--outline"><RefreshCw size={13} strokeWidth={1.75} style={{ display:'inline',verticalAlign:'middle',marginRight:4 }} />{t('fm.m349.banner.vies_action')}</button>}
          />
        )}
        {status === 'ready' && (
          <Banner349
            type="success"
            icon={<CircleCheck size={18} strokeWidth={1.75} />}
            title={t('fm.m349.banner.ready_title')}
            sub={`349_${declNif}_${decl.year}_${decl.period}.349 · ${t('fm.m349.banner.ready_sub', { ops: operators.length })}`}
            actions={
              <>
                <button className="fm-349-banner__btn fm-349-banner__btn--outline"><Download size={13} strokeWidth={1.75} style={{ display:'inline',verticalAlign:'middle',marginRight:4 }} />{t('fm.m349.banner.download')}</button>
                <button className="fm-349-banner__btn fm-349-banner__btn--primary"><Play size={12} strokeWidth={1.75} fill="currentColor" style={{ display:'inline',verticalAlign:'middle',marginRight:4 }} />{t('fm.m349.banner.present')}</button>
              </>
            }
          />
        )}

        {/* KPI cards */}
        <div className="fm-349-kpis">
          <div className="fm-349-kpi">
            <div className="fm-349-kpi__label">{t('fm.m349.kpi.operators')}</div>
            <div className="fm-349-kpi__value">{operators.length}</div>
            <div className="fm-349-kpi__desc">{t('fm.m349.kpi.operators_desc')}</div>
          </div>
          <div className="fm-349-kpi">
            <div className="fm-349-kpi__label">{t('fm.m349.kpi.total_ops')}</div>
            <div className="fm-349-kpi__value fm-349-kpi__value--mono">{formatAmount(totalBase)}</div>
            <div className="fm-349-kpi__desc">{t('fm.m349.kpi.total_ops_desc')}</div>
          </div>
          <div className="fm-349-kpi">
            <div className="fm-349-kpi__label">{t('fm.m349.kpi.rectif')}</div>
            <div className="fm-349-kpi__value">{rectifications}</div>
            <div className="fm-349-kpi__desc">{t('fm.m349.kpi.rectif_desc')}</div>
          </div>
          <div className="fm-349-kpi">
            <div className="fm-349-kpi__label">{t('fm.m349.kpi.vies_pending')}</div>
            <div className={`fm-349-kpi__value${viesPending > 0 ? ' fm-349-kpi__value--orange' : ''}`}>{viesPending}</div>
            <div className="fm-349-kpi__desc">{t('fm.m349.kpi.vies_pending_desc')}</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="fm-tabs-bar">
          {TABS.map(tab => (
            <button
              key={tab.id}
              className={`fm-tabs-bar__tab${activeTab === tab.id ? ' fm-tabs-bar__tab--active' : ''}`}
              onClick={() => { setActiveTab(tab.id); if (tab.id !== 'invoices') setInvoiceNifFilter(null); }}
            >
              {tab.label}
              {tab.count != null && <span className="fm-tabs-bar__count">{tab.count}</span>}
            </button>
          ))}
        </div>

        {activeTab === 'operators' && (
          <div style={{ marginTop: 12 }}>
            {/* Key filter + search row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
              <div className="fm-key-pills">
                <button className={`fm-key-pill${keyFilter === 'all' ? ' fm-key-pill--active' : ''}`} onClick={() => setKeyFilter('all')}>
                  {t('fm.m349.filter.all_keys')}
                </button>
                {KEY_IDS.map(k => (
                  <button key={k} className={`fm-key-pill${keyFilter === k ? ' fm-key-pill--active' : ''}`} onClick={() => setKeyFilter(k)}>
                    <KeyBadge k={k} />{t(`fm.m349.key.${k}`)}
                  </button>
                ))}
              </div>
              <div style={{ flex: 1 }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 12, color: '#6b7280', background: '#fff' }}>
                <Search size={13} strokeWidth={1.75} style={{ flexShrink: 0 }} /> <span>{t('fm.m349.search_placeholder')}</span>
              </div>
            </div>

            {/* Totals card */}
            <TotalsCard operators={operators} />

            {/* Operators table */}
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', marginBottom: 2 }}>{t('fm.m349.operators_count', { count: operators.length })}</div>
              <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 10 }}>
                {t('fm.m349.operators_sub')}
              </div>
            </div>

            <div className="fm-table-wrap" style={{ flex: 'none' }}>
              <table className="fm-table">
                <thead>
                  <tr>
                    <th style={{ width: 32 }}>
                      <input type="checkbox" className="fm-table__cb" checked={allSelected} onChange={() => setSelected(allSelected ? new Set() : new Set(filteredOps.map(o => o.id)))} />
                    </th>
                    <th>{t('fm.m349.col.nif_iva')}</th>
                    <th>{t('fm.m349.col.operator')}</th>
                    <th>{t('fm.m349.col.key')}</th>
                    <th style={{ textAlign: 'right' }}>{t('fm.m349.col.taxable_base')}</th>
                    <th>{t('fm.m349.col.vies')}</th>
                    <th>{t('fm.m349.col.origin')}</th>
                    <th>{t('fm.m349.col.action')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOps.map(op => (
                    <tr key={op.id}>
                      <td onClick={e => e.stopPropagation()}>
                        <input type="checkbox" className="fm-table__cb" checked={selected.has(op.id)} onChange={() => toggleSelect(op.id)} />
                      </td>
                      <td><span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: '#374151' }}>{op.nif}</span></td>
                      <td style={{ fontWeight: 600, color: '#0f172a' }}>{op.name}</td>
                      <td><KeyBadge k={op.key} /><span style={{ marginLeft: 5, fontSize: 11, color: '#6b7280' }}>{t(`fm.m349.key.${op.key}`)}</span></td>
                      <td style={{ textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace", fontSize: 12 }}>{formatAmount(op.base)}</td>
                      <td><ViesBadge status={op.vies} /></td>
                      <td>
                        {formatOrigin(op)
                          ? <button className="fm-origin-link" onClick={() => { setInvoiceNifFilter(op.nif); setActiveTab('invoices'); }}>{formatOrigin(op)}</button>
                          : <span style={{ color: '#d1d5db' }}>—</span>
                        }
                      </td>
                      <td><button className="fm-table-action"><Eye size={12} strokeWidth={1.75} style={{ display:'inline',verticalAlign:'middle',marginRight:4 }} />{t('fm.action.open')}</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'invoices' && (
          <div style={{ marginTop: 12 }}>
            {!liveInvoices ? (
              <div style={{ padding: '32px 0', textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
                {t('fm.m349.invoices.empty') ?? 'Recalculá para ver las facturas origen.'}
              </div>
            ) : liveInvoices.length === 0 ? (
              <div style={{ padding: '32px 0', textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
                {t('fm.m349.invoices.none') ?? 'No hay facturas intracomunitarias en este período.'}
              </div>
            ) : (() => {
              const visibleInvoices = invoiceNifFilter
                ? liveInvoices.filter(inv => inv.nifIva === invoiceNifFilter)
                : liveInvoices;
              return (
                <>
                  {invoiceNifFilter && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                      <span style={{ fontSize: 11, color: '#6b7280' }}>Filtrando por:</span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600, color: '#1e40af', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 4, padding: '2px 8px' }}>
                        <span style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{invoiceNifFilter}</span>
                        <button onClick={() => setInvoiceNifFilter(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', lineHeight: 1, padding: 0, fontSize: 13 }}>×</button>
                      </span>
                      <span style={{ fontSize: 11, color: '#9ca3af' }}>{visibleInvoices.length} de {liveInvoices.length}</span>
                    </div>
                  )}
                  <div className="fm-table-wrap" style={{ flex: 'none' }}>
                    <table className="fm-table">
                      <thead>
                        <tr>
                          <th>{t('fm.m349.col.date') ?? 'Fecha'}</th>
                          <th>{t('fm.m349.col.ref') ?? 'Referencia'}</th>
                          <th>{t('fm.m349.col.invoice_type') ?? 'Tipo'}</th>
                          <th>{t('fm.m349.col.operator') ?? 'Operador'}</th>
                          <th>{t('fm.m349.col.nif_iva') ?? 'NIF-IVA'}</th>
                          <th style={{ textAlign: 'right' }}>{t('fm.m349.col.taxable_base') ?? 'Base imponible'}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleInvoices.map((inv, i) => (
                          <tr key={`${inv.ref}-${i}`}>
                            <td><span className="fm-date">{inv.date}</span></td>
                            <td><span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11 }}>{inv.ref}</span></td>
                            <td>
                              <span style={{ fontSize: 11, color: inv.type === 'Venta' ? '#059669' : '#2563eb', fontWeight: 500 }}>
                                {inv.type}
                              </span>
                            </td>
                            <td style={{ fontWeight: 500, color: '#0f172a' }}>{inv.party}</td>
                            <td><span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: '#374151' }}>{inv.nifIva}</span></td>
                            <td style={{ textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace", fontSize: 12 }}>
                              {formatAmount(parseFloat(inv.base))}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              );
            })()}
          </div>
        )}

        {activeTab !== 'operators' && activeTab !== 'invoices' && (
          <div style={{ padding: '32px 0', textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
            {t('fm.m349.coming_soon', { tab: TABS.find(tab => tab.id === activeTab)?.label ?? '' })}
          </div>
        )}
      </div>

      {/* Overlays */}
      {showPresent && (
        <PresentModal decl={decl} onConfirm={({ status: s }) => handleStatusChange(s)} onClose={() => setShowPresent(false)} />
      )}
      {showFilegen && (
        <FileGenModal
          decl={decl}
          onConfirm={({ phone, contact }) => handleGenerate({ phone, contact })}
          onClose={() => setShowFilegen(false)}
        />
      )}
      {showPdf && (
        <DocumentPreview
          open={showPdf}
          onClose={() => { setShowPdf(false); clearPdf(); }}
          title={`Modelo 349 · ${decl.year} ${decl.period}`}
          pdfUrl={pdfUrl}
        />
      )}
    </div>
  );
}
