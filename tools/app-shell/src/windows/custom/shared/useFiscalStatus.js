import { useState, useEffect } from 'react';
import { neoBase } from '@/components/related-documents/helpers.js';
import { getInvoiceFiscalTargets } from './fiscalTargets.js';

const SII_SPEC  = 'sii-monitor';
const TBAI_SPEC = 'tbai-facturas-enviadas';
const VF_SPEC   = 'monitor-verifactu';

async function fetchFirstStatus(base, spec, entity, fkField, statusField, invoiceId, token) {
  const params = new URLSearchParams({
    _startRow: '0',
    _endRow:   '1',
    criteria: JSON.stringify([{ fieldName: fkField, operator: 'equals', value: invoiceId }]),
  });
  const res = await fetch(`${base}/${spec}/${encodeURIComponent(entity)}?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  const json = await res.json();
  const row = json?.response?.data?.[0] ?? null;
  return row ? (row[statusField] ?? null) : null;
}

async function fetchSiiStatus(base, invoiceId, token) {
  const issued = await fetchFirstStatus(base, SII_SPEC, 'issuedInvoices', 'aeatsiiInvoice', 'aeatsiiEstado', invoiceId, token);
  if (issued !== null) return issued;
  return fetchFirstStatus(base, SII_SPEC, 'receivedInvoices', 'aeatsiiInvoice', 'aeatsiiEstado', invoiceId, token);
}

async function fetchTbaiStatus(base, invoiceId, token) {
  return fetchFirstStatus(base, TBAI_SPEC, 'sincronización', 'invoice', 'estado', invoiceId, token);
}

async function fetchVerifactuStatus(base, invoiceId, token) {
  const entities = [
    'facturasAceptadas',
    'partiallyAcceptedInvoices',
    'facturasRechazadas',
    'facturasInválidas',
  ];
  for (const entity of entities) {
    const status = await fetchFirstStatus(base, VF_SPEC, entity, 'invoice', 'verifactuSendingStatus', invoiceId, token);
    if (status !== null) return status;
  }
  return null;
}

export function useFiscalStatus(invoiceId, specName, profile, apiBaseUrl, token) {
  const [state, setState] = useState({ sii: null, tbai: null, verifactu: null, loading: true });

  useEffect(() => {
    if (!invoiceId || !apiBaseUrl || !token) {
      setState({ sii: null, tbai: null, verifactu: null, loading: false });
      return;
    }
    const targets = getInvoiceFiscalTargets(specName, profile);
    if (!targets.showSii && !targets.showTbai && !targets.showVerifactu) {
      setState({ sii: null, tbai: null, verifactu: null, loading: false });
      return;
    }

    setState(s => ({ ...s, loading: true }));
    const base = neoBase(apiBaseUrl);

    Promise.all([
      targets.showSii       ? fetchSiiStatus(base, invoiceId, token)       : Promise.resolve(null),
      targets.showTbai      ? fetchTbaiStatus(base, invoiceId, token)      : Promise.resolve(null),
      targets.showVerifactu ? fetchVerifactuStatus(base, invoiceId, token) : Promise.resolve(null),
    ])
      .then(([sii, tbai, verifactu]) => setState({ sii, tbai, verifactu, loading: false }))
      .catch(() => setState({ sii: null, tbai: null, verifactu: null, loading: false }));
  }, [invoiceId, specName, profile, apiBaseUrl, token]);

  return state;
}
