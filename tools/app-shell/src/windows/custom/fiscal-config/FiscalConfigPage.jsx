import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext.jsx';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useUI } from '@/i18n';
import { useFiscalConfig } from './useFiscalConfig.js';
import OnboardingWizard from './OnboardingWizard.jsx';
import SiiSection from './SiiSection.jsx';
import TbaiSection from './TbaiSection.jsx';
import VerifactuSection from './VerifactuSection.jsx';
import CertSection from './CertSection.jsx';

export default function FiscalConfigPage({ token, apiBaseUrl }) {
  const ui = useUI();
  const navigate = useNavigate();
  const { selectedOrg } = useAuth();
  const orgId = selectedOrg?.id ?? null;

  const {
    loading, error, profile,
    siiRecord, tbaiRecord, verifactuRecord,
    refetch,
  } = useFiscalConfig(orgId, token, apiBaseUrl);

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

  function WipBadge() {
    return (
      <div className="absolute top-3 right-4 z-10">
        <TooltipProvider delayDuration={600}>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300 cursor-default select-none">
                ⚠ {ui('fiscal.wip.badge')}
              </span>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-[260px] text-center">
              {ui('fiscal.wip.tooltip')}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    );
  }

  // Wizard needs the full height of the card — render it without any outer wrapper.
  if (orgId && !loading && !error && profile === 'unconfigured') {
    return (
      <div className="relative h-full overflow-hidden">
        <WipBadge />
        <OnboardingWizard
          orgId={orgId}
          orgName={selectedOrg?.name}
          token={token}
          apiBaseUrl={apiBaseUrl}
          onComplete={refetch}
          onGoHome={() => navigate('/dashboard')}
        />
      </div>
    );
  }

  // All other states: scrollable content with a standard header.
  return (
    <div className="relative h-full overflow-y-auto">
      <WipBadge />
      <div className="px-6 py-8">
        {orgId && (
          <div className="mb-6">
            <h1 className="text-xl font-bold">{ui('fiscal.title')}</h1>
            {selectedOrg?.name && (
              <p className="text-sm text-muted-foreground mt-1">{ui('fiscal.org.label', { name: selectedOrg.name })}</p>
            )}
          </div>
        )}

        {!orgId && (
          <p className="text-sm text-muted-foreground text-center py-12">
            {ui('fiscal.noOrg')}
          </p>
        )}

        {loading && (
          <div className="space-y-4">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-8 w-1/2" />
          </div>
        )}

        {!loading && error && (
          <div className="rounded-lg border border-destructive bg-destructive/10 p-4">
            <p className="text-sm text-destructive">{ui('fiscal.loadError', { error })}</p>
            <Button variant="link" onClick={refetch} className="mt-2 h-auto p-0">
              {ui('fiscal.retry')}
            </Button>
          </div>
        )}

        {!loading && !error && profile === 'conflict' && (
          <div className="rounded-lg border border-destructive bg-destructive/10 p-6">
            <h2 className="font-semibold text-destructive">{ui('fiscal.conflict.title')}</h2>
            <p className="text-sm text-muted-foreground mt-2">{ui('fiscal.conflict.body')}</p>
          </div>
        )}

        {!loading && !error && profile === 'sii' && (
          <SiiSection
            record={siiRecord}
            token={token}
            apiBaseUrl={apiBaseUrl}
            orgId={orgId}
            onSave={refetch}
            variant="sii"
          />
        )}

        {!loading && !error && profile === 'sii-navarra' && (
          <SiiSection
            record={siiRecord}
            token={token}
            apiBaseUrl={apiBaseUrl}
            orgId={orgId}
            onSave={refetch}
            variant="sii-navarra"
          />
        )}

        {!loading && !error && profile === 'sii+tbai' && (
          <div className="space-y-10">
            <SiiSection
              ref={siiRef}
              record={siiRecord}
              token={token}
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
                record={tbaiRecord}
                token={token}
                apiBaseUrl={apiBaseUrl}
                orgId={orgId}
                onSave={() => {}}
                hideSave
                hideCert
              />
              {tbaiError && <p className="text-sm text-destructive">{ui('fiscal.tbai.error', { error: tbaiError })}</p>}
            </div>

            <CertSection context="sii" orgId={orgId} token={token} apiBaseUrl={apiBaseUrl} />

            <Button onClick={handleCombinedSave} disabled={combinedSaving}>
              {combinedSaving ? ui('fiscal.saving') : ui('fiscal.save')}
            </Button>
          </div>
        )}

        {!loading && !error && profile === 'tbai' && (
          <TbaiSection
            record={tbaiRecord}
            token={token}
            apiBaseUrl={apiBaseUrl}
            orgId={orgId}
            onSave={refetch}
          />
        )}

        {!loading && !error && profile === 'verifactu' && (
          <VerifactuSection
            record={verifactuRecord}
            token={token}
            apiBaseUrl={apiBaseUrl}
            orgId={orgId}
            onSave={refetch}
          />
        )}
      </div>
    </div>
  );
}
