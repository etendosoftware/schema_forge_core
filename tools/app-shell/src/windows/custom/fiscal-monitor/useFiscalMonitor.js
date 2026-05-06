import { useState, useEffect, useCallback } from 'react';
import { neoBase } from '@/components/related-documents/helpers.js';
import { detectProfile } from '../fiscal-config/fiscalConfig.utils.js';
import { computeKpis } from './fiscalMonitor.utils.js';

// ── Config entity names (for profile detection) ───────────────────────────────
const SII_CFG_SPEC         = 'sii-config';
const SII_CFG_ENTITY       = 'siiConfiguration';
const TBAI_CFG_SPEC        = 'tbai-config';
const TBAI_CFG_ENTITY      = 'header';
const VF_CFG_SPEC          = 'verifactu-config';
const VF_CFG_ENTITY        = 'cabeceraDeConfiguraciónVerifactu';

// ── SII Monitor entity names ──────────────────────────────────────────────────
const SII_SPEC                   = 'sii-monitor';
const SII_EMITIDAS_ENTITY        = 'issuedInvoices';
const SII_RECIBIDAS_ENTITY       = 'receivedInvoices';
const SII_EMITIDAS_ANT_ENTITY    = 'issuedInvoices(previousPeriod)';
const SII_RECIBIDAS_ANT_ENTITY   = 'receivedInvoices(previousPeriod)';

// ── Monitor Verifactu entity names ────────────────────────────────────────────
const VF_SPEC              = 'monitor-verifactu';
const VF_ACEPTADAS_ENTITY  = 'facturasAceptadas';
const VF_PARCIAL_ENTITY    = 'facturasParcialmenteAceptadas';
const VF_RECHAZADAS_ENTITY = 'facturasRechazadas';
const VF_INVALIDAS_ENTITY  = 'facturasInválidas';

// ── TBAI entity name ──────────────────────────────────────────────────────────
const TBAI_SPEC   = 'tbai-facturas-enviadas';
const TBAI_ENTITY = 'sincronización';
// ─────────────────────────────────────────────────────────────────────────────

async function get(base, spec, entity, params, token) {
  const url = `${base}/${spec}/${encodeURIComponent(entity)}?${new URLSearchParams(params)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error(`${spec}/${entity} HTTP ${res.status}`);
  return (await res.json())?.response ?? {};
}

async function fetchConfigRecord(base, spec, entity, orgId, token) {
  const resp = await get(base, spec, entity, { organization: orgId, _limit: '1' }, token);
  return resp.data?.[0] ?? null;
}

async function fetchCount(base, spec, entity, orgId, token) {
  const resp = await get(base, spec, entity, { organization: orgId, _limit: '1' }, token);
  return { totalCount: resp.totalRows ?? 0 };
}

async function fetchSiiMonitorData(base, orgId, token) {
  const [emitidas, recibidas, emitidasAnt, recibidasAnt] = await Promise.all([
    fetchCount(base, SII_SPEC, SII_EMITIDAS_ENTITY,      orgId, token),
    fetchCount(base, SII_SPEC, SII_RECIBIDAS_ENTITY,     orgId, token),
    fetchCount(base, SII_SPEC, SII_EMITIDAS_ANT_ENTITY,  orgId, token),
    fetchCount(base, SII_SPEC, SII_RECIBIDAS_ANT_ENTITY, orgId, token),
  ]);
  return { issued: emitidas, received: recibidas, issuedPrevious: emitidasAnt, receivedPrevious: recibidasAnt };
}

async function fetchVerifactuMonitorData(base, orgId, token) {
  const [accepted, partial, rejected, invalid] = await Promise.all([
    fetchCount(base, VF_SPEC, VF_ACEPTADAS_ENTITY,  orgId, token),
    fetchCount(base, VF_SPEC, VF_PARCIAL_ENTITY,    orgId, token),
    fetchCount(base, VF_SPEC, VF_RECHAZADAS_ENTITY, orgId, token),
    fetchCount(base, VF_SPEC, VF_INVALIDAS_ENTITY,  orgId, token),
  ]);
  return { accepted, partiallyAccepted: partial, rejected, invalid };
}

async function fetchCountByCriteria(base, spec, entity, orgId, field, value, token) {
  const params = {
    organization: orgId,
    _limit: '1',
    criteria: JSON.stringify([{ fieldName: field, operator: 'equals', value }]),
  };
  const resp = await get(base, spec, entity, params, token);
  return resp.totalRows ?? 0;
}

async function fetchTbaiData(base, orgId, token) {
  const [total, recibido, rechazado, error] = await Promise.all([
    get(base, TBAI_SPEC, TBAI_ENTITY, { organization: orgId, _limit: '1' }, token)
      .then(r => r.totalRows ?? 0),
    fetchCountByCriteria(base, TBAI_SPEC, TBAI_ENTITY, orgId, 'estado', 'Recibido', token),
    fetchCountByCriteria(base, TBAI_SPEC, TBAI_ENTITY, orgId, 'estado', 'Rechazado', token),
    fetchCountByCriteria(base, TBAI_SPEC, TBAI_ENTITY, orgId, 'estado', 'Error', token),
  ]);
  return { totalCount: total, recibidoCount: recibido, rechazadoCount: rechazado, errorCount: error };
}

export function useFiscalMonitor(orgId, token, apiBaseUrl) {
  const [state, setState] = useState({
    loading: true,
    error: null,
    profile: null,
    monitorData: {},
    kpis: {},
  });

  const load = useCallback(async () => {
    if (!orgId) {
      setState({ loading: false, error: null, profile: 'unconfigured', monitorData: {}, kpis: {} });
      return;
    }
    setState(s => ({ ...s, loading: true, error: null }));
    try {
      const base = neoBase(apiBaseUrl);
      const [siiCfg, tbaiCfg, vfCfg] = await Promise.all([
        fetchConfigRecord(base, SII_CFG_SPEC,  SII_CFG_ENTITY,  orgId, token),
        fetchConfigRecord(base, TBAI_CFG_SPEC, TBAI_CFG_ENTITY, orgId, token),
        fetchConfigRecord(base, VF_CFG_SPEC,   VF_CFG_ENTITY,   orgId, token),
      ]);
      const profile = detectProfile(siiCfg, tbaiCfg, vfCfg);

      let monitorData = {};
      if (profile === 'sii' || profile === 'sii-navarra' || profile === 'sii+tbai') {
        monitorData.sii = await fetchSiiMonitorData(base, orgId, token);
      }
      if (profile === 'tbai' || profile === 'sii+tbai') {
        monitorData.tbai = await fetchTbaiData(base, orgId, token);
      }
      if (profile === 'verifactu') {
        monitorData.verifactu = await fetchVerifactuMonitorData(base, orgId, token);
      }

      setState({
        loading: false,
        error: null,
        profile,
        monitorData,
        kpis: computeKpis(profile, monitorData),
      });
    } catch (err) {
      setState(s => ({ ...s, loading: false, error: err.message }));
    }
  }, [orgId, token, apiBaseUrl]);

  useEffect(() => { load(); }, [load]);

  return { ...state, refetch: load };
}

// Export entity/spec constants so section components can use them
export {
  SII_SPEC, SII_EMITIDAS_ENTITY, SII_RECIBIDAS_ENTITY,
  SII_EMITIDAS_ANT_ENTITY, SII_RECIBIDAS_ANT_ENTITY,
  VF_SPEC, VF_ACEPTADAS_ENTITY, VF_PARCIAL_ENTITY,
  VF_RECHAZADAS_ENTITY, VF_INVALIDAS_ENTITY,
  TBAI_SPEC, TBAI_ENTITY,
};
