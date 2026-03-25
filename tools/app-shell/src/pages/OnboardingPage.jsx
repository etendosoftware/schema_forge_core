import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Loader2, Check, ChevronRight, ChevronDown,
  Plus, LogIn, Building2, RefreshCw,
  Briefcase, Users, Database, FileText, Rocket, Settings,
} from 'lucide-react';

const SETUP_STEPS = [
  { name: 'createClient', label: 'Crear empresa', icon: Briefcase, estimate: '2 min' },
  { name: 'createOrganization', label: 'Crear organizacion', icon: Building2, estimate: '1 min' },
  { name: 'createRole', label: 'Configurar roles', icon: Users, estimate: '1 min' },
  { name: 'seedReferenceData', label: 'Datos de referencia', icon: Database, estimate: '3 min' },
  { name: 'createDocTypes', label: 'Tipos de documento', icon: FileText, estimate: '1 min' },
  { name: 'markOrgReady', label: 'Finalizar configuracion', icon: Rocket, estimate: '1 min' },
];

const CURRENCIES = ['EUR', 'USD', 'ARS', 'GBP', 'BRL', 'MXN', 'CLP', 'COP'];
const LANGUAGES = [
  { value: 'es_ES', label: 'Espanol' },
  { value: 'en_US', label: 'English' },
];
const COUNTRIES = [
  { value: 'AR', label: 'Argentina' },
  { value: 'ES', label: 'Espana' },
  { value: 'US', label: 'United States' },
  { value: 'MX', label: 'Mexico' },
  { value: 'BR', label: 'Brasil' },
  { value: 'CL', label: 'Chile' },
  { value: 'CO', label: 'Colombia' },
  { value: 'GB', label: 'United Kingdom' },
];

function formatMs(ms) {
  if (ms == null) return null;
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function StepIcon({ status, Icon }) {
  if (status === 'done') {
    return (
      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-green-500 flex-shrink-0">
        <Check className="h-5 w-5 text-white" strokeWidth={3} />
      </div>
    );
  }
  if (status === 'active') {
    return (
      <div className="flex items-center justify-center w-8 h-8 rounded-full border-2 border-gray-900 bg-white flex-shrink-0">
        <Icon className="h-4 w-4 text-gray-900" />
      </div>
    );
  }
  if (status === 'running') {
    return (
      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-amber-400 flex-shrink-0">
        <Loader2 className="h-4 w-4 text-white animate-spin" />
      </div>
    );
  }
  if (status === 'failed') {
    return (
      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-red-500 flex-shrink-0">
        <span className="text-white text-sm font-bold">!</span>
      </div>
    );
  }
  // pending
  return (
    <div className="flex items-center justify-center w-8 h-8 rounded-full border border-gray-200 bg-gray-50 flex-shrink-0">
      <Icon className="h-4 w-4 text-gray-400" />
    </div>
  );
}

function SelectField({ id, value, onChange, disabled, children, label }) {
  return (
    <div>
      <Label htmlFor={id} className="text-sm text-gray-600">{label}</Label>
      <select
        id={id}
        value={value}
        onChange={onChange}
        disabled={disabled}
        className="mt-1 flex h-11 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent transition-shadow"
      >
        {children}
      </select>
    </div>
  );
}

export default function OnboardingPage() {
  const navigate = useNavigate();
  const [view, setView] = useState('list');
  const [environments, setEnvironments] = useState([]);
  const [loadingEnvs, setLoadingEnvs] = useState(true);
  const [loggingIn, setLoggingIn] = useState(null);

  // Create form
  const [form, setForm] = useState({
    clientName: '', orgName: '', adminUser: '', adminPassword: '',
    currency: 'EUR', language: 'es_ES', countryCode: 'AR',
  });
  const [steps, setSteps] = useState(
    SETUP_STEPS.map(s => ({ ...s, status: 'pending', ms: null, error: null }))
  );
  const [result, setResult] = useState(null);
  const [running, setRunning] = useState(false);
  const [formSubmitted, setFormSubmitted] = useState(false);

  const systemToken = import.meta.env.VITE_SYSTEM_TOKEN;
  const token = systemToken || localStorage.getItem('token');

  // API base: use VITE_ETENDO_URL directly (bypass proxy), fallback to relative path in production
  const etendoUrl = import.meta.env.VITE_ETENDO_URL || '';
  const apiBase = etendoUrl ? `${etendoUrl}/sws/go/onboarding` : '/sws/go/onboarding';

  // Load environments
  const loadEnvironments = useCallback(async () => {
    setLoadingEnvs(true);
    try {
      const res = await fetch(`${apiBase}?action=environments`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        setEnvironments(data.environments || []);
      }
    } catch (err) {
      console.error('Failed to load environments', err);
    } finally {
      setLoadingEnvs(false);
    }
  }, [token]);

  useEffect(() => { loadEnvironments(); }, [loadEnvironments]);

  const loginToEnvironment = async (env) => {
    setLoggingIn(env.clientId);
    try {
      const res = await fetch(`${apiBase}?action=login&userId=${env.adminUserId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        if (data.token) {
          localStorage.setItem('token', data.token);
          window.location.href = '/dashboard';
          return;
        }
      }
      alert('Login failed.');
    } catch (err) {
      alert('Login error: ' + err.message);
    } finally {
      setLoggingIn(null);
    }
  };

  const runOnboarding = useCallback(async () => {
    setRunning(true);
    setResult(null);
    setFormSubmitted(true);
    setSteps(SETUP_STEPS.map(s => ({ ...s, status: 'pending', ms: null, error: null })));

    let succeededToken = null;
    try {
      const res = await fetch(apiBase, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(form),
      });

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (value) buffer += decoder.decode(value, { stream: !done });
        if (done) buffer += decoder.decode();

        const lines = buffer.split('\n');
        buffer = done ? '' : lines.pop();

        for (const line of lines) {
          if (!line.trim()) continue;
          const msg = JSON.parse(line);
          if (msg.result || msg.status === 'success') {
            setResult(msg);
            if (msg.status === 'success' && msg.token) succeededToken = msg.token;
          } else if (msg.step) {
            setSteps(prev => prev.map((s, i) =>
              i === msg.step - 1
                ? { ...s, status: msg.status, ms: msg.ms || null, error: msg.error || null }
                : s
            ));
          }
        }
        if (done) break;
      }
    } catch (err) {
      setResult({ result: 'failed', error: err.message });
    } finally {
      setRunning(false);
      if (succeededToken) {
        localStorage.setItem('token', succeededToken);
        setTimeout(() => { window.location.href = '/dashboard'; }, 100);
      }
    }
  }, [form, token]);

  const updateField = (field, value) => setForm(f => ({ ...f, [field]: value }));
  const isFormValid = form.clientName && form.orgName && form.adminUser && form.adminPassword;

  // Calculate progress
  const completedCount = steps.filter(s => s.status === 'done').length;
  const totalSteps = steps.length + 1; // +1 for the form step
  const progressPercent = formSubmitted
    ? Math.round(((completedCount + 1) / totalSteps) * 100)
    : 0;

  // ── LIST VIEW ──
  if (view === 'list') {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white border-b border-gray-100 px-6 py-4">
          <div className="max-w-2xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-amber-400 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">E</span>
              </div>
              <span className="font-semibold text-gray-900">Etendo</span>
            </div>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={loadEnvironments}
                disabled={loadingEnvs}
                className="text-gray-500"
              >
                <RefreshCw className={`h-4 w-4 ${loadingEnvs ? 'animate-spin' : ''}`} />
              </Button>
              <Button
                onClick={() => setView('create')}
                className="bg-amber-400 hover:bg-amber-500 text-white"
              >
                <Plus className="h-4 w-4 mr-1" /> Nuevo entorno
              </Button>
            </div>
          </div>
        </header>

        <div className="max-w-2xl mx-auto p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Tus entornos</h1>
          <p className="text-gray-500 text-sm mb-6">
            Selecciona un entorno para comenzar a trabajar.
          </p>

          {loadingEnvs ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : environments.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
              <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Building2 className="h-8 w-8 text-gray-300" />
              </div>
              <p className="text-lg font-medium text-gray-900 mb-1">Sin entornos</p>
              <p className="text-gray-500 text-sm mb-6">Crea tu primer entorno para comenzar.</p>
              <Button
                onClick={() => setView('create')}
                className="bg-amber-400 hover:bg-amber-500 text-white"
              >
                <Plus className="h-4 w-4 mr-1" /> Crear entorno
              </Button>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-100 divide-y divide-gray-50">
              {environments.map(env => (
                <div
                  key={env.clientId}
                  className="flex items-center justify-between px-5 py-4 hover:bg-gray-50/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-amber-50 rounded-lg flex items-center justify-center">
                      <Building2 className="h-5 w-5 text-amber-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{env.clientName}</p>
                      <p className="text-sm text-gray-500">
                        {env.orgName || '\u2014'} &middot; {env.adminUser || '\u2014'}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => loginToEnvironment(env)}
                    disabled={loggingIn === env.clientId}
                    className="text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                  >
                    {loggingIn === env.clientId ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>Entrar <ChevronRight className="h-4 w-4 ml-1" /></>
                    )}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── CREATE VIEW (matches "Primeros pasos" design) ──
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-amber-400 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">E</span>
            </div>
            <span className="font-semibold text-gray-900">Etendo</span>
          </div>
          {!running && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setView('list'); setResult(null); setFormSubmitted(false); }}
              className="text-gray-500"
            >
              Mis entornos
            </Button>
          )}
        </div>
      </header>

      {/* Progress bar — always visible */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-2xl mx-auto px-6 py-3 flex items-center gap-3">
          <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gray-900 rounded-full transition-all duration-700 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <span className="text-xs text-gray-400 whitespace-nowrap">
            {result?.status === 'success'
              ? 'Listo'
              : completedCount === 0 && !formSubmitted
                ? 'Primeros pasos'
                : `Paso ${completedCount + (formSubmitted ? 1 : 0)} de ${totalSteps}`
            }
          </span>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-6">
        {/* Title */}
        <h1 className="text-2xl font-bold text-gray-900 mb-1">
          Vamos a preparar tu cuenta
        </h1>
        <p className="text-gray-500 text-sm mb-6">
          Completa los datos y en menos de 10 minutos tendras todo listo para empezar.
        </p>

        {/* Steps list */}
        <div className="bg-white rounded-xl border border-gray-100">

          {/* Step 0: Configuration form */}
          <div className="border-b border-gray-50">
            <button
              type="button"
              className="w-full flex items-center gap-4 px-5 py-4 text-left"
              onClick={() => !running && setFormSubmitted(false)}
              disabled={running}
            >
              <StepIcon
                status={formSubmitted ? 'done' : 'active'}
                Icon={Settings}
              />
              <div className="flex-1 min-w-0">
                <p className={`text-lg font-semibold ${formSubmitted ? 'text-gray-500' : 'text-gray-900'}`}>
                  Datos de tu empresa
                </p>
                {formSubmitted && !running && (
                  <p className="text-xs text-gray-400 mt-0.5">{form.clientName} &middot; {form.orgName}</p>
                )}
              </div>
              {!formSubmitted && (
                <ChevronDown className="h-4 w-4 text-gray-400" />
              )}
            </button>

            {/* Inline form (shown when not submitted) */}
            {!formSubmitted && (
              <div className="px-5 pb-5 pt-1 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="clientName" className="text-sm text-gray-600">
                      Nombre de la empresa <span className="text-red-400">*</span>
                    </Label>
                    <Input
                      id="clientName"
                      value={form.clientName}
                      onChange={e => updateField('clientName', e.target.value)}
                      disabled={running}
                      placeholder="Mi Empresa S.A."
                      className="mt-1 h-11 rounded-lg border-gray-200 focus:ring-amber-400 focus:border-amber-400"
                    />
                  </div>
                  <div>
                    <Label htmlFor="orgName" className="text-sm text-gray-600">
                      Nombre de la organizacion <span className="text-red-400">*</span>
                    </Label>
                    <Input
                      id="orgName"
                      value={form.orgName}
                      onChange={e => updateField('orgName', e.target.value)}
                      disabled={running}
                      placeholder="Sucursal Principal"
                      className="mt-1 h-11 rounded-lg border-gray-200 focus:ring-amber-400 focus:border-amber-400"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="adminUser" className="text-sm text-gray-600">
                      Email del administrador <span className="text-red-400">*</span>
                    </Label>
                    <Input
                      id="adminUser"
                      type="email"
                      value={form.adminUser}
                      onChange={e => updateField('adminUser', e.target.value)}
                      disabled={running}
                      placeholder="admin@miempresa.com"
                      className="mt-1 h-11 rounded-lg border-gray-200 focus:ring-amber-400 focus:border-amber-400"
                    />
                  </div>
                  <div>
                    <Label htmlFor="adminPassword" className="text-sm text-gray-600">
                      Contrasena <span className="text-red-400">*</span>
                    </Label>
                    <Input
                      id="adminPassword"
                      type="password"
                      value={form.adminPassword}
                      onChange={e => updateField('adminPassword', e.target.value)}
                      disabled={running}
                      placeholder="********"
                      className="mt-1 h-11 rounded-lg border-gray-200 focus:ring-amber-400 focus:border-amber-400"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <SelectField
                    id="currency"
                    value={form.currency}
                    onChange={e => updateField('currency', e.target.value)}
                    disabled={running}
                    label="Moneda"
                  >
                    {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </SelectField>
                  <SelectField
                    id="language"
                    value={form.language}
                    onChange={e => updateField('language', e.target.value)}
                    disabled={running}
                    label="Idioma"
                  >
                    {LANGUAGES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                  </SelectField>
                  <SelectField
                    id="countryCode"
                    value={form.countryCode}
                    onChange={e => updateField('countryCode', e.target.value)}
                    disabled={running}
                    label="Pais"
                  >
                    {COUNTRIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </SelectField>
                </div>
                <div className="pt-2">
                  <Button
                    onClick={runOnboarding}
                    disabled={running || !isFormValid}
                    className="w-full h-11 bg-gray-900 hover:bg-gray-800 text-white rounded-lg text-sm font-medium"
                  >
                    {running
                      ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creando...</>
                      : <><ChevronRight className="mr-1 h-4 w-4" />Crear entorno</>
                    }
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Automated steps */}
          {steps.map((step, i) => {
            const isExpanded = step.status === 'running' || step.status === 'failed';
            const isPending = step.status === 'pending';
            const isDone = step.status === 'done';

            return (
              <div
                key={step.name}
                className={`${i < steps.length - 1 ? 'border-b border-gray-50' : ''}`}
              >
                <div className="flex items-center gap-4 px-5 py-4">
                  <StepIcon status={step.status} Icon={step.icon} />
                  <div className="flex-1 min-w-0">
                    <p className={`text-lg font-semibold ${
                      isDone ? 'text-gray-500' :
                      step.status === 'running' ? 'text-gray-900' :
                      step.status === 'failed' ? 'text-red-600' :
                      'text-gray-400'
                    }`}>
                      {step.label}
                    </p>
                    {step.status === 'running' && (
                      <p className="text-xs text-amber-600 mt-0.5">Procesando...</p>
                    )}
                    {step.status === 'failed' && (
                      <p className="text-xs text-red-500 mt-0.5 break-all">{step.error}</p>
                    )}
                  </div>
                  <div className="text-right">
                    {isDone && step.ms != null && (
                      <span className="text-xs text-gray-400">{formatMs(step.ms)}</span>
                    )}
                    {isPending && (
                      <span className="text-xs text-gray-300">{step.estimate}</span>
                    )}
                    {step.status === 'running' && (
                      <Loader2 className="h-3 w-3 animate-spin text-amber-400" />
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Result message */}
        {result && (
          <div className={`mt-4 rounded-xl border p-5 ${
            result.status === 'success'
              ? 'bg-green-50 border-green-200'
              : 'bg-red-50 border-red-200'
          }`}>
            {result.status === 'success' ? (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                  <Check className="h-5 w-5 text-white" strokeWidth={3} />
                </div>
                <div>
                  <p className="font-medium text-green-900">Entorno creado</p>
                  <p className="text-sm text-green-700">
                    Listo en {formatMs(result.totalMs)}. Redirigiendo...
                  </p>
                </div>
              </div>
            ) : (
              <div>
                <p className="font-medium text-red-900 mb-1">No se pudo crear el entorno</p>
                <p className="text-sm text-red-700 mb-3">{result.error}</p>
                {result.rolledBack && (
                  <p className="text-xs text-red-500 mb-3">Todos los cambios fueron revertidos.</p>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setResult(null);
                    setFormSubmitted(false);
                    setSteps(SETUP_STEPS.map(s => ({ ...s, status: 'pending', ms: null, error: null })));
                  }}
                  className="border-red-200 text-red-700 hover:bg-red-100"
                >
                  Intentar de nuevo
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
