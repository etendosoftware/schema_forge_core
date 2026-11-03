import React, { useState, useEffect, useRef, useCallback } from 'react';
import { UserPlus, Mail, Lock, Eye, EyeOff, Check, AlertCircle, Loader2, Gift, Phone } from 'lucide-react';
import { Button } from '@etendosoftware/app-shell-core/components/ui/button';
import { Label } from '@etendosoftware/app-shell-core/components/ui/label';
import { useUI, useLocaleSwitch } from '@etendosoftware/app-shell-core/i18n';
import { registerAccount, loginWithSsoProvider, fetchTermsAndConditions, AUTH_ERROR_UI_KEYS } from '../api.js';
import { getConfiguredSsoProviders, renderSsoProviderButton } from '../sso.js';
import { isStrongPassword } from '../passwordPolicy.js';
import { ONBOARDING_FIELD_LIMITS } from '../fieldLimits.js';
import { isValidEmailFormat } from '../emailPolicy.js';
import { trackOnboarding } from '../tracking.js';
import { AuthShell } from '../components/AuthShell.jsx';
import { AuthField } from '../components/AuthField.jsx';
import { AuthSsoOptions } from '../components/AuthSsoOptions.jsx';
import { PasswordStrengthChecklist } from '../components/PasswordStrengthChecklist.jsx';
import { OnboardingLanguageSelect } from '../components/OnboardingLanguageSelect.jsx';
import { persistAuthMethod } from '../postAuth.js';
import { TermsDialog } from '../components/TermsDialog.jsx';
import {
  buildPhonePrefixOptions,
  composePhone,
  defaultPhonePrefix,
  isValidPhoneNumber,
  PHONE_NUMBER_MAX_LENGTH,
} from '../phonePrefixes.js';

const AUTH_FEATURE_KEYS = ['onboardingAuthFeatureNoCard', 'onboardingAuthFeatureTrial', 'onboardingAuthFeatureInstantAccess'];

export function RegisterStep({ config, stepData, onNext, onBack, goToStep, setToken, setAccountName, handleRegisterSuccess, initialName, initialEmail, emailReadOnly = false, registerHandler, onRegistered, askPhone = true, askPassword = false }) {
  const ui = useUI();
  const { locale, setLocale } = useLocaleSwitch();

  const [registerForm, setRegisterForm] = useState({ name: initialName || stepData?.name || '', email: initialEmail || stepData?.email || '', password: '' });
  // ETP-6081 — optional phone, asked here so it is on the account from the start. Kept apart from
  // registerForm: only its composed "+<code> <number>" value travels. Not asked for an invitation
  // (askPhone=false): the invitee joins a company, they are not a sign-up lead.
  const [phonePrefix, setPhonePrefix] = useState(() => defaultPhonePrefix(
    config.defaultForm?.countryCode || config.countryCodes?.[0] || 'ES'));
  const [phoneNumber, setPhoneNumber] = useState('');
  const phoneNumberInvalid = askPhone && !isValidPhoneNumber(phoneNumber);
  const phone = askPhone ? composePhone(phonePrefix, phoneNumber) : '';
  const [registerError, setRegisterError] = useState(null);
  const [registerLoading, setRegisterLoading] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  // ETP-6081 — no password at sign-up: the account gets in by the session opened here and by the
  // one-time login link of the welcome mail, and creates a password later through "forgot
  // password". An invitation still asks for one (askPassword): its accept endpoint requires it.

  const [ssoError, setSsoError] = useState(null);
  const [ssoLoadingProvider, setSsoLoadingProvider] = useState(null);
  const registerSsoButtonRef = useRef(null);

  const SSO_PROVIDERS = getConfiguredSsoProviders();
  const apiBase = config.apiBase || '';

  // ETP-6081 — the terms in force, loaded with the screen so the version this visitor was shown
  // travels with the account they create (by either path). A failed load sends no version: the
  // backend then records the one in force.
  const [terms, setTerms] = useState({ data: null, loading: false, error: null });
  const [termsOpen, setTermsOpen] = useState(false);
  const termsVersion = terms.data?.version || null;
  const termsLanguage = locale || config.defaultForm?.language || '';

  const loadTerms = useCallback(async () => {
    setTerms(prev => ({ ...prev, loading: true, error: null }));
    try {
      const data = await fetchTermsAndConditions(fetch, apiBase, termsLanguage);
      setTerms({ data, loading: false, error: null });
    } catch (error) {
      setTerms({ data: null, loading: false, error });
    }
  }, [apiBase, termsLanguage]);

  useEffect(() => {
    loadTerms();
  }, [loadTerms]);

  const registerPasswordStrong = !askPassword || isStrongPassword(registerForm.password);
  const registerEmailTouched = registerForm.email.trim().length > 0;
  const registerEmailValid = isValidEmailFormat(registerForm.email);

  const handleAuthSuccess = useCallback((csrfToken, account, { route = true, authMethod = 'password' } = {}) => {
    persistAuthMethod(authMethod);
    if (setToken) setToken(csrfToken);
    if (setAccountName) setAccountName(account?.name || account?.email || null);
    setShowRegisterPassword(false);
    setSsoError(null);
    setSsoLoadingProvider(null);
    if (route && handleRegisterSuccess) {
      handleRegisterSuccess(csrfToken, account);
    }
  }, [setToken, setAccountName, handleRegisterSuccess]);

  const handleSsoProviderLogin = useCallback(async (provider, payload) => {
    trackOnboarding(config, 'onboarding_auth_submitted', {
      action: 'sso',
      provider,
      status: 'started',
    });
    setSsoError(null);
    setRegisterError(null);
    setSsoLoadingProvider(provider);
    try {
      const data = await loginWithSsoProvider(fetch, apiBase, provider, payload, { termsVersion });
      // Either credential counts, same as the password-registration path below:
      // gating on csrfToken alone made a bearer SSO registration report failure.
      const ssoCredential = data.csrfToken ?? data.token;
      if (ssoCredential) {
        trackOnboarding(config, 'onboarding_auth_succeeded', {
          action: 'sso',
          provider,
          status: 'success',
        });
        handleAuthSuccess(ssoCredential, data.account, { authMethod: 'sso' });
      } else {
        trackOnboarding(config, 'onboarding_auth_failed', {
          action: 'sso',
          provider,
          status: 'failed',
        });
        setSsoError(ui('onboardingSsoFailed'));
      }
    } catch (err) {
      trackOnboarding(config, 'onboarding_auth_failed', {
        action: 'sso',
        provider,
        status: 'failed',
      });
      setSsoError(err.userMessage || ui(err.code || 'onboardingSsoFailed'));
    } finally {
      setSsoLoadingProvider(null);
    }
  }, [handleAuthSuccess, ui, apiBase, config, termsVersion]);

  useEffect(() => {
    if (!registerSsoButtonRef.current || !SSO_PROVIDERS.length) {
      return undefined;
    }
    let cancelled = false;
    const container = registerSsoButtonRef.current;
    container.replaceChildren();
    Promise.all(SSO_PROVIDERS.map((provider) => {
      const providerContainer = document.createElement('div');
      container.appendChild(providerContainer);
      return renderSsoProviderButton(provider, providerContainer, {
        onCredential: (providerId, payload) => {
          if (!cancelled) {
            handleSsoProviderLogin(providerId, payload);
          }
        },
        onError: (error) => {
          if (!cancelled) {
            setSsoError(error.userMessage || ui(error.code || 'onboardingSsoFailed'));
          }
        },
      });
    })).catch((error) => {
      if (!cancelled) {
        setSsoError(error.userMessage || ui(error.code || 'onboardingSsoFailed'));
      }
    });
    return () => {
      cancelled = true;
      container.replaceChildren();
    };
  }, [handleSsoProviderLogin, ui, SSO_PROVIDERS.length]);

  const handleRegister = async (e) => {
    e.preventDefault();
    trackOnboarding(config, 'onboarding_auth_submitted', {
      action: 'register',
      status: 'started',
    });
    setRegisterError(null);
    setRegisterLoading(true);
    try {
      const termsField = termsVersion ? { termsVersion } : {};
      const phoneField = phone ? { phone } : {};
      const credentials = askPassword
        ? registerForm
        : { name: registerForm.name, email: registerForm.email };
      const data = registerHandler
        ? await registerHandler({ ...credentials, ...termsField, language: locale || config.defaultForm?.language || '' })
        : await registerAccount(fetch, apiBase, {
          ...credentials,
          ...termsField,
          ...phoneField,
          language: locale || config.defaultForm?.language || '',
        });
      // ETP-4576 — a credential of EITHER kind marks an authenticated response.
      //
      // `/sws/go/session/register` sets the `__Host-` cookie and answers with
      // `csrfToken`, which is the scheme this task moves the product to. But a
      // host-supplied `registerHandler` may front an endpoint that never joined
      // the session family and still answers with a bearer `token` — Etendo GO's
      // `/company-invitations/register-and-accept` (ETP-4894) is exactly that,
      // and gating on `csrfToken` alone made its success path unreachable: the
      // account WAS created and the invitation accepted server-side, while the
      // UI reported a registration failure.
      //
      // Accepting either is the dual-scheme promise applied here. The credential
      // is passed through unchanged and the caller owns its interpretation — the
      // two kinds are NOT interchangeable downstream (a bearer token belongs in
      // `Authorization`, a proof in `X-Go-CSRF`), so nothing here relabels one
      // as the other.
      const credential = data.csrfToken ?? data.token;
      if (credential) {
        trackOnboarding(config, 'onboarding_auth_succeeded', {
          action: 'register',
          status: 'success',
        });
        handleAuthSuccess(credential, data.account, { route: !onRegistered });
        if (onRegistered) await onRegistered(credential, data.account);
      } else {
        trackOnboarding(config, 'onboarding_auth_failed', {
          action: 'register',
          status: 'failed',
        });
        setRegisterError(ui('onboardingRegisterFailed'));
      }
    } catch (err) {
      trackOnboarding(config, 'onboarding_auth_failed', {
        action: 'register',
        status: 'failed',
      });
      // ETP-4664: translate by the backend's stable error code — never show its
      // raw (English) userMessage/message directly.
      // ETP-4665: FIELD_TOO_LONG carries the limit that was exceeded, and its
      // message interpolates it, so it cannot go through the flat code→key table.
      if (err.code === 'FIELD_TOO_LONG' && err.max) {
        setRegisterError(ui('onboardingFieldTooLong', { max: err.max }));
      } else {
        setRegisterError(ui(AUTH_ERROR_UI_KEYS[err.code] || 'onboardingConnectionError'));
      }
    } finally {
      setRegisterLoading(false);
    }
  };

  const authFeatureLabels = AUTH_FEATURE_KEYS.map((key) => ui(key));
  const phonePrefixOptions = askPhone ? buildPhonePrefixOptions(locale) : [];

  const setOnboardingLocale = (nextLocale) => {
    if (setLocale) setLocale(nextLocale);
  };

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

  return (
    <AuthShell
      switchPrompt={ui('onboardingSwitchToLoginPrompt')}
      switchAction={ui('onboardingSwitchToLoginAction')}
      switchTestId="action-switch-to-login"
      onSwitch={() => {
        setRegisterError(null);
        setSsoError(null);
        setShowRegisterPassword(false);
        if (goToStep) goToStep('login');
      }}
      brandLabel={config.brandLabel || 'Etendo'}
      brandHref={config.brandHref}
      headerContent={localeControl}
      marketingTitle={ui('onboardingMarketingTitle')}
      marketingDescription={ui('onboardingMarketingDescription')}
      featureLabels={authFeatureLabels}
      data-testid="AuthShell__79cf84">
      <div className="mb-10">
        <h1 className="text-3xl font-semibold tracking-[-0.06em] text-slate-900 sm:text-[2.7rem] sm:leading-[1.04]">
          {ui('onboardingRegisterTitle')}
        </h1>
        <p className="mt-3 text-base text-slate-600 sm:text-xl">
          {ui('onboardingRegisterSubtitle')}
        </p>
      </div>
      <div
        className="mb-6 flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700"
        data-testid="register-trial-banner">
        <Gift className="h-4 w-4 shrink-0" aria-hidden="true" data-testid="Gift__79cf84" />
        {ui('onboardingTrialOfferBanner')}
      </div>
      <AuthSsoOptions
        providers={SSO_PROVIDERS}
        buttonRef={registerSsoButtonRef}
        error={ssoError}
        loading={Boolean(ssoLoadingProvider)}
        label={ui('onboardingSsoDivider')}
        loadingLabel={ui('onboardingSsoSigningIn')}
        data-testid="AuthSsoOptions__79cf84" />
      <form onSubmit={handleRegister} className="space-y-5">
        <AuthField
          id="reg-name"
          type="text"
          label={ui('onboardingNameLabel')}
          icon={UserPlus}
          value={registerForm.name}
          onChange={e => setRegisterForm(f => ({ ...f, name: e.target.value }))}
          disabled={registerLoading}
          placeholder={ui('onboardingNamePlaceholder')}
          autoComplete="name"
          maxLength={ONBOARDING_FIELD_LIMITS.accountName}
          required
          data-testid="AuthField__79cf84" />

        <AuthField
          id="reg-email"
          type="email"
          label={ui('onboardingEmailLabel')}
          icon={Mail}
          value={registerForm.email}
          onChange={e => setRegisterForm(f => ({ ...f, email: e.target.value }))}
          disabled={registerLoading || emailReadOnly}
          placeholder={ui('onboardingEmailPlaceholder')}
          autoComplete="email"
          maxLength={ONBOARDING_FIELD_LIMITS.email}
          required
          trailing={registerEmailTouched ? (
            registerEmailValid
              ? <Check className="h-5 w-5 text-emerald-500" data-testid="RegisterEmailValid__79cf84" />
              : <AlertCircle className="h-5 w-5 text-rose-500" data-testid="RegisterEmailInvalid__79cf84" />
          ) : null}
          data-testid="AuthField__79cf84" />

        {askPhone && (
          <div>
            <Label
              htmlFor="reg-phone"
              className="mb-2 block text-sm font-medium leading-6 text-[#121217]"
              data-testid="Label__phone">
              {ui('onboardingPhoneLabel')}
              <span className="ml-2 font-normal text-slate-500">{ui('onboardingOptionalHint')}</span>
            </Label>
            <div className="flex gap-3">
              <select
                id="reg-phone-prefix"
                aria-label={ui('onboardingPhonePrefixLabel')}
                value={phonePrefix}
                onChange={e => setPhonePrefix(e.target.value)}
                disabled={registerLoading}
                className="h-10 w-32 shrink-0 rounded-lg border border-[#D1D4DB] bg-white px-3 text-sm text-[#121217] shadow-[0_1px_2px_rgba(18,18,23,0.05)] transition-colors hover:border-slate-400 focus:outline-none focus:border-slate-400"
                data-testid="phone-prefix-select">
                <option value="">{ui('onboardingPhonePrefixPlaceholder')}</option>
                {phonePrefixOptions.map(option => (
                  <option key={option.value} value={option.value} title={option.name}>
                    {`${option.flag} ${option.label}`}
                  </option>
                ))}
              </select>
              <AuthField
                id="reg-phone"
                type="tel"
                className="flex-1"
                icon={Phone}
                value={phoneNumber}
                onChange={e => setPhoneNumber(e.target.value)}
                disabled={registerLoading}
                placeholder={ui('onboardingPhonePlaceholder')}
                autoComplete="tel-national"
                maxLength={PHONE_NUMBER_MAX_LENGTH}
                error={phoneNumberInvalid ? ui('onboardingPhoneInvalid') : null}
                data-testid="phone-number-input" />
            </div>
          </div>
        )}

        {askPassword && (
          <>
            <AuthField
              id="reg-password"
              type={showRegisterPassword ? 'text' : 'password'}
              label={ui('onboardingPasswordLabel')}
              icon={Lock}
              value={registerForm.password}
              onChange={e => setRegisterForm(f => ({ ...f, password: e.target.value }))}
              disabled={registerLoading}
              placeholder={ui('onboardingPasswordPlaceholder')}
              autoComplete="new-password"
              maxLength={ONBOARDING_FIELD_LIMITS.password}
              required
              trailing={(
                <button
                  type="button"
                  aria-label={showRegisterPassword ? ui('onboardingHidePassword') : ui('onboardingShowPassword')}
                  onClick={() => setShowRegisterPassword(value => !value)}
                  className="rounded-full p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                >
                  {showRegisterPassword ? <EyeOff className="h-5 w-5" data-testid="EyeOff__79cf84" /> : <Eye className="h-5 w-5" data-testid="Eye__79cf84" />}
                </button>
              )}
              data-testid="AuthField__79cf84" />

            <PasswordStrengthChecklist
              password={registerForm.password}
              testIdPrefix="register-password"
              data-testid="PasswordStrengthChecklist__79cf84" />
          </>
        )}

        {registerError && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-600">
            {registerError}
          </div>
        )}

        <Button
          type="submit"
          data-testid="action-register-submit"
          disabled={registerLoading || !registerPasswordStrong || !registerEmailValid || phoneNumberInvalid}
          className="h-12 w-full rounded-lg bg-[#121217] text-base font-medium text-white hover:bg-accent-highlight hover:text-accent-highlight-foreground"
        >
          {registerLoading
            ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" data-testid="Loader2__79cf84" />{ui('onboardingCreatingAccount')}</>
            : ui('onboardingCreateAccountAction')}
        </Button>
      </form>
      {/* ETP-6081 — below both paths on purpose: the SSO button creates the account without
          submitting the form, so the acceptance has to cover it too. */}
      <p className="mt-5 text-center text-sm text-slate-500" data-testid="register-terms-notice">
        {ui('onboardingTermsNoticePrefix')}
        <button
          type="button"
          onClick={() => {
            setTermsOpen(true);
            if (!terms.data && !terms.loading) loadTerms();
          }}
          className="font-medium text-slate-900 underline underline-offset-2 hover:text-slate-700"
          data-testid="register-terms-link">
          {ui('onboardingTermsLink')}
        </button>
        {ui('onboardingTermsNoticeSuffix')}
      </p>
      <TermsDialog
        open={termsOpen}
        onOpenChange={setTermsOpen}
        terms={terms.data}
        loading={terms.loading}
        error={terms.error}
        onRetry={loadTerms}
        ui={ui}
        data-testid="TermsDialog__79cf84" />
    </AuthShell>
  );
}

export default RegisterStep;
