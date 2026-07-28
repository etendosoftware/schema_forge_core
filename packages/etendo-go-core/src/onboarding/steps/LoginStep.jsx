import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Lock, Mail, Eye, EyeOff, Loader2, ArrowLeft, Check } from 'lucide-react';
import { Button } from '@etendosoftware/app-shell-core/components/ui/button';
import { useUI, useLocaleSwitch } from '@etendosoftware/app-shell-core/i18n';
import { loginAccount, loginWithSsoProvider, requestPasswordReset, confirmPasswordReset, fetchAccount, fetchEnvironments } from '../api.js';
import { getConfiguredSsoProviders, renderSsoProviderButton } from '../sso.js';
import { trackOnboarding } from '../tracking.js';
import { AuthShell } from '../components/AuthShell.jsx';
import { AuthField } from '../components/AuthField.jsx';
import { AuthSsoOptions } from '../components/AuthSsoOptions.jsx';
import { DraftSaveWarning } from '../components/DraftSaveWarning.jsx';
import { OnboardingLanguageSelect } from '../components/OnboardingLanguageSelect.jsx';

const AUTH_FEATURE_KEYS = ['onboardingAuthFeatureNoCard', 'onboardingAuthFeatureTrial', 'onboardingAuthFeatureInstantAccess'];

function maskEmail(email) {
  const at = String(email || '').indexOf('@');
  if (at <= 0) return email || '';
  return `${email[0]}******${email.slice(at)}`;
}

export function LoginStep({ config, stepData, onNext, onBack, goToStep, setToken, setAccountName, routeByEnvironments, draftSaveWarning }) {
  const ui = useUI();
  const { locale, setLocale } = useLocaleSwitch();

  const resetTokenFromUrl = new URLSearchParams(window.location.search).get('resetToken') || '';
  const [view, setView] = useState(resetTokenFromUrl ? 'reset-password' : 'login'); // 'login' | 'forgot-password' | 'reset-password'

  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [loginError, setLoginError] = useState(null);
  const [loginNotice, setLoginNotice] = useState(null);
  const [loginLoading, setLoginLoading] = useState(false);
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotError, setForgotError] = useState(null);

  const [resetForm, setResetForm] = useState({
    token: resetTokenFromUrl,
    password: '',
    confirmPassword: '',
  });
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [resetError, setResetError] = useState(null);
  const [showResetPassword, setShowResetPassword] = useState(false);

  const [ssoError, setSsoError] = useState(null);
  const [ssoLoadingProvider, setSsoLoadingProvider] = useState(null);
  const loginSsoButtonRef = useRef(null);

  const SSO_PROVIDERS = getConfiguredSsoProviders();
  const apiBase = config.apiBase || '';

  useEffect(() => {
    const notice = localStorage.getItem('sf_onboarding_notice');
    if (notice) {
      localStorage.removeItem('sf_onboarding_notice');
      if (notice === 'password-changed') {
        setLoginNotice('onboardingPasswordChangedNotice');
      }
    }
  }, []);

  const handleAuthSuccess = useCallback((token, account, { route = true, authMethod = 'password' } = {}) => {
    localStorage.setItem('sf_platform_token', token);
    localStorage.setItem('sf_platform_auth_method', authMethod);
    if (setToken) setToken(token);
    if (setAccountName) setAccountName(account?.name || account?.email || null);
    setShowLoginPassword(false);
    setSsoError(null);
    setSsoLoadingProvider(null);
    if (route && routeByEnvironments) {
      routeByEnvironments(token);
    }
  }, [setToken, setAccountName, routeByEnvironments]);

  const handleSsoProviderLogin = useCallback(async (provider, payload) => {
    trackOnboarding(config, 'onboarding_auth_submitted', {
      action: 'sso',
      provider,
      status: 'started',
    });
    setSsoError(null);
    setLoginError(null);
    setSsoLoadingProvider(provider);
    try {
      const data = await loginWithSsoProvider(fetch, apiBase, provider, payload);
      if (data.token) {
        trackOnboarding(config, 'onboarding_auth_succeeded', {
          action: 'sso',
          provider,
          status: 'success',
        });
        handleAuthSuccess(data.token, data.account, { authMethod: 'sso' });
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
  }, [handleAuthSuccess, ui, apiBase, config]);

  useEffect(() => {
    if (view !== 'login' || !loginSsoButtonRef.current || !SSO_PROVIDERS.length) {
      return undefined;
    }
    let cancelled = false;
    const container = loginSsoButtonRef.current;
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
  }, [handleSsoProviderLogin, ui, view, SSO_PROVIDERS.length]);

  const handleLogin = async (e) => {
    e.preventDefault();
    trackOnboarding(config, 'onboarding_auth_submitted', {
      action: 'login',
      status: 'started',
    });
    setLoginError(null);
    setLoginNotice(null);
    setLoginLoading(true);
    try {
      const data = await loginAccount(fetch, apiBase, loginForm);
      if (data.token) {
        trackOnboarding(config, 'onboarding_auth_succeeded', {
          action: 'login',
          status: 'success',
        });
        handleAuthSuccess(data.token, data.account);
      } else {
        trackOnboarding(config, 'onboarding_auth_failed', {
          action: 'login',
          status: 'failed',
        });
        setLoginError(ui('onboardingInvalidCredentials'));
      }
    } catch (err) {
      trackOnboarding(config, 'onboarding_auth_failed', {
        action: 'login',
        status: 'failed',
      });
      setLoginError(err.userMessage || ui(err.code || 'onboardingConnectionError'));
    } finally {
      setLoginLoading(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e?.preventDefault();
    setForgotError(null);
    setForgotSent(false);
    setForgotLoading(true);
    try {
      await requestPasswordReset(fetch, apiBase, forgotEmail);
      setForgotSent(true);
    } catch (err) {
      setForgotError(err.userMessage || ui(err.code || 'onboardingCredentialResetFailed'));
    } finally {
      setForgotLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setResetError(null);
    if (resetForm.password !== resetForm.confirmPassword) {
      setResetError(ui('onboardingCredentialsMustMatch'));
      return;
    }
    setResetLoading(true);
    try {
      await confirmPasswordReset(fetch, apiBase, resetForm);
      localStorage.removeItem('sf_platform_token');
      localStorage.removeItem('sf_platform_auth_method');
      if (setToken) setToken(null);
      if (setAccountName) setAccountName(null);
      setResetSuccess(true);
      window.history.replaceState({}, document.title, window.location.pathname);
    } catch (err) {
      setResetError(err.userMessage || ui(err.code || 'onboardingCredentialResetFailed'));
    } finally {
      setResetLoading(false);
    }
  };

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

  const authFeatureLabels = AUTH_FEATURE_KEYS.map((key) => ui(key));

  if (view === 'reset-password') {
    return (
      <AuthShell
        brandLabel={config.brandLabel || 'Etendo GO'}
        headerContent={localeControl}
        marketingTitle={ui('onboardingMarketingTitle')}
        marketingDescription={ui('onboardingMarketingDescription')}
        featureLabels={authFeatureLabels}
        data-testid="AuthShell__79cf84">
        {resetSuccess ? (
          <div className="flex flex-col items-center text-center">
            <div className="mb-2 flex h-[52px] w-[52px] items-center justify-center rounded-full bg-[#26A95F]" data-testid="reset-success-icon">
              <Check className="h-8 w-8 text-white" strokeWidth={3} data-testid="Check__79cf84" />
            </div>
            <h1 className="text-3xl font-semibold tracking-[-0.06em] text-slate-900 sm:text-[2.7rem] sm:leading-[1.04]">
              {ui('onboardingResetPasswordSuccessTitle')}
            </h1>
            <p className="mt-2 text-base text-slate-600 sm:text-xl">
              {ui('onboardingResetPasswordSuccess')}
            </p>
            <Button
              type="button"
              onClick={() => setView('login')}
              className="mt-5 h-10 w-full rounded-lg bg-[#121217] text-sm font-medium leading-6 text-white hover:bg-accent-highlight hover:text-accent-highlight-foreground"
              data-testid="Button__79cf84">
              {ui('onboardingLoginAction')}
            </Button>
          </div>
        ) : (
          <>
          <div className="mb-5">
            <h1 className="text-3xl font-semibold tracking-[-0.06em] text-slate-900 sm:text-[2.7rem] sm:leading-[1.04]">
              {ui('onboardingResetPasswordTitle')}
            </h1>
            <p className="mt-0 text-base text-slate-600 sm:text-xl">
              {ui('onboardingResetPasswordSubtitle')}
            </p>
          </div>
          <form onSubmit={handleResetPassword} className="space-y-5">
            <AuthField
              id="reset-password"
              type={showResetPassword ? 'text' : 'password'}
              label={ui('onboardingNewPasswordLabel')}
              icon={Lock}
              value={resetForm.password}
              onChange={e => setResetForm(f => ({ ...f, password: e.target.value }))}
              disabled={resetLoading}
              placeholder={ui('onboardingPasswordPlaceholder')}
              autoComplete="new-password"
              required
              trailing={(
                <button
                  type="button"
                  aria-label={showResetPassword ? ui('onboardingHidePassword') : ui('onboardingShowPassword')}
                  onClick={() => setShowResetPassword(value => !value)}
                  className="rounded-full p-1 text-[#828FA3] transition hover:bg-slate-100 hover:text-slate-600"
                >
                  {showResetPassword ? <EyeOff className="h-6 w-6" data-testid="EyeOff__79cf84" /> : <Eye className="h-6 w-6" data-testid="Eye__79cf84" />}
                </button>
              )}
              data-testid="AuthField__79cf84" />
            <AuthField
              id="reset-password-confirm"
              type={showResetPassword ? 'text' : 'password'}
              label={ui('onboardingConfirmPasswordLabel')}
              icon={Lock}
              value={resetForm.confirmPassword}
              onChange={e => setResetForm(f => ({ ...f, confirmPassword: e.target.value }))}
              disabled={resetLoading}
              placeholder={ui('onboardingPasswordPlaceholder')}
              autoComplete="new-password"
              required
              data-testid="AuthField__79cf84" />
            {resetError && (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-600">
                {resetError}
              </div>
            )}
            <Button
              type="submit"
              data-testid="action-reset-password-submit"
              disabled={resetLoading || !resetForm.token}
              className="h-10 w-full rounded-lg bg-[#121217] text-sm font-medium leading-6 text-white hover:bg-accent-highlight hover:text-accent-highlight-foreground"
            >
              {resetLoading
                ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" data-testid="Loader2__79cf84" />{ui('onboardingSavingPassword')}</>
                : ui('onboardingSavePasswordAction')}
            </Button>
          </form>
          </>
        )}
      </AuthShell>
    );
  }

  if (view === 'forgot-password') {
    return (
      <AuthShell
        brandLabel={config.brandLabel || 'Etendo GO'}
        headerContent={localeControl}
        marketingTitle={ui('onboardingMarketingTitle')}
        marketingDescription={ui('onboardingMarketingDescription')}
        featureLabels={authFeatureLabels}
        data-testid="AuthShell__79cf84">
        {forgotSent ? (
          <div>
            <div className="mb-5">
              <h1 className="text-3xl font-semibold tracking-[-0.06em] text-slate-900 sm:text-[2.7rem] sm:leading-[1.04]">
                {ui('onboardingResetEmailSentTitle')}
              </h1>
              <p className="mt-0 text-base text-slate-600 sm:text-xl">
                {ui('onboardingResetEmailSentSubtitle').replace('{email}', maskEmail(forgotEmail))}
              </p>
              <p className="mt-5 text-base text-slate-600 sm:text-xl">
                {(() => {
                  const [prefix, suffix] = ui('onboardingResetLinkValidity').split('{duration}');
                  return <>{prefix}<strong className="font-semibold text-[#121217]">{ui('onboardingResetLinkDuration')}</strong>{suffix}</>;
                })()}
              </p>
              <p className="mt-5 text-base text-slate-600 sm:text-xl">{ui('onboardingResendPrompt')}</p>
            </div>
            {forgotError && (
              <div className="mb-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-600">
                {forgotError}
              </div>
            )}
            <div className="space-y-3">
              <Button
                type="button"
                onClick={() => handleForgotPassword()}
                disabled={forgotLoading}
                data-testid="action-forgot-password-resend"
                className="h-10 w-full rounded-lg bg-[#121217] text-sm font-medium leading-6 text-white hover:bg-accent-highlight hover:text-accent-highlight-foreground"
              >
                {forgotLoading
                  ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" data-testid="Loader2__79cf84" />{ui('onboardingSendingResetEmail')}</>
                  : ui('onboardingResendLinkAction')}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setForgotError(null);
                  setForgotSent(false);
                  setView('login');
                }}
                className="h-10 w-full gap-1 rounded-lg border-[#D1D4DB] bg-white px-3 text-sm font-medium leading-6 text-[#121217] shadow-[0_1px_2px_rgba(18,18,23,0.05)] hover:bg-slate-50"
                data-testid="action-forgot-password-back-to-login"
              >
                <ArrowLeft className="h-7 w-7 text-[#828FA3]" data-testid="ArrowLeft__79cf84" />
                {ui('onboardingBackToLoginAction')}
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="mb-5">
              <h1 className="text-3xl font-semibold tracking-[-0.06em] text-slate-900 sm:text-[2.7rem] sm:leading-[1.04]">
                {ui('onboardingForgotPasswordTitle')}
              </h1>
              <p className="mt-0 text-base text-slate-600 sm:text-xl">
                {ui('onboardingForgotPasswordSubtitle')}
              </p>
            </div>
            <form onSubmit={handleForgotPassword} className="space-y-5">
              <AuthField
                id="forgot-email"
                type="email"
                label={ui('onboardingEmailLabel')}
                icon={Mail}
                value={forgotEmail}
                onChange={e => setForgotEmail(e.target.value)}
                disabled={forgotLoading}
                placeholder={ui('onboardingEmailPlaceholder')}
                autoComplete="email"
                required
                data-testid="AuthField__79cf84" />
              {forgotError && (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-600">
                  {forgotError}
                </div>
              )}
              <Button
                type="submit"
                data-testid="action-forgot-password-submit"
                disabled={forgotLoading}
                className="h-10 w-full rounded-lg bg-[#121217] text-sm font-medium leading-6 text-white hover:bg-accent-highlight hover:text-accent-highlight-foreground"
              >
                {forgotLoading
                  ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" data-testid="Loader2__79cf84" />{ui('onboardingSendingResetEmail')}</>
                  : ui('onboardingSendResetEmailAction')}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setForgotError(null);
                  setForgotSent(false);
                  setView('login');
                }}
                className="h-10 w-full gap-1 rounded-lg border-[#D1D4DB] bg-white px-3 text-sm font-medium leading-6 text-[#121217] shadow-[0_1px_2px_rgba(18,18,23,0.05)] hover:bg-slate-50"
                data-testid="action-forgot-password-back-to-login"
              >
                <ArrowLeft className="h-7 w-7 text-[#828FA3]" data-testid="ArrowLeft__79cf84" />
                {ui('onboardingBackToLoginAction')}
              </Button>
            </form>
          </>
        )}
      </AuthShell>
    );
  }

  return (
    <AuthShell
      switchPrompt={ui('onboardingSwitchToRegisterPrompt')}
      switchAction={ui('onboardingSwitchToRegisterAction')}
      switchTestId="action-switch-to-register"
      onSwitch={() => {
        setLoginError(null);
        setLoginNotice(null);
        setSsoError(null);
        setShowLoginPassword(false);
        if (goToStep) goToStep('register');
      }}
      brandLabel={config.brandLabel || 'Etendo GO'}
      headerContent={localeControl}
      marketingTitle={ui('onboardingMarketingTitle')}
      marketingDescription={ui('onboardingMarketingDescription')}
      featureLabels={authFeatureLabels}
      data-testid="AuthShell__79cf84">
      <div className="mb-5">
        <h1 className="text-3xl font-semibold tracking-[-0.06em] text-slate-900 sm:text-[2.7rem] sm:leading-[1.04]">
          {ui('onboardingLoginTitle')}
        </h1>
        <p className="mt-0 text-base text-slate-600 sm:text-xl">
          {ui('onboardingLoginSubtitle')}
        </p>
      </div>

      <DraftSaveWarning show={draftSaveWarning} message={ui('onboardingDraftSaveWarning')} />

      {loginNotice && (
        <div
          data-testid="login-notice"
          className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700"
        >
          {ui(loginNotice)}
        </div>
      )}

      <AuthSsoOptions
        providers={SSO_PROVIDERS}
        buttonRef={loginSsoButtonRef}
        error={ssoError}
        loading={Boolean(ssoLoadingProvider)}
        label={ui('onboardingSsoDivider')}
        loadingLabel={ui('onboardingSsoSigningIn')}
        data-testid="AuthSsoOptions__79cf84" />
      <form onSubmit={handleLogin} className="space-y-5">
        <AuthField
          id="login-email"
          type="email"
          label={ui('onboardingEmailLabel')}
          icon={Mail}
          value={loginForm.email}
          onChange={e => setLoginForm(f => ({ ...f, email: e.target.value }))}
          disabled={loginLoading}
          placeholder={ui('onboardingEmailPlaceholder')}
          autoComplete="email"
          required
          data-testid="AuthField__79cf84" />

        <div className="flex flex-col gap-3">
          <AuthField
            id="login-password"
            type={showLoginPassword ? 'text' : 'password'}
            label={ui('onboardingPasswordLabel')}
            icon={Lock}
            value={loginForm.password}
            onChange={e => setLoginForm(f => ({ ...f, password: e.target.value }))}
            disabled={loginLoading}
            placeholder={ui('onboardingPasswordPlaceholder')}
            autoComplete="current-password"
            required
            trailing={(
              <button
                type="button"
                aria-label={showLoginPassword ? ui('onboardingHidePassword') : ui('onboardingShowPassword')}
                onClick={() => setShowLoginPassword(value => !value)}
                className="rounded-full p-1 text-[#828FA3] transition hover:bg-slate-100 hover:text-slate-600"
              >
                {showLoginPassword ? <EyeOff className="h-6 w-6" data-testid="EyeOff__79cf84" /> : <Eye className="h-6 w-6" data-testid="Eye__79cf84" />}
              </button>
            )}
            data-testid="AuthField__79cf84" />

          <button
            type="button"
            onClick={() => {
              setLoginError(null);
              setForgotEmail(loginForm.email);
              setForgotSent(false);
              setForgotError(null);
              setView('forgot-password');
            }}
            className="self-start text-sm font-medium leading-5 text-[#121217] underline underline-offset-4 transition hover:text-slate-700"
          >
            {ui('onboardingForgotPasswordAction')}
          </button>
        </div>

        {loginError && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-600">
            {loginError}
          </div>
        )}

        <Button
          type="submit"
          data-testid="action-login-submit"
          disabled={loginLoading}
          className="h-10 w-full rounded-lg bg-[#121217] text-sm font-medium leading-6 text-white hover:bg-accent-highlight hover:text-accent-highlight-foreground"
        >
          {loginLoading
            ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" data-testid="Loader2__79cf84" />{ui('onboardingSigningIn')}</>
            : ui('onboardingLoginAction')}
        </Button>
      </form>
    </AuthShell>
  );
}

export default LoginStep;
