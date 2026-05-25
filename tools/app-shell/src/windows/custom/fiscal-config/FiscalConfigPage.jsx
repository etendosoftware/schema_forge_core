import { useState, useRef } from 'react';
import { RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@schema-forge/app-shell-core';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { useUI } from '@schema-forge/app-shell-core';
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
import CertSection from './CertSection.jsx';
import FiscalConfigDebugPanel from './FiscalConfigDebugPanel.jsx';

export default function FiscalConfigPage({ token, apiBaseUrl }) {
  const ui = useUI();
  const navigate = useNavigate();
  const { selectedOrg } = useAuth();
  const orgId = selectedOrg?.id ?? null;
  const debugMode = useDebugMode();

  useSetPageMeta({ title: ui('fiscal.title'), breadcrumb: `${ui('settings')} / ${ui('fiscal.monitor.nav')} / ${ui('fiscal.title')}` });

  // mockOverride = null | { key, sii, tbai, verifactu }  (set by debug panel)
  const [mockOverride, setMockOverride] = useState(null);
  const [mockCertDays, setMockCertDays] = useState(null);

  const {
    loading, error, profile,
    siiRecord, tbaiRecord, verifactuRecord,
    refetch,
  } = useFiscalConfig(orgId, apiBaseUrl);

  // When mock is active, bypass API result entirely
  const effectiveProfile = mockOverride
    ? detectProfile(mockOverride.sii, mockOverride.tbai, mockOverride.verifactu)
    : profile;
  const effectiveSii      = mockOverride ? mockOverride.sii      : siiRecord;
  const effectiveTbai     = mockOverride ? mockOverride.tbai     : tbaiRecord;
  const effectiveVerifactu= mockOverride ? mockOverride.verifactu: verifactuRecord;

  const { daysLeft: certDaysLeft } = useCertExpiry(apiBaseUrl, { mockDaysLeft: mockCertDays, orgId });

  const siiRef  = useRef(null);
  const tbaiRef = useRef(null);
  const [combinedSaving, setCombinedSaving] = useState(false);
  const [siiError, setSiiError]   = useState(null);
  const [tbaiError, setTbaiError] = useState(null);

  async function handleCombinedSave() {
    setCombinedSaving(true);
    setSiiError(null);
    setTbaiError(null);
    const results = await Promise.allSettled([
      siiRef.current?.save(),
      tbaiRef.current?.save(),
    ]);
    if (results[0].status === 'rejected') setSiiError(results[0].reason?.message ?? ui('fiscal.sii.error', { error: '' }));
    if (results[1].status === 'rejected') setTbaiError(results[1].reason?.message ?? ui('fiscal.tbai.error', { error: '' }));
    if (results.every(r => r.status === 'fulfilled')) refetch();
    setCombinedSaving(false);
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

  // All other states: scrollable content with a standard header.
  return (
    <>
      {DebugPanel}
    <div className="relative h-full overflow-y-auto">
      <div className="px-6 py-8">
        {orgId && (
          <div className="mb-6 flex items-start justify-between">
            <div>
              <h1 className="text-xl font-bold">{ui('fiscal.title')}</h1>
              {selectedOrg?.name && (
                <p className="text-sm text-muted-foreground mt-1">{ui('fiscal.org.label', { name: selectedOrg.name })}</p>
              )}
            </div>
            <button
              type="button"
              onClick={refetch}
              disabled={loading}
              aria-label={ui('fiscalMonitor.refresh')}
              title={ui('fiscalMonitor.refresh')}
              className="mt-1 p-2 rounded-lg border border-[#D1D4DB] bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin text-gray-400' : 'text-gray-500'} />
            </button>
          </div>
        )}

        <CertExpiryBanner daysLeft={certDaysLeft} variant="prominent" />

        {!orgId && !mockOverride && (
          <p className="text-sm text-muted-foreground text-center py-12">
            {ui('fiscal.noOrg')}
          </p>
        )}

        {showLoading && (
          <div className="space-y-4">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-8 w-1/2" />
          </div>
        )}

        {showError && (
          <div className="rounded-lg border border-destructive bg-destructive/10 p-4">
            <p className="text-sm text-destructive">{ui('fiscal.loadError', { error })}</p>
            <Button variant="link" onClick={refetch} className="mt-2 h-auto p-0">
              {ui('fiscal.retry')}
            </Button>
          </div>
        )}

        {showContent && effectiveProfile === 'conflict' && (
          <div className="rounded-lg border border-destructive bg-destructive/10 p-6">
            <h2 className="font-semibold text-destructive">{ui('fiscal.conflict.title')}</h2>
            <p className="text-sm text-muted-foreground mt-2">{ui('fiscal.conflict.body')}</p>
          </div>
        )}

        {showContent && effectiveProfile === 'sii' && (
          <SiiSection
            record={effectiveSii}
            apiBaseUrl={apiBaseUrl}
            orgId={orgId}
            onSave={refetch}
            variant="sii"
          />
        )}

        {showContent && effectiveProfile === 'sii-navarra' && (
          <SiiSection
            record={effectiveSii}
            apiBaseUrl={apiBaseUrl}
            orgId={orgId}
            onSave={refetch}
            variant="sii-navarra"
          />
        )}

        {showContent && effectiveProfile === 'sii+tbai' && (
          <div className="space-y-10">
            <SiiSection
              ref={siiRef}
              record={effectiveSii}
              apiBaseUrl={apiBaseUrl}
              orgId={orgId}
              onSave={() => {}}
              variant="sii"
              hideSave
              hideCert
            />
            {siiError && <p className="text-sm text-destructive">{ui('fiscal.sii.error', { error: siiError })}</p>}

            <div className="border-t pt-8">
              <TbaiSection
                ref={tbaiRef}
                record={effectiveTbai}
                apiBaseUrl={apiBaseUrl}
                orgId={orgId}
                onSave={() => {}}
                hideSave
                hideCert
              />
              {tbaiError && <p className="text-sm text-destructive">{ui('fiscal.tbai.error', { error: tbaiError })}</p>}
            </div>

            <CertSection context="sii" orgId={orgId} apiBaseUrl={apiBaseUrl} />

            <Button onClick={handleCombinedSave} disabled={combinedSaving}>
              {combinedSaving ? ui('fiscal.saving') : ui('fiscal.save')}
            </Button>
          </div>
        )}

        {showContent && effectiveProfile === 'tbai' && (
          <TbaiSection
            record={effectiveTbai}
            apiBaseUrl={apiBaseUrl}
            orgId={orgId}
            onSave={refetch}
          />
        )}

        {showContent && effectiveProfile === 'verifactu' && (
          <VerifactuSection
            record={effectiveVerifactu}
            apiBaseUrl={apiBaseUrl}
            orgId={orgId}
            onSave={refetch}
          />
        )}
      </div>
    </div>
    </>
  );
}
