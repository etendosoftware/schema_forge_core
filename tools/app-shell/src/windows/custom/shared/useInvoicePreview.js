import { useState, useEffect, useCallback, useMemo } from 'react';
import { useUI } from '@schema-forge/app-shell-core';
import { useInvoicePdf } from './useInvoicePdf.js';
import { useFiscalConfig } from '@/windows/custom/fiscal-config/useFiscalConfig.js';
import { useAuth } from '@schema-forge/app-shell-core';
import { useApiFetch } from '@schema-forge/app-shell-core';
import { getPendingSifTargets, getSifBodyKey } from './sifSending.js';
import { getStatusBadgeProps, statusLabel } from '@/lib/statusBadge.js';

/**
 * useInvoicePreview — all data-fetching, state, and handlers for an invoice preview.
 *
 * Returns everything InvoicePreview needs to render GenericPreviewModal
 * and its overlay modals (payment, email, SIF). Contains no JSX.
 *
 * Drop zone state has been removed — GenericPreviewModal manages file persistence
 * via the attachmentConfig prop and usePreviewAttachment internally.
 */
export function useInvoicePreview({ invoice, apiBaseUrl, specName = 'purchase-invoice', onInvoiceUpdated = null }) {
  const ui = useUI();
  const [invoiceData, setInvoiceData] = useState(invoice);
  const [showSifModal, setShowSifModal] = useState(false);
  const [sifPhase, setSifPhase] = useState('confirm');
  const [sifResults, setSifResults] = useState({});
  const { token, selectedOrg } = useAuth();
  const orgId = selectedOrg?.id ?? null;
  const { profile } = useFiscalConfig(orgId, apiBaseUrl);
  const neoBaseUrl = useMemo(() => (apiBaseUrl || '').replace(/\/[^/]+$/, ''), [apiBaseUrl]);
  const apiFetch = useApiFetch(apiBaseUrl);
  const baseApiFetch = useApiFetch(neoBaseUrl);
  const jsonHeaders = useMemo(() => ({ 'Content-Type': 'application/json' }), []);
  const updateEventName = `${specName}:invoice-updated`;

  const isSalesInvoice = specName === 'sales-invoice';
  const { pdfUrl, pdfBlob, loading: pdfLoading, error: pdfError } = useInvoicePdf(
    isSalesInvoice ? invoiceData?.id : null,
    isSalesInvoice ? apiBaseUrl : null,
    token,
  );

  const [installments, setInstallments] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);
  const [sendModalClosing, setSendModalClosing] = useState(false);

  useEffect(() => { setInvoiceData(invoice); }, [invoice]);

  const refetchInvoice = useCallback(async () => {
    if (!invoice?.id || !apiBaseUrl || !apiFetch) return null;
    try {
      const res = await apiFetch(`/header/${invoice.id}`);
      if (!res.ok) return null;
      const json = await res.json();
      const candidate = json?.response?.data?.[0] ?? json?.data?.[0] ?? null;
      const refreshed = candidate && typeof candidate === 'object' && !Array.isArray(candidate) ? candidate : null;
      if (refreshed?.id) {
        setInvoiceData(refreshed);
        window.dispatchEvent(new CustomEvent(updateEventName, {
          detail: { invoiceId: refreshed.id, invoice: refreshed },
        }));
        onInvoiceUpdated?.(refreshed);
      }
      return refreshed;
    } catch {
      return null;
    }
  }, [apiBaseUrl, apiFetch, invoice?.id, onInvoiceUpdated, updateEventName]);

  const openEmailModal = useCallback(() => setShowSendModal(true), []);

  const closeEmailModal = useCallback(() => {
    setSendModalClosing(true);
    setTimeout(() => {
      setSendModalClosing(false);
      setShowSendModal(false);
    }, 280);
  }, []);

  const fetchPayments = useCallback(() => {
    if (!invoiceData?.id || !apiFetch) return;
    setLoadingPayments(true);
    Promise.all([
      apiFetch(`/paymentPlan?parentId=${invoiceData.id}`)
        .then((r) => (r.ok ? r.json() : {}))
        .then((d) => d?.response?.data ?? d?.data ?? [])
        .catch(() => []),
      apiFetch(`/header/${invoiceData.id}/action/invoicePayments`, {
        method: 'POST', headers: jsonHeaders, body: '{}',
      })
        .then((r) => (r.ok ? r.json() : {}))
        .then((d) => d?.response?.data ?? [])
        .catch(() => []),
    ])
      .then(([sched, pays]) => { setInstallments(sched); setPayments(pays); })
      .catch(() => { setInstallments([]); setPayments([]); })
      .finally(() => setLoadingPayments(false));
  }, [invoiceData?.id, apiFetch, jsonHeaders]);

  useEffect(() => { fetchPayments(); }, [fetchPayments]);

  const pendingTargets = getPendingSifTargets(specName, profile, invoiceData);
  const hasPendingTargets = pendingTargets.sendSii || pendingTargets.sendTbai;
  const canSendToSif = invoiceData?.documentStatus === 'CO' && hasPendingTargets;
  const sifBodyKey = getSifBodyKey(pendingTargets);

  const callSifProcess = useCallback(async (columnName) => {
    const res = await baseApiFetch(
      `/${specName}/header/${invoiceData?.id}/action/${columnName}`,
      { method: 'POST', headers: jsonHeaders, body: '{}' },
    );
    if (!res.ok) {
      const json = await res.json().catch(() => null);
      throw new Error(json?.response?.message || json?.message || `HTTP ${res.status}`);
    }
    return res.json().catch(() => null);
  }, [baseApiFetch, invoiceData?.id, jsonHeaders, specName]);

  const closeSifModal = useCallback(() => {
    setShowSifModal(false);
    setSifPhase('confirm');
    setSifResults({});
  }, []);

  const handleSendToSif = useCallback(async () => {
    setSifPhase('sending');
    const next = {};
    if (pendingTargets.sendSii) {
      try { await callSifProcess('Em_aeatsii_send'); next.sii = { ok: true }; }
      catch (err) { next.sii = { ok: false, error: err.message }; }
    }
    if (pendingTargets.sendTbai) {
      try { await callSifProcess('Em_Tbai_Xmlgenerator'); next.tbai = { ok: true }; }
      catch (err) { next.tbai = { ok: false, error: err.message }; }
    }
    setSifResults(next);
    if (Object.values(next).some((r) => r?.ok)) {
      await refetchInvoice();
      fetchPayments();
    }
    setSifPhase('results');
  }, [callSifProcess, fetchPayments, pendingTargets, refetchInvoice]);

  const handleDownloadPdf = useCallback(() => {
    if (!pdfUrl) return;
    const a = document.createElement('a');
    a.href = pdfUrl;
    a.download = `invoice-${invoiceData?.documentNo || 'document'}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [pdfUrl, invoiceData?.documentNo]);

  // ── Derived display values ────────────────────────────────────────────────
  const displayInvoice = invoiceData;
  const status = displayInvoice?.documentStatus;
  const badgeProps = getStatusBadgeProps(status);
  const label = statusLabel(status, null, ui);
  const partnerName = displayInvoice?.businessPartner$_identifier || displayInvoice?.businessPartner || '—';
  const grandTotal = Number(displayInvoice?.grandTotalAmount ?? 0);
  const totalOutstanding = installments.length > 0
    ? installments.reduce((s, i) => s + Math.max(0, Number(i.outstandingAmount ?? 0)), 0)
    : grandTotal;
  const isDraft = status === 'DR' || status === 'draft';
  const isFullyPaid = totalOutstanding <= 0 && installments.length > 0;
  const isCompleted = status === 'CO' || status === 'complete' || status === 'completed';
  const canAddPayment = isCompleted && !isFullyPaid;

  return {
    displayInvoice,
    isSalesInvoice,
    isCompleted,
    isDraft,
    // PDF (used as sourceBlob for attachment caching, and pdfUrl directly for draft view)
    pdfUrl, pdfBlob, pdfLoading, pdfError, handleDownloadPdf,
    // payments
    installments, payments, loadingPayments,
    totalOutstanding, canAddPayment, isFullyPaid, fetchPayments,
    // display
    status, badgeProps, statusLabel: label, partnerName, grandTotal,
    // fiscal status (needed by StatsPanel to render SII/TBai/Verifactu pills)
    orgId, profile,
    // payment modal
    showPaymentModal, setShowPaymentModal,
    // email modal
    showSendModal, sendModalClosing, openEmailModal, closeEmailModal,
    // SIF
    showSifModal, setShowSifModal, sifPhase, sifResults,
    handleSendToSif, closeSifModal, canSendToSif, sifBodyKey,
  };
}
