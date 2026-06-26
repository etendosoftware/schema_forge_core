const MS_DAY = 86_400_000;

const INVOICE_SPEC_NAMES = new Set(['sales-invoice', 'purchase-invoice']);
const PO_SPEC_NAMES = new Set(['purchase-order']);

export function isInvoiceSpec(specName) {
  return INVOICE_SPEC_NAMES.has(specName);
}

export function isPurchaseOrderSpec(specName) {
  return PO_SPEC_NAMES.has(specName);
}

function npsIsEligible({ state, now }) {
  if (!state.firstLoginAt) return false;
  const msSinceFirst = now - new Date(state.firstLoginAt).getTime();
  if (msSinceFirst < 60 * MS_DAY) return false;
  const respondedCount = state.respondedCounts['nps'] ?? 0;
  if (respondedCount === 0) return true;
  const lastRespondedAt = state.respondedAt['nps'];
  if (!lastRespondedAt) return true;
  return now - new Date(lastRespondedAt).getTime() >= 90 * MS_DAY;
}

function csatOnboardingIsEligible({ state, isAdmin }) {
  return isAdmin && state.onboardingCompleted && !state.onboardingShown;
}

function csatInvoicingIsEligible({ state, isAdmin, now }) {
  if (isAdmin) return false;
  const count = state.counters.invoicing ?? 0;
  if (count < 5) return false;
  const respondedCount = state.respondedCounts['csat_invoicing'] ?? 0;
  if (respondedCount === 0) return true;
  if (count % 30 !== 0) return false;
  const lastRespondedAt = state.respondedAt['csat_invoicing'];
  if (!lastRespondedAt) return true;
  return now - new Date(lastRespondedAt).getTime() >= 90 * MS_DAY;
}

function csatPoIsEligible({ state, isAdmin, now }) {
  if (isAdmin) return false;
  const count = state.counters.po ?? 0;
  if (count < 5) return false;
  const respondedCount = state.respondedCounts['csat_po'] ?? 0;
  if (respondedCount === 0) return true;
  if (count % 30 !== 0) return false;
  const lastRespondedAt = state.respondedAt['csat_po'];
  if (!lastRespondedAt) return true;
  return now - new Date(lastRespondedAt).getTime() >= 90 * MS_DAY;
}

export const SURVEYS = Object.freeze([
  Object.freeze({
    id: 'csat_onboarding',
    type: 'csat',
    scaleMax: 5,
    titleKey: 'surveyOnboardingTitle',
    q2TitleKey: 'surveyOnboardingQ2',
    q2PlaceholderKey: 'surveyOnboardingQ2Placeholder',
    thanksKey: 'surveyOnboardingThanks',
    isEligible: csatOnboardingIsEligible,
  }),
  Object.freeze({
    id: 'nps',
    type: 'nps',
    scaleMax: 10,
    titleKey: 'surveyNpsTitle',
    isEligible: npsIsEligible,
  }),
  Object.freeze({
    id: 'csat_invoicing',
    type: 'csat',
    scaleMax: 5,
    titleKey: 'surveyInvoicingTitle',
    q2TitleKey: 'surveyInvoicingQ2',
    q2PlaceholderKey: 'surveyInvoicingQ2Placeholder',
    thanksKey: 'surveyInvoicingThanks',
    isEligible: csatInvoicingIsEligible,
  }),
  Object.freeze({
    id: 'csat_po',
    type: 'csat',
    scaleMax: 5,
    titleKey: 'surveyPoTitle',
    q2TitleKey: 'surveyPoQ2',
    q2PlaceholderKey: 'surveyPoQ2Placeholder',
    thanksKey: 'surveyPoThanks',
    isEligible: csatPoIsEligible,
  }),
]);
