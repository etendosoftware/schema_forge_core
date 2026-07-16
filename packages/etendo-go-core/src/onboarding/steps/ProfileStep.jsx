import React, { useState, useEffect } from 'react';
import { ArrowRight, Building2, User, MessageCircle } from 'lucide-react';
import { Button } from '@etendosoftware/app-shell-core/components/ui/button';
import { Label } from '@etendosoftware/app-shell-core/components/ui/label';
import { useUI, useLocaleSwitch } from '@etendosoftware/app-shell-core/i18n';
import { isProfileStepValid } from '../state.js';
import { trackOnboarding } from '../tracking.js';
import { createOnboardingLogout } from '../logout.js';
import { SetupShell } from '../components/SetupShell.jsx';
import { SetupField } from '../components/SetupField.jsx';
import { BusinessTypeCard } from '../components/BusinessTypeCard.jsx';
import { buildCountryOptions } from '../countries.js';
import { OnboardingLanguageSelect } from '../components/OnboardingLanguageSelect.jsx';

export function ProfileStep({ config, stepData, onNext, onBack, goToStep, accountName, setToken, setAccountName, draftNotice, setDraftNotice, onChange }) {
  const ui = useUI();
  const { locale, setLocale } = useLocaleSwitch();
  const handleLogout = createOnboardingLogout({ config, setToken, setAccountName, goToStep });

  const [form, setForm] = useState(() => ({
    fullName: stepData.fullName ?? config.defaultForm?.fullName ?? accountName ?? '',
    countryCode: stepData.countryCode ?? config.defaultForm?.countryCode ?? '',
    businessType: stepData.businessType ?? config.defaultForm?.businessType ?? 'company',
    language: stepData.language ?? config.defaultForm?.language ?? locale ?? '',
    sector: stepData.sector ?? config.defaultForm?.sector ?? 'technology',
  }));

  useEffect(() => {
    if (accountName && !form.fullName) {
      setForm(prev => ({ ...prev, fullName: accountName }));
    }
  }, [accountName]);

  useEffect(() => {
    if (locale && form.language !== locale) {
      setForm(prev => ({ ...prev, language: locale }));
    }
  }, [locale]);

  const updateField = (field, value) => {
    setForm(f => ({ ...f, [field]: value }));
    if (onChange) onChange({ [field]: value });
  };

  const setOnboardingLocale = (nextLocale) => {
    if (setLocale) setLocale(nextLocale);
    updateField('language', nextLocale);
  };

  const handleContinue = () => {
    trackOnboarding(config, 'onboarding_setup_step_completed', {
      action: 'continue',
      status: 'success',
      type: 'profile',
    });
    // Remove the draft notice banner once they proceed past the first step
    if (setDraftNotice) setDraftNotice(false);
    onNext(form);
  };

  // Country is fixed (Spain-only for now, no multi-country selector) — still
  // derived from countries.js instead of a hardcoded literal, so the field
  // stays data-driven if the country list ever expands again.
  const fixedCountry = buildCountryOptions(config.countryCodes, locale)[0];

  const businessTypeOptions = (config.businessTypeValues || ['company', 'freelancer', 'advisory']).map((value) => ({
    value,
    label: ui(`onboardingBusinessType${value.charAt(0).toUpperCase()}${value.slice(1)}`),
    icon: value === 'company' ? Building2 : value === 'freelancer' ? User : MessageCircle,
  }));

  const languageOptions = (config.localeCodes || []).map((code) => ({
    value: code,
    label: code.startsWith('es') ? ui('onboardingLanguageSpanish') : ui('onboardingLanguageEnglish'),
  }));

  const localeControl = setLocale ? (
    <OnboardingLanguageSelect
      label={ui('language')}
      locale={locale}
      onChange={setOnboardingLocale}
      options={languageOptions}
      data-testid="OnboardingLanguageSelect__79cf84" />
  ) : null;

  const setupHeaderContent = (
    <div className="flex flex-wrap items-end justify-end gap-3">
      {localeControl}
    </div>
  );

  const isValid = isProfileStepValid(form);
  const setupGreetingName = (form.fullName || accountName || ui('onboardingGreetingFallback')).trim().split(/\s+/)[0];

  return (
    <SetupShell
      progressLabel={ui('onboardingProgressAlmostReady')}
      progressValue={50}
      headerContent={setupHeaderContent}
      onLogout={handleLogout}
      logoutLabel={ui('logout')}
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

      <div>
        <div className="mb-10">
          <h1 className="text-3xl font-semibold tracking-[-0.06em] text-slate-900 sm:text-[2.7rem] sm:leading-[1.04]">
            {ui('onboardingGreeting', { name: setupGreetingName })}
          </h1>
          <p className="mt-3 text-base text-slate-700 sm:text-xl">
            {ui('onboardingSetupSubtitle')}
          </p>
        </div>

        <div className="space-y-6">
          <SetupField
            id="fullName"
            label={ui('onboardingFullNameLabel')}
            required
            value={form.fullName}
            onChange={e => updateField('fullName', e.target.value)}
            placeholder={ui('onboardingFullNamePlaceholder')}
            data-testid="SetupField__79cf84" />

          <div>
            <Label
              htmlFor="countryCode"
              className="mb-2 block text-sm font-medium leading-6 text-slate-900"
              data-testid="Label__79cf84">
              {ui('onboardingCountryLabel')}
              <span className="ml-1 text-rose-500">*</span>
            </Label>
            <div
              id="countryCode"
              className="flex h-10 w-full items-center gap-2 rounded-lg border border-[#D1D4DB] bg-white px-3 text-base text-slate-900 shadow-[0_1px_2px_rgba(18,18,23,0.05)]"
              data-testid="CountryField__79cf84">
              {fixedCountry && (
                <>
                  <span aria-hidden="true">{fixedCountry.flag}</span>
                  <span>{fixedCountry.label}</span>
                </>
              )}
            </div>
          </div>

          <div>
            <Label
              className="mb-2 block text-sm font-medium leading-6 text-slate-900"
              data-testid="Label__79cf84">
              {ui('onboardingBusinessTypeLabel')}
            </Label>
            <div className="grid gap-5 sm:grid-cols-3">
              {businessTypeOptions.map((option) => (
                <BusinessTypeCard
                  key={option.value}
                  icon={option.icon}
                  label={option.label}
                  selected={form.businessType === option.value}
                  onClick={() => updateField('businessType', option.value)}
                  data-testid="BusinessTypeCard__79cf84" />
              ))}
            </div>
          </div>
        </div>

        <div className="mt-8 flex justify-end">
          <Button
            type="button"
            onClick={handleContinue}
            disabled={!isValid}
            className="h-12 rounded-lg bg-[#121217] px-6 text-base font-medium text-white hover:bg-accent-highlight hover:text-accent-highlight-foreground"
            data-testid="Button__79cf84">
            {ui('onboardingContinueAction')} <ArrowRight className="ml-2 h-4 w-4" data-testid="ArrowRight__79cf84" />
          </Button>
        </div>
      </div>
    </SetupShell>
  );
}

export default ProfileStep;
