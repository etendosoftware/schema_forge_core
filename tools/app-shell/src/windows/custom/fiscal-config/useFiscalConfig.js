import { useState, useEffect, useCallback } from 'react';
import { detectProfile } from './fiscalConfig.utils.js';
import { neoBase } from '@/components/related-documents/helpers.js';
import { useApiFetch } from '@/auth/useApiFetch.js';

// Confirmed from artifacts/*/contract.json → backendContract.window.primaryEntity
const SII_ENTITY = 'siiConfiguration';
const TBAI_ENTITY = 'header';
const VERIFACTU_ENTITY = 'cabeceraDeConfiguraciónVerifactu';

async function fetchRecord(apiFetch, specName, entityName, orgId) {
  const params = new URLSearchParams({ organization: orgId, _limit: '1' });
  const res = await apiFetch(`/${specName}/${entityName}?${params}`, {
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error(`Failed to load ${specName}: HTTP ${res.status}`);
  const json = await res.json();
  return json?.response?.data?.[0] ?? null;
}

export function useFiscalConfig(orgId, apiBaseUrl) {
  const apiFetch = useApiFetch(neoBase(apiBaseUrl));
  const [state, setState] = useState({
    loading: false,
    error: null,
    profile: null,
    siiRecord: null,
    tbaiRecord: null,
    verifactuRecord: null,
  });

  const load = useCallback(async () => {
    if (!orgId) {
      setState({ loading: false, error: null, profile: 'unconfigured', siiRecord: null, tbaiRecord: null, verifactuRecord: null });
      return;
    }
    setState(s => ({ ...s, loading: true, error: null }));
    try {
      const [sii, tbai, verifactu] = await Promise.all([
        fetchRecord(apiFetch, 'sii-config', SII_ENTITY, orgId),
        fetchRecord(apiFetch, 'tbai-config', TBAI_ENTITY, orgId),
        fetchRecord(apiFetch, 'verifactu-config', VERIFACTU_ENTITY, orgId),
      ]);
      setState({
        loading: false,
        error: null,
        siiRecord: sii,
        tbaiRecord: tbai,
        verifactuRecord: verifactu,
        profile: detectProfile(sii, tbai, verifactu),
      });
    } catch (err) {
      setState(s => ({ ...s, loading: false, error: err.message }));
    }
  }, [orgId, apiFetch]);

  useEffect(() => { load(); }, [load]);

  return { ...state, refetch: load };
}
