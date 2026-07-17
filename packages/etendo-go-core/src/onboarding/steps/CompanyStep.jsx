import React, { useState, useEffect } from 'react';
import { ArrowRight } from 'lucide-react';
import { Button } from '@etendosoftware/app-shell-core/components/ui/button';
import { Label } from '@etendosoftware/app-shell-core/components/ui/label';
import { useUI } from '@etendosoftware/app-shell-core/i18n';
import { isCompanyStepValid } from '../state.js';
import { trackOnboarding } from '../tracking.js';
import { SetupShell } from '../components/SetupShell.jsx';
import { SetupField } from '../components/SetupField.jsx';
import { SetupSelect } from '../components/SetupSelect.jsx';

export function CompanyStep({ config, stepData, onNext, onBack, goToStep, onChange, draftNotice, draftSaveWarning, setDraftNotice, accountName }) {
  const ui = useUI();

  const [form, setForm] = useState(() => ({
    clientName: stepData.clientName ?? config.defaultForm?.clientName ?? '',
    fiscalIdType: stepData.fiscalIdType ?? config.defaultForm?.fiscalIdType ?? '',
    fiscalIdValue: stepData.fiscalIdValue ?? config.defaultForm?.fiscalIdValue ?? '',
    address: stepData.address ?? config.defaultForm?.address ?? '',
    sector: stepData.sector ?? config.defaultForm?.sector ?? 'technology',
  }));

  const updateField = (field, value) => {
    setForm(f => ({ ...f, [field]: value }));
    if (onChange) onChange({ [field]: value });
  };

  const handleBack = () => {
    trackOnboarding(config, 'onboarding_setup_step_back', {
      action: 'back',
      status: 'success',
      type: 'company',
    });
    if (setDraftNotice) setDraftNotice(false);
    onBack();
  };

  const handleStart = () => {
    if (setDraftNotice) setDraftNotice(false);
    onNext(form);
  };

  const sectorOptions = (config.sectorCodes || ['technology', 'services', 'commerce', 'manufacturing']).map((code) => ({
    value: code,
    label: ui(`onboardingSector${code.charAt(0).toUpperCase()}${code.slice(1)}`),
  }));

  const isValid = isCompanyStepValid(form);
  // Freelancers invoice under their personal tax id, captured elsewhere — hide the
  // company Tax ID field for them. businessType comes from the profile step.
  const showTaxId = stepData.businessType !== 'freelancer';

  return (
    <SetupShell
      progressLabel={ui('onboardingProgressAlmostDone')}
      progressValue={90}
      brandLabel={config.brandLabel || 'Etendo GO'}
      data-testid="SetupShell__79cf84">
      {draftNotice && (
        <div
          data-testid="draft-restored-notice"
          className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700"
        >
          {ui('onboardingDraftRestoredNotice')}
        </div>
      )}
      {draftSaveWarning && (
        <div
          role="alert"
          data-testid="draft-save-warning"
          className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800"
        >
          {ui('onboardingDraftSaveWarning')}
        </div>
      )}
      <div>
        <div className="mb-10">
          <h1 className="text-3xl font-semibold tracking-[-0.06em] text-slate-900 sm:text-[2.7rem] sm:leading-[1.04]">
            {ui('onboardingCompanyTitle')}
          </h1>
          <p className="mt-3 text-base text-slate-700 sm:text-xl">
            {ui('onboardingCompanySubtitle')}
          </p>
        </div>

        <div className="space-y-6">
          <SetupField
            id="clientName"
            label={ui('onboardingCompanyNameLabel')}
            required
            value={form.clientName}
            onChange={e => updateField('clientName', e.target.value)}
            placeholder={ui('onboardingCompanyNamePlaceholder')}
            data-testid="SetupField__79cf84" />

          {showTaxId && (
            <div>
              <Label
                htmlFor="fiscalIdValue"
                className="mb-2 block text-sm font-medium leading-6 text-slate-900"
                data-testid="Label__79cf84">
                {ui('onboardingFiscalIdLabel')} <span className="ml-2 font-normal text-slate-500">({ui('optional')})</span>
              </Label>
              <div className="flex overflow-hidden rounded-lg border border-[#D1D4DB] bg-white shadow-[0_1px_2px_rgba(18,18,23,0.05)] transition-colors hover:border-slate-400 focus-within:border-slate-400 focus-within:ring-4 focus-within:ring-slate-900/5">
                <div className="flex min-w-[88px] items-center justify-center border-r border-[#D1D4DB] px-4 text-base text-slate-500">
                  {form.fiscalIdType}
                </div>
                <input
                  id="fiscalIdValue"
                  type="text"
                  value={form.fiscalIdValue}
                  onChange={e => updateField('fiscalIdValue', e.target.value)}
                  placeholder={ui('onboardingFiscalIdPlaceholder')}
                  className="h-10 w-full border-0 px-4 text-base text-slate-900 outline-none placeholder:text-slate-400"
                />
              </div>
            </div>
          )}

          <SetupField
            id="address"
            label={ui('onboardingAddressLabel')}
            trailingLabel={`(${ui('optional')})`}
            value={form.address}
            onChange={e => updateField('address', e.target.value)}
            placeholder={ui('onboardingAddressPlaceholder')}
            data-testid="SetupField__79cf84" />

          <SetupSelect
            id="sector"
            label={ui('onboardingSectorLabel')}
            value={form.sector}
            onChange={e => updateField('sector', e.target.value)}
            data-testid="SetupSelect__79cf84">
            {sectorOptions.map((sector) => (
              <option key={sector.value} value={sector.value}>{sector.label}</option>
            ))}
          </SetupSelect>
        </div>

        <div className="mt-8 flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={handleBack}
            className="text-base font-medium tracking-[-0.02em] text-slate-900 transition hover:text-slate-600 sm:text-lg"
          >
            {ui('back')}
          </button>

          <Button
            type="button"
            onClick={handleStart}
            disabled={!isValid}
            className="h-12 rounded-lg bg-[#121217] px-6 text-base font-medium text-white hover:bg-accent-highlight hover:text-accent-highlight-foreground disabled:bg-slate-200 disabled:text-slate-500"
            data-testid="Button__79cf84">
            <><ArrowRight className="mr-2 h-4 w-4" data-testid="ArrowRight__79cf84" />{ui('onboardingStartAction')}</>
          </Button>
        </div>
      </div>
    </SetupShell>
  );
}

export default CompanyStep;
