import { useState, useRef } from 'react';
import { ChevronDown, Save } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext.jsx';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { useUI } from '@/i18n';
import { useSetPageMeta } from '@/components/layout/PageMetaContext';
import { useFiscalConfig } from './useFiscalConfig.js';
import { detectProfile } from './fiscalConfig.utils.js';
import { useCertExpiry } from './useCertExpiry.js';
import { useDebugMode } from '../fiscal-monitor/useDebugMode.js';
import CertExpiryBanner from './CertExpiryBanner.jsx';
import OnboardingWizard from './OnboardingWizard.jsx';
import SiiSection from './SiiSection.jsx';
import TbaiSection from './TbaiSection.jsx';
import VerifactuSection from './VerifactuSection.jsx';
import FiscalConfigDebugPanel from './FiscalConfigDebugPanel.jsx';
import TabBar from './TabBar.jsx';

// ── Org avatar color (mirrors OnboardingWizard) ────────────────────────────────

const ORG_COLORS = ['bg-red-500', 'bg-blue-500', 'bg-green-600', 'bg-orange-500', 'bg-purple-500', 'bg-teal-500'];

function orgAvatarColor(name) {
  return ORG_COLORS[(name?.charCodeAt(0) ?? 0) % ORG_COLORS.length];
}

// ── OrgDropdown ────────────────────────────────────────────────────────────────

function OrgDropdown({ selectedOrg, orgList, onSelect }) {
  const [open, setOpen] = useState(false);
  const filtered = (orgList || []).filter(o => o.name !== '*');

  if (!selectedOrg) return null;
  const initial = selectedOrg.name?.[0]?.toUpperCase() ?? '?';
  const avatarColor = orgAvatarColor(selectedOrg.name);
  const canSwitch = filtered.length > 1;

  return (
    <div className="relative">
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

// ── FiscalConfigPage ───────────────────────────────────────────────────────────

export default function FiscalConfigPage({ token, apiBaseUrl }) {
  const ui = useUI();
  const navigate = useNavigate();
  const { selectedOrg, selectedRole, selectOrg } = useAuth();
  const orgId = selectedOrg?.id ?? null;
  const orgList = selectedRole?.orgList ?? [];
  const debugMode = useDebugMode();

  // mockOverride = null | { key, sii, tbai, verifactu }  (set by debug panel)
  const [mockOverride, setMockOverride] = useState(null);
  const [mockCertDays, setMockCertDays] = useState(null);
  const [activeTab, setActiveTab] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [savedOk, setSavedOk] = useState(false);
  const [resetKey, setResetKey] = useState(0);

  const {
    loading, error, profile,
    siiRecord, tbaiRecord, verifactuRecord,
    refetch,
  } = useFiscalConfig(orgId, apiBaseUrl);

  // When mock is active, bypass API result entirely
  const effectiveProfile  = mockOverride
    ? detectProfile(mockOverride.sii, mockOverride.tbai, mockOverride.verifactu)
    : profile;

  const PROFILE_LABEL = { sii: 'SII', 'sii-navarra': 'SII', 'sii+tbai': 'SII + TBAI', tbai: 'TBAI', verifactu: 'VERI*FACTU' };
  const profileLabel = PROFILE_LABEL[effectiveProfile] ?? null;
  const pageTitle = profileLabel ? `${ui('fiscal.title')} ${profileLabel}` : ui('fiscal.title');
  useSetPageMeta({ title: pageTitle, breadcrumb: `${ui('settings')} / ${ui('fiscal.monitor.nav')} / ${pageTitle}` });
  const effectiveSii       = mockOverride ? mockOverride.sii       : siiRecord;
  const effectiveTbai      = mockOverride ? mockOverride.tbai      : tbaiRecord;
  const effectiveVerifactu = mockOverride ? mockOverride.verifactu : verifactuRecord;

  const { daysLeft: certDaysLeft } = useCertExpiry(apiBaseUrl, { mockDaysLeft: mockCertDays, orgId });

  const siiRef       = useRef(null);
  const tbaiRef      = useRef(null);
  const verifactuRef = useRef(null);

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    setSavedOk(false);
    try {
      if (['sii', 'sii-navarra'].includes(effectiveProfile)) {
        await siiRef.current?.save();
      } else if (effectiveProfile === 'tbai') {
        await tbaiRef.current?.save();
      } else if (effectiveProfile === 'verifactu') {
        await verifactuRef.current?.save();
      } else if (effectiveProfile === 'sii+tbai') {
        const [r0, r1] = await Promise.allSettled([
          siiRef.current?.save(),
          tbaiRef.current?.save(),
        ]);
        if (r0.status === 'rejected' || r1.status === 'rejected') {
          throw new Error(r0.reason?.message ?? r1.reason?.message ?? 'Error saving');
        }
      }
      refetch();
      setResetKey(k => k + 1);
      setSavedOk(true);
      setTimeout(() => setSavedOk(false), 2500);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    navigate(-1);
  }

  const DebugPanel = debugMode ? (
    <FiscalConfigDebugPanel
      orgId={orgId}
      token={token}
      apiBaseUrl={apiBaseUrl}
      onDeleted={refetch}
      onSetMock={setMockOverride}
      activeMockKey={mockOverride?.key ?? null}
      mockCertDays={mockCertDays}
      onSetCertDays={setMockCertDays}
    />
  ) : null;

  // When mock is active, skip loading/error entirely and go straight to the effective profile
  const showLoading  = !mockOverride && loading;
  const showError    = !mockOverride && !loading && error;
  const showContent  = mockOverride || (!loading && !error);

  // Wizard needs the full height of the card — render it without any outer wrapper.
  if ((orgId || mockOverride) && !showLoading && !showError && effectiveProfile === 'unconfigured') {
    return (
      <>
        {DebugPanel}
        <div className="relative h-full overflow-hidden">
          <OnboardingWizard
            apiBaseUrl={apiBaseUrl}
            onComplete={refetch}
            onGoHome={() => navigate('/dashboard')}
          />
        </div>
      </>
    );
  }

  // ── Org bar ──────────────────────────────────────────────────────────────────
  const orgBar = (
    <div className="flex-shrink-0 border-b border-[#E8EAEF]">
      <div className="flex items-center justify-between px-6 h-[56px]">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-[#121217]">{ui('fiscal.onboarding.org.label')}</span>
          <OrgDropdown
            selectedOrg={selectedOrg}
            orgList={orgList}
            onSelect={org => selectOrg(org)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleCancel} disabled={saving}>
            {ui('fiscal.cancel')}
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || !orgId}
            className={savedOk ? 'bg-green-600 hover:bg-green-700 border-green-600' : ''}
          >
            <Save size={14} className="mr-1.5" />
            {saving ? ui('fiscal.saving') : savedOk ? `✓ ${ui('fiscal.save')}` : ui('fiscal.save')}
          </Button>
        </div>
      </div>
      {saveError && (
        <div className="flex items-center justify-between px-6 py-2 bg-destructive/10 border-t border-destructive/20 text-sm text-destructive">
          <span>{saveError}</span>
          <button type="button" onClick={() => setSaveError(null)} className="ml-4 hover:opacity-70">✕</button>
        </div>
      )}
    </div>
  );

  return (
    <>
      {DebugPanel}
      <div className="relative h-full flex flex-col overflow-hidden">
        {orgBar}

        {!orgId && !mockOverride && (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-sm text-muted-foreground text-center py-12">
              {ui('fiscal.noOrg')}
            </p>
          </div>
        )}

        {showLoading && (
          <div className="flex-1 px-6 py-8 space-y-4">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-8 w-1/2" />
          </div>
        )}

        {showError && (
          <div className="flex-1 px-6 py-8">
            <div className="rounded-lg border border-destructive bg-destructive/10 p-4">
              <p className="text-sm text-destructive">{ui('fiscal.loadError', { error })}</p>
              <Button variant="link" onClick={refetch} className="mt-2 h-auto p-0">
                {ui('fiscal.retry')}
              </Button>
            </div>
          </div>
        )}

        {showContent && effectiveProfile === 'conflict' && (
          <div className="flex-1 px-6 py-8">
            <div className="rounded-lg border border-destructive bg-destructive/10 p-6">
              <h2 className="font-semibold text-destructive">{ui('fiscal.conflict.title')}</h2>
              <p className="text-sm text-muted-foreground mt-2">{ui('fiscal.conflict.body')}</p>
            </div>
          </div>
        )}

        {/* SII / SII-Navarra — no tabs */}
        {showContent && ['sii', 'sii-navarra'].includes(effectiveProfile) && (
          <div className="flex-1 overflow-y-auto">
            <div className="px-6 py-6">
              <SiiSection
                key={resetKey}
                ref={siiRef}
                record={effectiveSii}
                apiBaseUrl={apiBaseUrl}
                orgId={orgId}
                onSave={() => {}}
                variant={effectiveProfile}
                hideSave
              />
              <CertExpiryBanner daysLeft={certDaysLeft} variant="prominent" />
            </div>
          </div>
        )}

        {/* SII + TBAI — with tabs */}
        {showContent && effectiveProfile === 'sii+tbai' && (
          <>
            <TabBar
              tabs={[ui('fiscal.tab.sii'), ui('fiscal.tab.tbai')]}
              active={activeTab}
              onChange={setActiveTab}
            />
            <div className="flex-1 overflow-y-auto">
              <div className="px-6 py-6">
                {activeTab === 0 && (
                  <SiiSection
                    key={`sii-${resetKey}`}
                    ref={siiRef}
                    record={effectiveSii}
                    apiBaseUrl={apiBaseUrl}
                    orgId={orgId}
                    onSave={() => {}}
                    variant="sii"
                    hideSave
                  />
                )}
                {activeTab === 1 && (
                  <TbaiSection
                    key={`tbai-${resetKey}`}
                    ref={tbaiRef}
                    record={effectiveTbai}
                    apiBaseUrl={apiBaseUrl}
                    orgId={orgId}
                    onSave={() => {}}
                    hideSave
                    hideCert
                  />
                )}
                <CertExpiryBanner daysLeft={certDaysLeft} variant="prominent" />
                {/* errors are shown in the org bar */}
              </div>
            </div>
          </>
        )}

        {/* TBAI — no tabs */}
        {showContent && effectiveProfile === 'tbai' && (
          <div className="flex-1 overflow-y-auto">
            <div className="px-6 py-6">
              <TbaiSection
                key={resetKey}
                ref={tbaiRef}
                record={effectiveTbai}
                apiBaseUrl={apiBaseUrl}
                orgId={orgId}
                onSave={() => {}}
                hideSave
              />
              <CertExpiryBanner daysLeft={certDaysLeft} variant="prominent" />
              {/* errors are shown in the org bar */}
            </div>
          </div>
        )}

        {/* Verifactu — no tabs */}
        {showContent && effectiveProfile === 'verifactu' && (
          <div className="flex-1 overflow-y-auto">
            <div className="px-6 py-6">
              <VerifactuSection
                key={resetKey}
                ref={verifactuRef}
                record={effectiveVerifactu}
                apiBaseUrl={apiBaseUrl}
                orgId={orgId}
                onSave={() => {}}
                hideSave
              />
              <CertExpiryBanner daysLeft={certDaysLeft} variant="prominent" />
              {/* errors are shown in the org bar */}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
