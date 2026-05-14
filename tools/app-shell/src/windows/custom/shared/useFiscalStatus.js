import { useState, useEffect } from 'react';
import { neoBase } from '@/components/related-documents/helpers.js';
import { useApiFetch } from '@/auth/useApiFetch.js';
import { getInvoiceFiscalTargets } from './fiscalTargets.js';

const SII_SPEC  = 'sii-monitor';
const TBAI_SPEC = 'tbai-facturas-enviadas';
const VF_SPEC   = 'monitor-verifactu';

async function fetchFirstStatus(apiFetch, spec, entity, extraParams, fields, invoiceId) {
  const { fkField, statusField } = fields;
  const params = new URLSearchParams({
    ...extraParams,
    _startRow: '0',
    _endRow:   '1',
    criteria: JSON.stringify([{ fieldName: fkField, operator: 'equals', value: invoiceId }]),
  });
  const res = await apiFetch(`/${spec}/${encodeURIComponent(entity)}?${params}`);
  if (!res.ok) return null;
  const json = await res.json();
  const row = json?.response?.data?.[0] ?? null;
  return row ? (row[statusField] ?? null) : null;
}

async function fetchSiiParentId(apiFetch, orgId) {
  const params = new URLSearchParams({ organization: orgId, _limit: '1' });
  const res = await apiFetch(`/${SII_SPEC}/organizations?${params}`);
  if (!res.ok) return null;
  const json = await res.json();
  return json?.response?.data?.[0]?.id ?? null;
}

async function fetchSiiStatus(apiFetch, orgId, invoiceId) {
  const parentId = await fetchSiiParentId(apiFetch, orgId);
  if (!parentId) return null;
  const extra = { parentId };
  const siiFields = { fkField: 'aeatsiiInvoice', statusField: 'aeatsiiEstado' };
  const issued = await fetchFirstStatus(apiFetch, SII_SPEC, 'issuedInvoices', extra, siiFields, invoiceId);
  if (issued !== null) return issued;
  return fetchFirstStatus(apiFetch, SII_SPEC, 'receivedInvoices', extra, siiFields, invoiceId);
}

async function fetchTbaiStatus(apiFetch, orgId, invoiceId) {
  return fetchFirstStatus(apiFetch, TBAI_SPEC, 'sincronización', { organization: orgId }, { fkField: 'invoice', statusField: 'estado' }, invoiceId);
}

async function fetchVerifactuStatus(apiFetch, orgId, invoiceId) {
  const entities = [
    'facturasAceptadas',
    'partiallyAcceptedInvoices',
    'facturasRechazadas',
    'facturasInválidas',
  ];
  for (const entity of entities) {
    const status = await fetchFirstStatus(apiFetch, VF_SPEC, entity, { organization: orgId }, { fkField: 'invoice', statusField: 'verifactuSendingStatus' }, invoiceId);
    if (status !== null) return status;
  }
  return null;
}

export function useFiscalStatus(invoiceId, specName, profile, apiBaseUrl, orgId) {
  const [state, setState] = useState({ sii: null, tbai: null, verifactu: null, loading: true });
  const apiFetch = useApiFetch(neoBase(apiBaseUrl));

  useEffect(() => {
    if (!invoiceId || !apiBaseUrl || !apiFetch) {
      setState({ sii: null, tbai: null, verifactu: null, loading: false });
      return;
    }
    const targets = getInvoiceFiscalTargets(specName, profile);
    if (!targets.showSii && !targets.showTbai && !targets.showVerifactu) {
      setState({ sii: null, tbai: null, verifactu: null, loading: false });
      return;
    }

    setState(s => ({ ...s, loading: true }));

    Promise.all([
      targets.showSii && orgId ? fetchSiiStatus(apiFetch, orgId, invoiceId)  : Promise.resolve(null),
      targets.showTbai         ? fetchTbaiStatus(apiFetch, orgId, invoiceId) : Promise.resolve(null),
      targets.showVerifactu    ? fetchVerifactuStatus(apiFetch, orgId, invoiceId) : Promise.resolve(null),
    ])
      .then(([sii, tbai, verifactu]) => setState({ sii, tbai, verifactu, loading: false }))
      .catch(() => setState({ sii: null, tbai: null, verifactu: null, loading: false }));
  }, [invoiceId, specName, profile, apiBaseUrl, apiFetch, orgId]);

  return state;
}
