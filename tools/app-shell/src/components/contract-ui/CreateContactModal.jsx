import { useState, useEffect, useCallback } from 'react';
import { useUI } from '@/i18n';
import EntityCreationModal from './EntityCreationModal.jsx';
import FinancialSection from './FinancialSection.jsx';
import AddressSection from './AddressSection.jsx';
import { contactModalConfig } from './contactModalConfig.js';

const COMPONENT_MAP = { AddressSection, FinancialSection };

const EMPTY_OPTS = {
  taxIdTypes: { options: [], loading: false, error: null },
  salesPriceLists: { options: [], loading: false, error: null },
  purchasePriceLists: { options: [], loading: false, error: null },
  paymentMethods: { options: [], loading: false, error: null },
  paymentTerms: { options: [], loading: false, error: null },
  financialAccounts: { options: [], loading: false, error: null },
  countries: { options: [], loading: false, error: null },
  regions: { options: [], loading: false, error: null },
};

/**
 * Thin wrapper around EntityCreationModal for creating Business Partners.
 *
 * Responsibilities:
 *   - Fetch selector options from the NEO API
 *   - Re-fetch regions when country changes
 *   - Execute the multi-step save sequence (BP → billing PATCH → address → contacts → bank accounts)
 *
 * Props:
 *   bpApiBaseUrl   Base URL for the contacts NEO spec
 *   headers        { Authorization, Content-Type }
 *   onClose        () => void
 *   onCreated      ({ id, name }) => void
 *   initialQuery   Pre-fills Identifier from the search query
 *   documentType   'sale' | 'purchase' | null — auto-checks Cliente / Proveedor
 */
export default function CreateContactModal({
  bpApiBaseUrl,
  headers,
  onClose,
  onCreated,
  initialQuery = '',
  documentType = null,
}) {
  const ui = useUI();
  const [opts, setOpts] = useState(EMPTY_OPTS);
  const [retryCount, setRetryCount] = useState(0);
  const [currentCountry, setCurrentCountry] = useState('');
  const [retryRegionCount, setRetryRegionCount] = useState(0);

  // Fetch all selectors (except regions, which depend on country)
  useEffect(() => {
    if (!bpApiBaseUrl || !headers) return;
    let cancelled = false;

    setOpts(o => ({
      ...o,
      taxIdTypes: { ...o.taxIdTypes, loading: true, error: null },
      salesPriceLists: { ...o.salesPriceLists, loading: true, error: null },
      purchasePriceLists: { ...o.purchasePriceLists, loading: true, error: null },
      paymentMethods: { ...o.paymentMethods, loading: true, error: null },
      paymentTerms: { ...o.paymentTerms, loading: true, error: null },
      financialAccounts: { ...o.financialAccounts, loading: true, error: null },
      countries: { ...o.countries, loading: true, error: null },
    }));

    const h = headers;
    const bp = `${bpApiBaseUrl}/businessPartner`;
    const vc = `${bpApiBaseUrl}/vendorCreditor`;

    const fetchSel = url =>
      fetch(url, { headers: h })
        .then(r => (r.ok ? r.json() : null))
        .then(d => (d?.items || []).map(i => ({ id: i.id, label: i.label || i.name || i.id })))
        .catch(() => []);

    Promise.all([
      fetchSel(`${bp}/selectors/EM_OBTIK_Tax_ID_Key`),
      fetchSel(`${bp}/selectors/M_PriceList_ID`),
      fetchSel(`${vc}/selectors/PO_PriceList_ID`),
      fetchSel(`${bp}/selectors/FIN_Paymentmethod_ID`),
      fetchSel(`${bp}/selectors/C_PaymentTerm_ID`),
      fetchSel(`${bp}/selectors/FIN_Financial_Account_ID`),
      fetchSel(`${bpApiBaseUrl}/bankAccount/selectors/C_Country_ID`),
    ])
      .then(([taxIdTypes, salesPriceLists, purchasePriceLists, paymentMethods, paymentTerms, financialAccounts, countries]) => {
        if (cancelled) return;
        setOpts(o => ({
          ...o,
          taxIdTypes: { options: taxIdTypes, loading: false, error: null },
          salesPriceLists: { options: salesPriceLists, loading: false, error: null },
          purchasePriceLists: { options: purchasePriceLists, loading: false, error: null },
          paymentMethods: { options: paymentMethods, loading: false, error: null },
          paymentTerms: { options: paymentTerms, loading: false, error: null },
          financialAccounts: { options: financialAccounts, loading: false, error: null },
          countries: { options: countries, loading: false, error: null },
        }));
      })
      .catch(e => {
        if (cancelled) return;
        const msg = e.message || ui('errorLoadingOptions');
        setOpts(o => ({
          ...o,
          taxIdTypes: { ...o.taxIdTypes, loading: false, error: msg },
          salesPriceLists: { ...o.salesPriceLists, loading: false, error: msg },
          purchasePriceLists: { ...o.purchasePriceLists, loading: false, error: msg },
          paymentMethods: { ...o.paymentMethods, loading: false, error: msg },
          paymentTerms: { ...o.paymentTerms, loading: false, error: msg },
          financialAccounts: { ...o.financialAccounts, loading: false, error: msg },
          countries: { ...o.countries, loading: false, error: msg },
        }));
      });

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bpApiBaseUrl, retryCount]);

  // Re-fetch regions when country changes
  useEffect(() => {
    if (!currentCountry || !bpApiBaseUrl || !headers) {
      setOpts(o => ({ ...o, regions: { options: [], loading: false, error: null } }));
      return;
    }
    let cancelled = false;
    setOpts(o => ({ ...o, regions: { options: [], loading: true, error: null } }));

    fetch(
      `${bpApiBaseUrl}/bankAccount/selectors/C_Region_ID?C_Country_ID=${currentCountry}&country=${currentCountry}&limit=200`,
      { headers }
    )
      .then(r => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then(d => {
        if (cancelled) return;
        setOpts(o => ({
          ...o,
          regions: {
            options: (d?.items || []).map(i => ({ id: i.id, label: i.label || i.name || i.id })),
            loading: false,
            error: null,
          },
        }));
      })
      .catch(e => {
        if (cancelled) return;
        setOpts(o => ({ ...o, regions: { options: [], loading: false, error: e.message } }));
      });

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentCountry, retryRegionCount]);

  const handleFieldChange = useCallback((id, value) => {
    if (id === 'country') setCurrentCountry(value);
  }, []);

  // Attach retry callbacks before passing opts down
  const optsWithRetry = {
    ...opts,
    regions: { ...opts.regions, onRetry: () => setRetryRegionCount(c => c + 1) },
    taxIdTypes: { ...opts.taxIdTypes, onRetry: () => setRetryCount(c => c + 1) },
    salesPriceLists: { ...opts.salesPriceLists, onRetry: () => setRetryCount(c => c + 1) },
    purchasePriceLists: { ...opts.purchasePriceLists, onRetry: () => setRetryCount(c => c + 1) },
    paymentMethods: { ...opts.paymentMethods, onRetry: () => setRetryCount(c => c + 1) },
    paymentTerms: { ...opts.paymentTerms, onRetry: () => setRetryCount(c => c + 1) },
    financialAccounts: { ...opts.financialAccounts, onRetry: () => setRetryCount(c => c + 1) },
    countries: { ...opts.countries, onRetry: () => setRetryCount(c => c + 1) },
  };

  const handleSave = async (form, repeatables) => {
    // Step 1 — Create BP
    const createPayload = {
      searchKey: form.searchKey?.trim(),
      name: form.name?.trim(),
      taxID: form.taxID?.trim(),
      oBTIKTaxIDKey: form.taxIdType || '1',
      creditLimit: Number(form.creditLimit) || 0,
      creditUsed: 0,
      active: true,
      customer: !!form.isCustomer,
      vendor: !!form.isVendor,
      employee: false,
      isSalesRepresentative: false,
      customerBlocking: false,
      vendorBlocking: false,
      setNewCurrency: false,
    };

    const res = await fetch(`${bpApiBaseUrl}/businessPartner`, {
      method: 'POST',
      headers,
      body: JSON.stringify(createPayload),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => null);
      throw new Error(
        errData?.message ||
        errData?.error ||
        errData?.response?.error ||
        `${ui('createContactError')} (HTTP ${res.status})`
      );
    }

    const data = await res.json();
    const record = data?.response?.data?.[0] ?? data?.response?.data ?? data;
    const newId = record?.id;
    const newName = record?.name ?? form.name;

    // Step 2 — POST address (C_Location + C_BPartner_Location)
    if (newId) {
      const bpLocationBase = bpApiBaseUrl.replace('/contacts', '/bp-location');
      const locName = [form.city, form.address].filter(Boolean).join(', ') || 'Location';
      const locRes = await fetch(`${bpLocationBase}/bpLocation?parentId=${newId}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: locName,
          addressLine1: form.address || null,
          addressLine2: form.address2 || null,
          postalCode: form.postalCode || null,
          cityName: form.city || null,
          country: form.country || null,
          region: form.region || null,
          businessPartner: newId,
        }),
      }).catch(() => null);

      if (locRes?.ok) {
        const locData = await locRes.json().catch(() => null);
        const locId = locData?.response?.data?.[0]?.id ?? locData?.id;
        if (locId) {
          const existing = await fetch(
            `${bpApiBaseUrl}/locationAddress?parentId=${newId}&_startRow=0&_endRow=5`,
            { headers }
          ).then(r => r.ok ? r.json() : null).catch(() => null);
          const alreadyLinked = (existing?.response?.data ?? []).some(
            r => r.id === locId || r.locationAddress === locId
          );
          if (!alreadyLinked) {
            await fetch(`${bpApiBaseUrl}/locationAddress?parentId=${newId}`, {
              method: 'POST',
              headers,
              body: JSON.stringify({
                name: locName,
                businessPartner: newId,
                locationAddress: locId,
                shipToAddress: 'Y',
                invoiceToAddress: 'Y',
              }),
            }).catch(() => {});
          }
        }
      }
    }

    // Steps 3, 4, 5 — parallel: contact persons + bank accounts + billing preferences
    const contacts = (repeatables.contacts ?? []).filter(c => c.firstName || c.lastName);
    const banks = (repeatables.bankAccount ?? []).filter(b => b.bankName || b.iban);

    const first = (key) => opts[key]?.options?.[0]?.id;
    const salesPriceList    = form.salesPriceList    || first('salesPriceLists');
    const paymentMethod     = form.paymentMethod     || first('paymentMethods');
    const paymentTerm       = form.paymentTerm       || first('paymentTerms');
    const financialAccount  = form.financialAccount  || first('financialAccounts');
    const purchasePriceList = form.purchasePriceList || first('purchasePriceLists');
    const paymentMethodPO   = form.paymentMethodPO   || first('paymentMethods');
    const paymentTermPO     = form.paymentTermPO     || first('paymentTerms');
    const financialAccountPO = form.financialAccountPO || first('financialAccounts');

    const billingPatch = {
      ...(form.isCustomer && salesPriceList    && { priceList: salesPriceList }),
      ...(form.isCustomer && paymentMethod     && { paymentMethod }),
      ...(form.isCustomer && paymentTerm       && { paymentTerms: paymentTerm }),
      ...(form.isCustomer && financialAccount  && { account: financialAccount }),
      ...(form.isCustomer && { customerBlocking: form.customerBlock }),
      ...(form.isVendor   && purchasePriceList && { purchasePricelist: purchasePriceList }),
      ...(form.isVendor   && paymentMethodPO   && { pOPaymentMethod: paymentMethodPO }),
      ...(form.isVendor   && paymentTermPO     && { pOPaymentTerms: paymentTermPO }),
      ...(form.isVendor   && financialAccountPO && { pOFinancialAccount: financialAccountPO }),
      ...(form.isVendor   && { vendorBlocking: form.paymentBlock }),
    };

    await Promise.all([
      // Step 3 — contact persons (C_BPartner_Contact)
      ...contacts.map(async (c) => {
        const contactRes = await fetch(`${bpApiBaseUrl}/contact?parentId=${newId}`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            firstName: c.firstName,
            lastName: c.lastName,
            name: [c.firstName, c.lastName].filter(Boolean).join(' '),
            ...(c.email && { email: c.email }),
            ...(c.phone && { phone: c.phone }),
            active: true,
            isdefaultfordocs: false,
            grantPortalAccess: false,
            commercialauth: false,
            viasms: false,
            viaemail: false,
          }),
        });
        if (!contactRes.ok) {
          const err = await contactRes.json().catch(() => null);
          throw new Error(err?.response?.error?.message || err?.message || `Contact POST failed (HTTP ${contactRes.status})`);
        }
      }),
      // Step 4 — bank accounts (C_BPartner_Bank_Account)
      ...banks.map(async (b) => {
        const bankRes = await fetch(`${bpApiBaseUrl}/bankAccount?parentId=${newId}`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            bankFormat: 'GENERIC',
            ...(b.bankName && { bankName: b.bankName }),
            ...(b.genericAccountNo && { accountNo: b.genericAccountNo }),
            ...(b.iban && { iBAN: b.iban }),
          }),
        });
        if (!bankRes.ok) {
          const err = await bankRes.json().catch(() => null);
          throw new Error(err?.response?.error?.message || err?.message || `Bank account POST failed (HTTP ${bankRes.status})`);
        }
      }),
      // Step 5 — billing preferences PATCH
      Object.keys(billingPatch).length > 0
        ? fetch(`${bpApiBaseUrl}/businessPartner/${newId}`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify(billingPatch),
          }).then(async patchRes => {
            if (!patchRes.ok) {
              const err = await patchRes.json().catch(() => null);
              throw new Error(err?.message || err?.error || `${ui('createContactError')} (billing PATCH ${patchRes.status})`);
            }
          })
        : Promise.resolve(),
    ]);

    onCreated({ id: newId, name: newName });
    onClose();
  };

  return (
    <EntityCreationModal
      title={ui('newContact')}
      saveLabel={ui('saveContact')}
      {...contactModalConfig}
      initialValues={{
        searchKey: '',
        name: '',
        taxID: '',
        taxIdType: '',
        creditLimit: 0,
        discount: '',
        isCustomer: documentType === 'sale',
        isVendor: documentType === 'purchase',
        customerBlock: false,
        paymentBlock: false,
        salesPriceList: '',
        paymentMethod: '',
        paymentTerm: '',
        financialAccount: '',
        purchasePriceList: '',
        paymentMethodPO: '',
        paymentTermPO: '',
        financialAccountPO: '',
        address: '',
        address2: '',
        postalCode: '',
        city: '',
        country: '',
        region: '',
      }}
      opts={optsWithRetry}
      componentMap={COMPONENT_MAP}
      onSave={handleSave}
      onCancel={onClose}
      onFieldChange={handleFieldChange}
    />
  );
}
