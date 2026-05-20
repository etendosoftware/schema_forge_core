import { useState, useRef, useEffect } from 'react';
import { ChevronDown, ArrowRight, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useUI, useLocaleSwitch } from '@/i18n';
import { neoBase } from '@/components/related-documents/helpers.js';
import { useApiFetch } from '@/auth/useApiFetch.js';
import { useAuth } from '@/auth/AuthContext.jsx';
import {
  buildOnboardingPayloads,
  getFiscalRecordId,
  getAllowedSystemsForTerritory,
  getCertificateContext,
  resolveSystem,
} from './fiscalConfig.utils.js';
import SiiSection from './SiiSection.jsx';
import TbaiSection from './TbaiSection.jsx';
import VerifactuSection from './VerifactuSection.jsx';
import CertModal from './CertModal.jsx';
import CertSection from './CertSection.jsx';

// Keep in sync with useFiscalConfig.js
const SII_ENTITY      = 'siiConfiguration';
const TBAI_ENTITY     = 'header';
const VERIFACTU_ENTITY = 'cabeceraDeConfiguraciónVerifactu';

// ── Data (IDs and logic flags — display strings resolved via ui() inside component) ───

const TERRITORY_META = {
  navarra:  { id: 'navarra',  regime: 'sii_foral', askNational: false, askVolume: false, taxtype: 'IVA',  tbaiTerritory: null,       guipuzcoa: null },
  alava:    { id: 'alava',    regime: 'tbai',       askNational: true,  askVolume: false, taxtype: null,   tbaiTerritory: 'ARABA',    guipuzcoa: null },
  bizkaia:  { id: 'bizkaia',  regime: 'tbai',       askNational: true,  askVolume: false, taxtype: null,   tbaiTerritory: 'BIZKAIA',  guipuzcoa: null },
  gipuzkoa: { id: 'gipuzkoa', regime: 'tbai',       askNational: true,  askVolume: false, taxtype: null,   tbaiTerritory: 'GIPUZKOA', guipuzcoa: 'Y'  },
  baleares: { id: 'baleares', regime: 'siiver',     askNational: false, askVolume: true,  taxtype: 'IVA',  tbaiTerritory: null,       guipuzcoa: null },
  canarias: { id: 'canarias', regime: 'siiver',     askNational: false, askVolume: true,  taxtype: 'IGIC', tbaiTerritory: null,       guipuzcoa: null },
  ceuta:    { id: 'ceuta',    regime: 'siiver',     askNational: false, askVolume: true,  taxtype: 'IPSI', tbaiTerritory: null,       guipuzcoa: null },
};

const TERRITORY_GROUP_META = [
  { regime: 'sii_foral', items: ['navarra'] },
  { regime: 'tbai',      items: ['alava', 'bizkaia', 'gipuzkoa'] },
  { regime: 'siiver',    items: ['baleares', 'canarias', 'ceuta'] },
];


// ── Network ───────────────────────────────────────────────────────────────────

async function postRecord(path, body, apiFetch) {
  const res = await apiFetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text().catch(() => res.statusText));
  const json = await res.json().catch(() => null);
  return json?.response?.data?.[0] ?? null;
}

async function createAndFetchRecord({ specName, entityName, body, apiFetch, system }) {
  const created = await postRecord(`/${specName}/${entityName}`, body, apiFetch);
  const recordId = getFiscalRecordId(created, system);
  if (!recordId) return created;
  const fetched = await apiFetch(`/${specName}/${entityName}/${recordId}`)
    .then(r => r.ok ? r.json() : null)
    .then(j => j?.response?.data?.[0] || null)
    .catch(() => null);
  return fetched ?? created;
}

// ── Badge color by regime ─────────────────────────────────────────────────────

const REGIME_BADGE = {
  sii_foral: { bg: '#F0FAFF', text: '#0075AD' },
  tbai:      { bg: '#FFF2EE', text: '#B82E00' },
  siiver:    { bg: '#FEECFB', text: '#A5088C' },
};

const SYSTEM_BADGE = {
  SII:        { bg: '#F0FAFF', text: '#0075AD' },
  TBAI:       { bg: '#FFF2EE', text: '#B82E00' },
  'SII+TBAI': { bg: '#FFF2EE', text: '#B82E00' },
  VERIFACTU:  { bg: '#FEECFB', text: '#A5088C' },
};
const SYSTEM_BADGE_LABEL = { SII: 'SII', TBAI: 'TBAI', 'SII+TBAI': 'SII + TBAI', VERIFACTU: 'Verifactu' };

const ORG_COLORS = ['bg-red-500', 'bg-blue-500', 'bg-green-600', 'bg-orange-500', 'bg-purple-500', 'bg-teal-500'];
function orgAvatarColor(name) {
  return ORG_COLORS[(name?.charCodeAt(0) ?? 0) % ORG_COLORS.length];
}

// ── Primitive components ──────────────────────────────────────────────────────

function Stepper({ step, ui }) {
  const steps = [
    { n: 1, label: ui('fiscal.onboarding.step.territory') },
    { n: 2, label: ui('fiscal.onboarding.step.details') },
    { n: 3, label: ui('fiscal.onboarding.step.confirm') },
  ];
  return (
    <div className="flex items-center flex-shrink-0" style={{ gap: 6 }}>
      {steps.map(({ n, label }, i) => {
        const done = step > n;
        const active = step === n;
        return (
          <span key={n} className="flex items-center" style={{ gap: 6 }}>
            {i > 0 && <span className="flex-shrink-0" style={{ width: 40, height: 1, background: '#E8EAEF' }} />}
            <span className="flex items-center" style={{ gap: 6 }}>
              <span
                className="flex items-center justify-center text-xs font-semibold flex-shrink-0"
                style={{
                  width: 26, height: 24, borderRadius: 8,
                  background: (done || active) ? '#121217' : '#F5F7F9',
                  color: (done || active) ? '#FFFFFF' : '#3F3F50',
                  border: (done || active) ? 'none' : '1px solid #D1D4DB',
                }}
              >
                {done ? '✓' : n}
              </span>
              <span
                className="text-sm"
                style={{ color: active ? '#121217' : '#555B6D', fontWeight: active ? 600 : 400 }}
              >
                {label}
              </span>
            </span>
          </span>
        );
      })}
    </div>
  );
}

function OrgDropdown({ selectedOrg, orgList, onSelect }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const filtered = (orgList || []).filter(o => o.name !== '*');

  useEffect(() => {
    if (!open) return;
    function handleClick(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  if (!selectedOrg) return null;
  const initial = selectedOrg.name?.[0]?.toUpperCase() ?? '?';
  const avatarColor = orgAvatarColor(selectedOrg.name);
  const canSwitch = filtered.length > 1;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => canSwitch && setOpen(v => !v)}
        className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-border transition-colors
          ${canSwitch ? 'hover:bg-muted/40 cursor-pointer' : 'cursor-default'}`}
      >
        <span className={`w-5 h-5 rounded-full ${avatarColor} text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0`}>
          {initial}
        </span>
        <span className="text-sm font-medium">{selectedOrg.name}</span>
        {canSwitch && <ChevronDown size={13} className="text-muted-foreground" />}
      </button>
      {open && canSwitch && (
        <div className="absolute top-full mt-1 left-0 z-50 min-w-[200px] rounded-xl border border-border bg-background shadow-lg py-1">
          {filtered.map(org => (
            <button
              key={org.id}
              type="button"
              onClick={() => { onSelect(org); setOpen(false); }}
              className={`flex items-center gap-2.5 w-full px-3 py-2 text-sm hover:bg-muted/40 text-left transition-colors
                ${org.id === selectedOrg.id ? 'font-semibold' : ''}`}
            >
              <span className={`w-5 h-5 rounded-full ${orgAvatarColor(org.name)} text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0`}>
                {org.name[0]?.toUpperCase()}
              </span>
              {org.name}
              {org.id === selectedOrg.id && <span className="ml-auto text-muted-foreground">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function PageHead({ selectedOrg, orgList, onSelectOrg, onGoToManual, ui }) {
  return (
    <div
      className="flex-shrink-0 flex items-center justify-between"
      style={{ height: 56, padding: '0 20px', borderBottom: '1px solid #E8EAEF' }}
    >
      <div className="flex items-center" style={{ gap: 8 }}>
        <span className="text-sm font-medium" style={{ color: '#121217' }}>
          {ui('fiscal.onboarding.org.label')}
        </span>
        <OrgDropdown selectedOrg={selectedOrg} orgList={orgList} onSelect={onSelectOrg} />
      </div>
      {onGoToManual && (
        <button
          type="button"
          onClick={onGoToManual}
          className="text-sm"
          style={{ color: '#121217' }}
        >
          {ui('fiscal.onboarding.territory.prefer.manual.q')}{' '}
          <span className="font-medium underline">
            {ui('fiscal.onboarding.territory.prefer.manual.link')}
          </span>
        </button>
      )}
    </div>
  );
}

function Breadcrumb({ items }) {
  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-3.5">
      {items.map(({ label, onClick }, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && <span className="opacity-40">›</span>}
          {onClick
            ? <button type="button" onClick={onClick} className="text-foreground/70 hover:text-foreground border-b border-transparent hover:border-border">{label}</button>
            : <span className="font-medium text-foreground">{label}</span>
          }
        </span>
      ))}
    </div>
  );
}

function TerrCard({ territory, selected, onPick }) {
  const badgeColors = REGIME_BADGE[territory.regime];
  const badgeStyle = badgeColors
    ? { backgroundColor: badgeColors.bg, color: badgeColors.text }
    : { backgroundColor: 'hsl(var(--muted))', color: 'hsl(var(--muted-foreground))' };

  return (
    <button
      type="button"
      onClick={() => onPick(territory.id)}
      className={`relative flex flex-col text-left transition-all cursor-pointer rounded-xl
        ${selected ? 'border-2 border-[#121217]' : 'border border-[#E8EAEF] hover:bg-muted/40'}`}
      style={{
        minHeight: 80, padding: 16, gap: 12,
        boxShadow: selected
          ? '0 4px 16px rgba(18,18,23,0.14), 0 1px 3px rgba(18,18,23,0.08)'
          : '0 1px 2px rgba(18,18,23,0.05)',
      }}
    >
      {/* Radio circle — ring + inner dot style (◉) when selected */}
      <span
        className="absolute flex-shrink-0"
        style={{
          width: 15, height: 15, right: 8, top: 9,
          borderRadius: '50%',
          border: selected ? '1.5px solid #121217' : '1.5px solid #D1D4DB',
          background: selected
            ? 'radial-gradient(circle at center, #121217 40%, #FFFFFF 40%)'
            : '#FFFFFF',
          boxShadow: '0 1px 2px rgba(18,18,23,0.05)',
        }}
      />
      {/* Title + badge */}
      <div className="flex items-center min-w-0" style={{ gap: 4, paddingRight: 20 }}>
        <span className="text-sm font-medium truncate" style={{ color: '#121217' }}>{territory.name}</span>
        {territory.system && (
          <span style={badgeStyle} className="text-[10px] font-medium px-2 py-0.5 rounded-full flex-shrink-0 leading-none">
            {territory.system}
          </span>
        )}
      </div>
      {/* Description */}
      {territory.example && (
        <div className="text-sm leading-6" style={{ color: '#555B6D' }}>
          {territory.example}
        </div>
      )}
    </button>
  );
}

function RadioRow({ checked, onClick, label, description }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-start gap-2.5 px-3.5 py-3 rounded-[10px] border text-left w-full transition-all cursor-pointer
        ${checked ? 'border-foreground bg-background' : 'border-border hover:bg-muted/40'}`}
    >
      <span className={`w-4 h-4 rounded-full border flex-shrink-0 mt-0.5 relative
        ${checked ? 'border-foreground' : 'border-border bg-background'}`}>
        {checked && <span className="absolute inset-[3px] rounded-full bg-foreground" />}
      </span>
      <span>
        <span className="block text-sm font-semibold text-foreground">{label}</span>
        {description && <span className="block text-xs text-muted-foreground mt-0.5">{description}</span>}
      </span>
    </button>
  );
}

function ScreenLayout({ toolbar, children, actions, padContent = true }) {
  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Toolbar — never scrolls (org row) */}
      {toolbar}
      {/* Scrollable content area */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {padContent ? <div className="px-5 py-5">{children}</div> : children}
      </div>
      {/* Footer — always pinned at bottom */}
      <div
        className="flex-shrink-0 flex items-center"
        style={{ height: 56, padding: '0 20px', borderTop: '1px solid #E8EAEF', gap: 8 }}
      >
        {actions}
      </div>
    </div>
  );
}

// ── Step screens ──────────────────────────────────────────────────────────────

function SkippedScreen({ orgName, selectedOrg, orgList, onSelectOrg, ui, onGoHome, onComplete, goTo }) {
  return (
    <ScreenLayout
      toolbar={<PageHead selectedOrg={selectedOrg} orgList={orgList} onSelectOrg={onSelectOrg} ui={ui} />}
      actions={
        <>
          <Button variant="outline" onClick={() => goTo('territory')}>{ui('fiscal.onboarding.back.wizard')}</Button>
          <span className="flex-1" />
          <Button onClick={onGoHome ?? onComplete}>{ui('fiscal.onboarding.goHome')}</Button>
        </>
      }
    >
      <div className="flex flex-col items-center text-center py-8">
        <span className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-2xl mb-4">⏭</span>
        <h2 className="text-lg font-bold mb-1">{ui('fiscal.onboarding.skipped.title')}</h2>
        <p className="text-sm text-muted-foreground max-w-xs">{ui('fiscal.skip.hint')}</p>
      </div>
      <div className="rounded-[10px] border border-border bg-muted/20 p-4 text-sm text-muted-foreground">
        {ui('fiscal.onboarding.skipped.hint')}
      </div>
    </ScreenLayout>
  );
}

function AppliedScreen({ orgId, orgName, selectedOrg, orgList, onSelectOrg, system, selectedTerritory, alsoNational, volume, lowChoice, apiBaseUrl, apiFetch, locale, ui, SYSTEMS, TERRITORIES, onComplete, onGoHome }) {
  const [cert, setCert] = useState(null);
  const [certModalOpen, setCertModalOpen] = useState(false);

  useEffect(() => {
    if (!orgId || !system) return;
    const certCtx = getCertificateContext(system);
    if (!certCtx) return;
    apiFetch('/certificate')
      .then(r => r.json())
      .then(data => {
        if (data?.exists) setCert({ name: ui('fiscal.cert.loaded'), validTo: data.validTo ?? '' });
      })
      .catch(() => {});
  }, [orgId, apiFetch, system, ui]);

  const sys = SYSTEMS[system];
  const terr = TERRITORIES[selectedTerritory ?? ''];
  const certContext = getCertificateContext(system);

  return (
    <>
      <ScreenLayout
        toolbar={<PageHead selectedOrg={selectedOrg} orgList={orgList} onSelectOrg={onSelectOrg} ui={ui} />}
        actions={
          <>
            <Button variant="outline" onClick={onComplete}>{ui('fiscal.onboarding.viewConfig')}</Button>
            <span className="flex-1" />
            <Button onClick={onGoHome ?? onComplete}>{ui('fiscal.onboarding.goHome')}</Button>
          </>
        }
      >
        <h2 className="text-xl font-bold tracking-tight mb-1">{ui('fiscal.onboarding.applied.title')}</h2>
        <p className="text-sm text-muted-foreground mb-6">
          {ui('fiscal.onboarding.applied.subtitle', { system: sys?.name })}
        </p>

        <div className="rounded-xl border border-border overflow-hidden">
          <div className="bg-green-50 border-b border-green-200 px-5 py-4 flex items-center gap-3.5">
            <span className="w-9 h-9 rounded-full bg-green-100 text-green-700 flex items-center justify-center flex-shrink-0 text-xl">✓</span>
            <div>
              <div className="font-bold text-green-800">{ui('fiscal.onboarding.applied.configured', { system: sys?.name })}</div>
              <div className="text-sm text-green-700/80 mt-0.5">{ui('fiscal.onboarding.applied.body')}</div>
            </div>
          </div>
          <div className="divide-y divide-border px-5 py-2">
            {terr && <Row k={ui('fiscal.onboarding.applied.row.territory')} v={terr.name} />}
            <Row k={ui('fiscal.onboarding.applied.row.system')} v={sys?.name} />
            <Row k={ui('fiscal.onboarding.applied.row.tax')} v={terr ? terr.systemLong : sys?.long} />
            {terr?.askNational && (
              <Row k={ui('fiscal.onboarding.applied.row.national')} v={alsoNational ? ui('fiscal.onboarding.applied.national.active') : ui('fiscal.onboarding.applied.national.na')} />
            )}
            {terr?.askVolume && volume && (
              <Row k={ui('fiscal.onboarding.applied.row.volume')} v={volume === 'high' ? ui('fiscal.onboarding.applied.volume.high') : ui('fiscal.onboarding.applied.volume.low')} />
            )}
            {volume === 'low' && lowChoice && (
              <Row k={ui('fiscal.onboarding.applied.row.chosen')} v={lowChoice === 'sii' ? ui('fiscal.onboarding.applied.chosen.sii') : ui('fiscal.onboarding.applied.chosen.verifactu')} />
            )}
            <Row k={ui('fiscal.onboarding.applied.row.env')} v={<span className="text-amber-700">{ui('fiscal.onboarding.applied.env.sandbox')}</span>} />
            <Row k={ui('fiscal.onboarding.applied.row.activated')} v={new Date().toLocaleString(locale.replace('_', '-'), { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })} />
          </div>
        </div>

        <div className="mt-7">
          <h3 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-2.5">{ui('fiscal.onboarding.nextsteps.title')}</h3>
          <div className="flex flex-col gap-2">
            {certContext && (
              <NextItem
                icon="📄"
                title={cert ? ui('fiscal.onboarding.cert.loaded.title') : ui('fiscal.onboarding.cert.upload.title')}
                desc={cert
                  ? ui('fiscal.onboarding.cert.loaded.desc', { name: cert.name, validTo: cert.validTo })
                  : ui('fiscal.onboarding.cert.upload.desc')}
                badge={cert ? null : ui('fiscal.onboarding.cert.pending')}
                done={!!cert}
                onClick={() => setCertModalOpen(true)}
              />
            )}
          </div>
        </div>
      </ScreenLayout>

      {certModalOpen && certContext && (
        <CertModal
          context={certContext}
          orgId={orgId}
          apiBaseUrl={apiBaseUrl}
          onClose={() => setCertModalOpen(false)}
          onUpload={(c) => { setCert(c); setCertModalOpen(false); }}
        />
      )}
    </>
  );
}

function DetailScreen({ system, selectedTerritory, createdRecords, orgId, orgName, selectedOrg, orgList, onSelectOrg, apiBaseUrl, error, ui, SYSTEMS, siiRef, tbaiRef, verifactuRef, onBack, onApplied, onComplete }) {
  const sys = SYSTEMS[system];

  async function handleSaveDetail() {
    if (system === 'SII+TBAI') {
      const results = await Promise.allSettled([siiRef.current?.save(), tbaiRef.current?.save()]);
      if (results.every(r => r.status === 'fulfilled')) onApplied();
      return;
    }
    if (system === 'SII') { await siiRef.current?.save(); onApplied(); return; }
    if (system === 'TBAI') { await tbaiRef.current?.save(); onApplied(); return; }
    if (system === 'VERIFACTU') { await verifactuRef.current?.save(); onApplied(); }
  }

  return (
    <ScreenLayout
      toolbar={<PageHead selectedOrg={selectedOrg} orgList={orgList} onSelectOrg={onSelectOrg} ui={ui} />}
      actions={
        <>
          <Button variant="outline" onClick={onBack}>{ui('fiscal.onboarding.back')}</Button>
          <span className="flex-1" />
          <Button onClick={handleSaveDetail}>{ui('fiscal.onboarding.detail.saveapply')}</Button>
        </>
      }
    >
      <Breadcrumb items={[
        { label: ui('fiscal.onboarding.breadcrumb.fiscal'), onClick: onComplete },
        { label: sys?.name },
      ]} />
      <h2 className="text-xl font-bold tracking-tight mb-1">
        {sys?.name} <span className="text-lg font-normal text-muted-foreground">· {sys?.long}</span>
      </h2>
      <p className="text-sm text-muted-foreground mb-6">
        {system === 'SII'       && ui('fiscal.onboarding.detail.sii.desc')}
        {system === 'TBAI'      && ui('fiscal.onboarding.detail.tbai.desc')}
        {system === 'SII+TBAI'  && ui('fiscal.onboarding.detail.siitbai.desc')}
        {system === 'VERIFACTU' && ui('fiscal.onboarding.detail.verifactu.desc')}
      </p>

      {(system === 'SII' || system === 'SII+TBAI') && createdRecords.sii && (
        <>
          {system === 'SII+TBAI' && <div className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-4">{ui('fiscal.onboarding.detail.sii.header')}</div>}
          <SiiSection
            ref={siiRef}
            record={createdRecords.sii}
            apiBaseUrl={apiBaseUrl}
            orgId={orgId}
            onSave={() => {}}
            variant={selectedTerritory === 'navarra' ? 'sii-navarra' : 'sii'}
            hideSave
            hideCert={system === 'SII+TBAI'}
          />
        </>
      )}

      {system === 'SII+TBAI' && <div className="border-t my-8" />}

      {(system === 'TBAI' || system === 'SII+TBAI') && createdRecords.tbai && (
        <>
          {system === 'SII+TBAI' && <div className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-4">{ui('fiscal.onboarding.detail.tbai.header')}</div>}
          <TbaiSection
            ref={tbaiRef}
            record={createdRecords.tbai}
            apiBaseUrl={apiBaseUrl}
            orgId={orgId}
            onSave={() => {}}
            hideSave
            hideCert={system === 'SII+TBAI'}
          />
        </>
      )}

      {system === 'SII+TBAI' && (
        <CertSection context="sii" orgId={orgId} apiBaseUrl={apiBaseUrl} />
      )}

      {system === 'VERIFACTU' && createdRecords.verifactu && (
        <VerifactuSection
          ref={verifactuRef}
          record={createdRecords.verifactu}
          apiBaseUrl={apiBaseUrl}
          orgId={orgId}
          onSave={() => {}}
          hideSave
        />
      )}

      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
    </ScreenLayout>
  );
}

function ConfirmScreen({ resolvedSystem, selectedTerritory, alsoNational, volume, lowChoice, manualSystem, saving, error, orgName, selectedOrg, orgList, onSelectOrg, ui, SYSTEMS, TERRITORIES, goTo, onCreateRecords }) {
  const sys = SYSTEMS[resolvedSystem];
  const terr = TERRITORIES[selectedTerritory ?? ''];
  const prevStep = manualSystem ? 'manual' : (terr && (terr.askNational || terr.askVolume) ? 'subquestion' : 'territory');

  return (
    <ScreenLayout
      toolbar={<PageHead selectedOrg={selectedOrg} orgList={orgList} onSelectOrg={onSelectOrg} ui={ui} />}
      actions={
        <>
          <Button variant="outline" onClick={() => goTo(prevStep)} disabled={saving}>{ui('fiscal.onboarding.back')}</Button>
          <span className="flex-1" />
          <Button onClick={onCreateRecords} disabled={saving}>
            {saving ? ui('fiscal.onboarding.confirm.creating') : ui('fiscal.onboarding.confirm.btn')}
          </Button>
        </>
      }
    >
      <Breadcrumb items={[
        { label: ui('fiscal.onboarding.breadcrumb.territory'), onClick: () => goTo('territory') },
        { label: ui('fiscal.onboarding.breadcrumb.confirm') },
      ]} />

      <h2 className="text-xl font-bold tracking-tight mb-1">{ui('fiscal.onboarding.confirm.title')}</h2>
      <p className="text-sm text-muted-foreground mb-5">
        {ui('fiscal.onboarding.confirm.subtitle')}
      </p>

      <div className="bg-muted/40 border border-border rounded-xl px-5 py-2 divide-y divide-dashed divide-border text-sm mb-5">
        {terr && <Row k={ui('fiscal.onboarding.confirm.row.territory')} v={terr.name} />}
        {terr && <Row k={ui('fiscal.onboarding.confirm.row.hacienda')} v={terr.systemLong} />}
        {terr?.askNational && alsoNational !== null && (
          <Row k={ui('fiscal.onboarding.confirm.row.national')} v={alsoNational ? ui('fiscal.onboarding.confirm.row.national.yes') : ui('fiscal.onboarding.confirm.row.national.no')} />
        )}
        {terr?.askVolume && volume && (
          <Row k={ui('fiscal.onboarding.confirm.row.volume')} v={volume === 'high' ? ui('fiscal.onboarding.confirm.row.volume.high') : ui('fiscal.onboarding.confirm.row.volume.low')} />
        )}
        {volume === 'low' && lowChoice && (
          <Row k={ui('fiscal.onboarding.confirm.row.choice')} v={lowChoice === 'sii' ? ui('fiscal.onboarding.confirm.row.choice.sii') : ui('fiscal.onboarding.confirm.row.choice.verifactu')} />
        )}
        <Row k={ui('fiscal.onboarding.confirm.row.system')} v={`${sys?.name} — ${sys?.long}`} />
      </div>

      <div className="rounded-[10px] border border-blue-200 bg-blue-50 p-3 flex gap-2.5 text-sm text-blue-800 mb-6">
        <span className="flex-shrink-0 mt-0.5">ℹ</span>
        <div>
          <strong>{ui('fiscal.onboarding.confirm.next.title')}</strong>
          <p className="text-xs text-blue-700/80 mt-0.5">{ui('fiscal.onboarding.confirm.next.body')}</p>
        </div>
      </div>

      {error && <p className="mb-4 text-sm text-destructive">{error}</p>}
    </ScreenLayout>
  );
}

function ManualTerrCard({ territory, selected, onPick }) {
  const badgeColors = REGIME_BADGE[territory.regime];
  const badgeStyle = badgeColors
    ? { backgroundColor: badgeColors.bg, color: badgeColors.text }
    : { backgroundColor: 'hsl(var(--muted))', color: 'hsl(var(--muted-foreground))' };

  return (
    <button
      type="button"
      onClick={() => onPick(territory.id)}
      className={`relative flex flex-col text-left transition-all cursor-pointer rounded-xl
        ${selected ? 'border-2 border-[#121217]' : 'border border-[#E8EAEF] hover:bg-muted/40'}`}
      style={{
        minHeight: 80, padding: 16, gap: 12,
        boxShadow: selected
          ? '0 4px 16px rgba(18,18,23,0.14), 0 1px 3px rgba(18,18,23,0.08)'
          : '0 1px 2px rgba(18,18,23,0.05)',
      }}
    >
      <span
        className="absolute flex-shrink-0"
        style={{
          width: 15, height: 15, right: 8, top: 9, borderRadius: '50%',
          border: selected ? '1.5px solid #121217' : '1.5px solid #D1D4DB',
          background: selected
            ? 'radial-gradient(circle at center, #121217 40%, #FFFFFF 40%)'
            : '#FFFFFF',
          boxShadow: '0 1px 2px rgba(18,18,23,0.05)',
        }}
      />
      <div className="flex items-center min-w-0" style={{ gap: 4, paddingRight: 20 }}>
        <span className="text-sm font-medium truncate" style={{ color: '#121217' }}>{territory.name}</span>
        {territory.system && (
          <span style={badgeStyle} className="text-[10px] font-medium px-2 py-0.5 rounded-full flex-shrink-0 leading-none">
            {territory.system}
          </span>
        )}
      </div>
      {territory.example && (
        <div className="text-sm leading-6" style={{ color: '#555B6D' }}>{territory.example}</div>
      )}
    </button>
  );
}

function ManualScreen({ selectedTerritory, manualSystem, orgName, selectedOrg, orgList, onSelectOrg, ui, TERRITORIES, SYSTEMS, goTo, onSelectTerritory, onSetManualSystem }) {
  const manualAllowedSystems = getAllowedSystemsForTerritory(selectedTerritory);

  return (
    <ScreenLayout
      toolbar={<PageHead selectedOrg={selectedOrg} orgList={orgList} onSelectOrg={onSelectOrg} ui={ui} />}
      actions={
        <>
          <Button variant="outline" onClick={() => goTo('territory')} className="flex items-center gap-1.5">
            <ArrowLeft size={15} />{ui('fiscal.onboarding.back').replace('←', '').trim()}
          </Button>
          <span className="flex-1" />
          <Button
            onClick={() => goTo('confirm')}
            disabled={!selectedTerritory || !manualSystem}
            className="flex items-center gap-1.5"
          >
            {ui('fiscal.onboarding.continue').replace('›', '').trim()} <ArrowRight size={15} />
          </Button>
        </>
      }
    >
      <h2 className="font-semibold leading-8 mb-1" style={{ color: '#121217', fontSize: 18 }}>{ui('fiscal.onboarding.manual.title')}</h2>
      <p className="leading-4 mb-6" style={{ color: '#282833', fontSize: 12 }}>
        {ui('fiscal.onboarding.manual.subtitle')}
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Territorio */}
        <div className="grid" style={{ gridTemplateColumns: '148px 1fr', gap: 20 }}>
          <div className="text-sm font-semibold pt-1" style={{ color: '#121217' }}>
            {ui('fiscal.onboarding.manual.territory.header')}
          </div>
          <div className="grid grid-cols-3" style={{ gap: 20 }}>
            {Object.values(TERRITORIES).map(territory => (
              <ManualTerrCard
                key={territory.id}
                territory={territory}
                selected={selectedTerritory === territory.id}
                onPick={(territoryId) => onSelectTerritory(territoryId, { clearManualSystem: true })}
              />
            ))}
          </div>
        </div>

        <div style={{ height: 1, background: '#E8EAEF' }} />

        {/* Sistema fiscal */}
        <div className="grid" style={{ gridTemplateColumns: '148px 1fr', gap: 20 }}>
          <div className="text-sm font-semibold pt-1" style={{ color: '#121217' }}>
            {ui('fiscal.onboarding.manual.system.header')}
          </div>
          <div>
            {!selectedTerritory ? (
              <div className="rounded-xl border border-border bg-muted/20 p-4 text-sm" style={{ color: '#555B6D' }}>
                {ui('fiscal.onboarding.manual.system.placeholder')}
              </div>
            ) : (
              <div className="grid grid-cols-3" style={{ gap: 20 }}>
                {manualAllowedSystems.map(systemId => {
                  const sys = SYSTEMS[systemId];
                  const isSelected = manualSystem === sys.id;
                  return (
                    <button
                      key={sys.id}
                      type="button"
                      onClick={() => onSetManualSystem(sys.id)}
                      className={`relative flex flex-col text-left transition-all cursor-pointer rounded-xl
                        ${isSelected ? 'border-2 border-[#121217]' : 'border border-[#E8EAEF] hover:bg-muted/40'}`}
                      style={{
                        minHeight: 80, padding: 16, gap: 12,
                        boxShadow: isSelected
                          ? '0 4px 16px rgba(18,18,23,0.14), 0 1px 3px rgba(18,18,23,0.08)'
                          : '0 1px 2px rgba(18,18,23,0.05)',
                      }}
                    >
                      <span
                        className="absolute flex-shrink-0"
                        style={{
                          width: 15, height: 15, right: 8, top: 9, borderRadius: '50%',
                          border: isSelected ? '1.5px solid #121217' : '1.5px solid #D1D4DB',
                          background: isSelected
                            ? 'radial-gradient(circle at center, #121217 40%, #FFFFFF 40%)'
                            : '#FFFFFF',
                          boxShadow: '0 1px 2px rgba(18,18,23,0.05)',
                        }}
                      />
                      <span className="text-sm font-medium truncate pr-5" style={{ color: '#121217' }}>{sys.name}</span>
                      <span className="text-sm leading-6" style={{ color: '#555B6D' }}>{sys.long}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </ScreenLayout>
  );
}

function SubquestionScreen({ t, orgName, selectedOrg, orgList, onSelectOrg, alsoNational, volume, lowChoice, ui, goTo, onSetAlsoNational, onSetVolume, onSetLowChoice }) {
  const canContinueSubQ = t && (
    (t.askNational && alsoNational !== null) ||
    (t.askVolume && volume === 'high') ||
    (t.askVolume && volume === 'low' && lowChoice !== null)
  );

  if (!t) return null;

  return (
    <ScreenLayout
      toolbar={<PageHead selectedOrg={selectedOrg} orgList={orgList} onSelectOrg={onSelectOrg} ui={ui} />}
      actions={
        <>
          <Button variant="outline" onClick={() => goTo('territory')}>{ui('fiscal.onboarding.back')}</Button>
          <span className="flex-1" />
          <Button onClick={() => goTo('confirm')} disabled={!canContinueSubQ}>{ui('fiscal.onboarding.continue')}</Button>
        </>
      }
    >
      <Breadcrumb items={[
        { label: ui('fiscal.onboarding.breadcrumb.territory'), onClick: () => goTo('territory') },
        { label: ui('fiscal.onboarding.breadcrumb.details') },
      ]} />

      {t.askNational && (
        <>
          <h2 className="text-xl font-bold tracking-tight mb-1">{ui('fiscal.onboarding.subq.also.title')}</h2>
          <p className="text-sm text-muted-foreground mb-5">
            {ui('fiscal.onboarding.subq.also.subtitle', { territory: t.name })}
          </p>
          <div className="flex flex-col gap-2">
            <RadioRow checked={alsoNational === false} onClick={() => onSetAlsoNational(false)}
              label={ui('fiscal.onboarding.subq.tbai.label')}
              description={ui('fiscal.onboarding.subq.tbai.desc', { territory: t.name })} />
            <RadioRow checked={alsoNational === true} onClick={() => onSetAlsoNational(true)}
              label={ui('fiscal.onboarding.subq.sii.label')}
              description={ui('fiscal.onboarding.subq.sii.desc')} />
          </div>
        </>
      )}

      {t.askVolume && (
        <>
          <h2 className="text-xl font-bold tracking-tight mb-1">{ui('fiscal.onboarding.subq.volume.title')}</h2>
          <p className="text-sm text-muted-foreground mb-5">
            {ui('fiscal.onboarding.subq.volume.subtitle')}
          </p>
          <div className="flex flex-col gap-2">
            <RadioRow checked={volume === 'low'} onClick={() => onSetVolume('low')}
              label={ui('fiscal.onboarding.subq.volume.low.label')}
              description={ui('fiscal.onboarding.subq.volume.low.desc')} />
            <RadioRow checked={volume === 'high'} onClick={() => { onSetVolume('high'); onSetLowChoice(null); }}
              label={ui('fiscal.onboarding.subq.volume.high.label')}
              description={ui('fiscal.onboarding.subq.volume.high.desc')} />
          </div>

          {volume === 'low' && (
            <>
              <div className="h-px bg-border my-5" />
              <h3 className="text-base font-bold mb-1">{ui('fiscal.onboarding.subq.system.title')}</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {ui('fiscal.onboarding.subq.system.subtitle')}
              </p>
              <div className="flex flex-col gap-2">
                <RadioRow checked={lowChoice === 'verifactu'} onClick={() => onSetLowChoice('verifactu')}
                  label={ui('fiscal.onboarding.subq.verifactu.label')}
                  description={ui('fiscal.onboarding.subq.verifactu.desc')} />
                <RadioRow checked={lowChoice === 'sii'} onClick={() => onSetLowChoice('sii')}
                  label={ui('fiscal.onboarding.subq.sii.vol.label')}
                  description={ui('fiscal.onboarding.subq.sii.vol.desc')} />
              </div>
            </>
          )}
        </>
      )}
    </ScreenLayout>
  );
}

function TerritoryScreen({ selectedTerritory, selectedOrg, orgList, onSelectOrg, ui, TERRITORIES, TERRITORY_GROUPS, onPick, goTo, onGoToManual }) {
  const t = TERRITORIES[selectedTerritory];
  return (
    <ScreenLayout
      padContent={false}
      toolbar={
        <PageHead
          selectedOrg={selectedOrg}
          orgList={orgList}
          onSelectOrg={onSelectOrg}
          onGoToManual={onGoToManual}
          ui={ui}
        />
      }
      actions={
        <>
          <p className="text-xs flex-1" style={{ color: '#555B6D' }}>{ui('fiscal.skip.hint')}</p>
          <button
            type="button"
            onClick={() => goTo('skipped')}
            className="text-sm transition-colors"
            style={{ color: '#555B6D' }}
          >
            {ui('fiscal.onboarding.skip')}
          </button>
          <Button
            onClick={() => {
              if (t && (t.askNational || t.askVolume)) goTo('subquestion');
              else goTo('confirm');
            }}
            disabled={!selectedTerritory}
          >
            {ui('fiscal.onboarding.continue')}
          </Button>
        </>
      }
    >
      {/* Wizard header — 80px, padding 8px 20px, align-items: center per Figma */}
      <div
        className="flex items-center justify-between"
        style={{ minHeight: 80, padding: '8px 20px', gap: 10 }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <h2 className="font-semibold leading-8" style={{ color: '#121217', fontSize: 18 }}>
            {ui('fiscal.onboarding.territory.title')}
          </h2>
          <p className="text-xs leading-4" style={{ color: '#282833' }}>
            {ui('fiscal.onboarding.territory.subtitle')}
          </p>
        </div>
        <Stepper step={1} ui={ui} />
      </div>

      {/* Territory groups — flex-col gap:20px per Figma spec; separators are sibling flex children */}
      <div style={{ display: 'flex', flexDirection: 'column', padding: '12px 0px', gap: 20 }}>
        {TERRITORY_GROUPS.flatMap(({ regime, label, desc, items }, idx) => [
          ...(idx > 0 ? [
            <div key={`sep-${regime}`} style={{ height: 1, background: '#E8EAEF', margin: '0 20px' }} />,
          ] : []),
          <div key={regime} className="grid" style={{ gridTemplateColumns: '148px 1fr', gap: 20, padding: '8px 20px 12px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div className="text-sm font-semibold" style={{ color: '#121217' }}>{label}</div>
              <div className="text-xs" style={{ color: '#282833', lineHeight: '16px' }}>{desc}</div>
            </div>
            <div className="grid grid-cols-3" style={{ gap: 20 }}>
              {items.map(id => (
                <TerrCard
                  key={id}
                  territory={TERRITORIES[id]}
                  selected={selectedTerritory === id}
                  onPick={onPick}
                />
              ))}
            </div>
          </div>,
        ])}
      </div>
    </ScreenLayout>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function OnboardingWizard({ apiBaseUrl, onComplete, onGoHome }) {
  const ui = useUI();
  const { locale } = useLocaleSwitch();
  const { selectedOrg, selectedRole, selectOrg } = useAuth();
  const orgId = selectedOrg?.id ?? null;
  const orgName = selectedOrg?.name ?? null;
  const orgList = selectedRole?.orgList ?? [];
  const apiFetch = useApiFetch(neoBase(apiBaseUrl));

  function handleSelectOrg(org) {
    selectOrg(org);
    onComplete();
  }

  const TERRITORIES = {
    navarra:  { ...TERRITORY_META.navarra,  name: ui('fiscal.territory.navarra'),  system: ui('fiscal.territory.system.sii'),    systemLong: ui('fiscal.territory.navarra.systemLong'),  example: ui('fiscal.territory.navarra.example')  },
    alava:    { ...TERRITORY_META.alava,    name: ui('fiscal.territory.alava'),    system: ui('fiscal.territory.system.tbai'),   systemLong: ui('fiscal.territory.alava.systemLong'),    example: ui('fiscal.territory.alava.example')    },
    bizkaia:  { ...TERRITORY_META.bizkaia,  name: ui('fiscal.territory.bizkaia'),  system: ui('fiscal.territory.system.tbai'),   systemLong: ui('fiscal.territory.bizkaia.systemLong'),  example: ui('fiscal.territory.bizkaia.example')  },
    gipuzkoa: { ...TERRITORY_META.gipuzkoa, name: ui('fiscal.territory.gipuzkoa'), system: ui('fiscal.territory.system.tbai'),   systemLong: ui('fiscal.territory.gipuzkoa.systemLong'), example: ui('fiscal.territory.gipuzkoa.example') },
    baleares: { ...TERRITORY_META.baleares, name: ui('fiscal.territory.espania'),  system: ui('fiscal.territory.system.siiver'), systemLong: ui('fiscal.territory.baleares.systemLong'), example: ui('fiscal.territory.baleares.example') },
    canarias: { ...TERRITORY_META.canarias, name: ui('fiscal.territory.canarias'), system: ui('fiscal.territory.system.siiver'), systemLong: ui('fiscal.territory.canarias.systemLong'), example: ui('fiscal.territory.canarias.example') },
    ceuta:    { ...TERRITORY_META.ceuta,    name: ui('fiscal.territory.ceuta'),    system: ui('fiscal.territory.system.siiver'), systemLong: ui('fiscal.territory.ceuta.systemLong'),    example: ui('fiscal.territory.ceuta.example')    },
  };

  const TERRITORY_GROUPS = TERRITORY_GROUP_META.map(g => ({
    ...g,
    label: ui(`fiscal.territory.group.${g.regime === 'sii_foral' ? 'sii' : g.regime}.label`),
    desc:  ui(`fiscal.territory.group.${g.regime === 'sii_foral' ? 'sii' : g.regime}.desc`),
  }));

  const SYSTEMS = {
    SII:       { id: 'SII',       name: 'SII',        long: ui('fiscal.system.sii.long'),      desc: ui('fiscal.system.sii.desc')      },
    TBAI:      { id: 'TBAI',      name: 'TBAI',       long: ui('fiscal.system.tbai.long'),     desc: ui('fiscal.system.tbai.desc')     },
    'SII+TBAI':{ id: 'SII+TBAI',  name: 'SII + TBAI', long: ui('fiscal.system.siitbai.long'),  desc: ui('fiscal.system.siitbai.desc')  },
    VERIFACTU: { id: 'VERIFACTU', name: 'Verifactu',  long: ui('fiscal.system.verifactu.long'), desc: ui('fiscal.system.verifactu.desc') },
  };

  const [step, setStep]                   = useState('territory');
  const [selectedTerritory, setSelectedTerritory] = useState(null);
  const [manualSystem, setManualSystem]   = useState(null);
  const [alsoNational, setAlsoNational]   = useState(null);
  const [volume, setVolume]               = useState(null);
  const [lowChoice, setLowChoice]         = useState(null);
  const [system, setSystem]               = useState(null);
  const [createdRecords, setCreatedRecords] = useState({});
  const [saving, setSaving]               = useState(false);
  const [error, setError]                 = useState(null);

  const siiRef      = useRef(null);
  const tbaiRef     = useRef(null);
  const verifactuRef = useRef(null);

  function goTo(s) { setStep(s); setError(null); }

  function handleTerritorySelection(territoryId, { clearManualSystem = false } = {}) {
    const changed = selectedTerritory !== territoryId;
    setSelectedTerritory(territoryId);
    if (changed) {
      setAlsoNational(null);
      setVolume(null);
      setLowChoice(null);
      if (clearManualSystem) setManualSystem(null);
    }
  }

  const t = TERRITORIES[selectedTerritory];
  const resolvedSystem = manualSystem ?? resolveSystem({ regime: t?.regime ?? null, alsoNational, volume, lowChoice });

  async function createRecords() {
    const sys = resolvedSystem;
    const terrId = selectedTerritory;
    setSaving(true);
    setError(null);
    try {
      const org = { adOrgId: orgId };
      const records = {};
      const payloads = buildOnboardingPayloads(sys, terrId);

      if (payloads.sii) {
        records.sii = await createAndFetchRecord({ specName: 'sii-config', entityName: SII_ENTITY, body: { ...org, ...payloads.sii }, apiFetch, system: 'SII' });
      }
      if (payloads.tbai) {
        records.tbai = await createAndFetchRecord({ specName: 'tbai-config', entityName: TBAI_ENTITY, body: { ...org, ...payloads.tbai }, apiFetch, system: 'TBAI' });
      }
      if (payloads.verifactu) {
        records.verifactu = await createAndFetchRecord({ specName: 'verifactu-config', entityName: VERIFACTU_ENTITY, body: { ...org, ...payloads.verifactu }, apiFetch, system: 'VERIFACTU' });
      }
      setCreatedRecords(records);
      setSystem(sys);
      goTo('detail');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const shared = { orgName, selectedOrg, orgList, onSelectOrg: handleSelectOrg, ui, TERRITORIES, SYSTEMS, goTo };

  if (step === 'skipped') return <SkippedScreen {...shared} onGoHome={onGoHome} onComplete={onComplete} />;

  if (step === 'applied') return (
    <AppliedScreen {...shared} orgId={orgId} system={system} selectedTerritory={selectedTerritory}
      alsoNational={alsoNational} volume={volume} lowChoice={lowChoice}
      apiBaseUrl={apiBaseUrl} apiFetch={apiFetch} locale={locale}
      onComplete={onComplete} onGoHome={onGoHome} />
  );

  if (step === 'detail') return (
    <DetailScreen {...shared} orgId={orgId} system={system} selectedTerritory={selectedTerritory}
      createdRecords={createdRecords} apiBaseUrl={apiBaseUrl} error={error}
      siiRef={siiRef} tbaiRef={tbaiRef} verifactuRef={verifactuRef}
      onBack={() => goTo('confirm')} onApplied={() => goTo('applied')} onComplete={onComplete} />
  );

  if (step === 'confirm') return (
    <ConfirmScreen {...shared} resolvedSystem={resolvedSystem} selectedTerritory={selectedTerritory}
      alsoNational={alsoNational} volume={volume} lowChoice={lowChoice} manualSystem={manualSystem}
      saving={saving} error={error} TERRITORY_GROUPS={TERRITORY_GROUPS}
      onCreateRecords={createRecords} />
  );

  if (step === 'manual') return (
    <ManualScreen {...shared} selectedTerritory={selectedTerritory} manualSystem={manualSystem}
      TERRITORY_GROUPS={TERRITORY_GROUPS}
      onSelectTerritory={handleTerritorySelection} onSetManualSystem={setManualSystem} />
  );

  if (step === 'subquestion') return (
    <SubquestionScreen {...shared} t={t} alsoNational={alsoNational} volume={volume} lowChoice={lowChoice}
      onSetAlsoNational={setAlsoNational} onSetVolume={setVolume} onSetLowChoice={setLowChoice} />
  );

  return (
    <TerritoryScreen {...shared} selectedTerritory={selectedTerritory} TERRITORY_GROUPS={TERRITORY_GROUPS}
      onPick={handleTerritorySelection}
      onGoToManual={() => { setManualSystem(null); goTo('manual'); }}
    />
  );
}

// ── Shared layout atoms ───────────────────────────────────────────────────────

function Row({ k, v }) {
  return (
    <div className="flex justify-between gap-4 py-2.5 text-sm">
      <span className="text-muted-foreground">{k}</span>
      <span className="font-medium text-right">{v}</span>
    </div>
  );
}

function NextItem({ icon, title, desc, badge, done, onClick }) {
  return (
    <button type="button" onClick={onClick}
      className={`flex items-center gap-3 p-3.5 border rounded-[10px] hover:bg-muted/40 transition-colors text-left w-full
        ${done ? 'bg-green-50 border-green-200' : 'bg-background border-border'}`}>
      <span className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-sm
        ${done ? 'bg-green-100 text-green-700' : 'bg-muted text-foreground/60'}`}>
        {done ? '✓' : icon}
      </span>
      <span className="flex-1">
        <span className="flex items-center gap-2">
          <span className={`text-sm font-semibold ${done ? 'text-green-800' : ''}`}>{title}</span>
          {badge && !done && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 leading-none">{badge}</span>
          )}
        </span>
        <span className="block text-xs text-muted-foreground mt-0.5">{desc}</span>
      </span>
      <span className="text-muted-foreground text-xs">›</span>
    </button>
  );
}
