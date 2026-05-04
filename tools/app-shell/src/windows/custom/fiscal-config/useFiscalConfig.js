import { useState, useEffect, useCallback } from 'react';
import { detectProfile } from './fiscalConfig.utils.js';
import { neoBase } from '@/components/related-documents/helpers.js';

// Confirmed from artifacts/*/contract.json → backendContract.window.primaryEntity
const SII_ENTITY = 'siiConfiguration';
const TBAI_ENTITY = 'header';
const VERIFACTU_ENTITY = 'cabeceraDeConfiguraciónVerifactu';

async function fetchRecord(base, specName, entityName, orgId, token) {
  const params = new URLSearchParams({ organization: orgId, _limit: '1' });
  const res = await fetch(`${base}/${specName}/${entityName}?${params}`, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error(`Failed to load ${specName}: HTTP ${res.status}`);
  const json = await res.json();
  return json?.response?.data?.[0] ?? null;
}

export function useFiscalConfig(orgId, token, apiBaseUrl) {
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
      const base = neoBase(apiBaseUrl);
      const [sii, tbai, verifactu] = await Promise.all([
        fetchRecord(base, 'sii-config', SII_ENTITY, orgId, token),
        fetchRecord(base, 'tbai-config', TBAI_ENTITY, orgId, token),
        fetchRecord(base, 'verifactu-config', VERIFACTU_ENTITY, orgId, token),
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
  }, [orgId, token, apiBaseUrl]);

  useEffect(() => { load(); }, [load]);

  return { ...state, refetch: load };
}
