import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Loader2, CheckCircle2, XCircle, Circle, ChevronDown,
  Plus, LogIn, Building2, RefreshCw,
} from 'lucide-react';

const STEPS = [
  { name: 'createClient', label: 'Create Client' },
  { name: 'createOrganization', label: 'Create Organization' },
  { name: 'createRole', label: 'Configure Roles' },
  { name: 'seedReferenceData', label: 'Seed Reference Data' },
  { name: 'createDocTypes', label: 'Document Types' },
  { name: 'markOrgReady', label: 'Finalize Setup' },
];

const CURRENCIES = ['EUR', 'USD', 'ARS', 'GBP', 'BRL', 'MXN', 'CLP', 'COP'];
const LANGUAGES = [
  { value: 'es_ES', label: 'Español' },
  { value: 'en_US', label: 'English' },
];
const COUNTRIES = [
  { value: 'AR', label: 'Argentina' },
  { value: 'ES', label: 'España' },
  { value: 'US', label: 'United States' },
  { value: 'MX', label: 'México' },
  { value: 'BR', label: 'Brasil' },
  { value: 'CL', label: 'Chile' },
  { value: 'CO', label: 'Colombia' },
  { value: 'GB', label: 'United Kingdom' },
];

export default function OnboardingPage() {
  const navigate = useNavigate();
  const [view, setView] = useState('list'); // 'list' | 'create'
  const [environments, setEnvironments] = useState([]);
  const [loadingEnvs, setLoadingEnvs] = useState(true);
  const [loggingIn, setLoggingIn] = useState(null); // clientId being logged into

  // Create form state
  const [form, setForm] = useState({
    clientName: '', orgName: '', adminUser: '', adminPassword: '',
    currency: 'EUR', language: 'es_ES', countryCode: 'AR',
  });
  const [steps, setSteps] = useState(
    STEPS.map(s => ({ ...s, status: 'pending', ms: null, error: null }))
  );
  const [result, setResult] = useState(null);
  const [running, setRunning] = useState(false);

  const token = localStorage.getItem('token');

  // Load environments
  const loadEnvironments = useCallback(async () => {
    setLoadingEnvs(true);
    try {
      const res = await fetch('/sws/go/onboarding/environments', {
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

  useEffect(() => {
    loadEnvironments();
  }, [loadEnvironments]);

  // Login to environment
  const loginToEnvironment = async (env) => {
    setLoggingIn(env.clientId);
    try {
      const res = await fetch('/sws/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: env.adminUser,
          password: form.adminPassword || 'test1234', // TODO: ask for password
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.token) {
          localStorage.setItem('token', data.token);
          navigate('/');
        }
      } else {
        alert('Login failed. Check credentials.');
      }
    } catch (err) {
      alert('Login error: ' + err.message);
    } finally {
      setLoggingIn(null);
    }
  };

  // Run onboarding
  const runOnboarding = useCallback(async () => {
    setRunning(true);
    setResult(null);
    setSteps(STEPS.map(s => ({ ...s, status: 'pending', ms: null, error: null })));

    try {
      const res = await fetch('/sws/go/onboarding', {
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
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
          if (!line.trim()) continue;
          const msg = JSON.parse(line);
          if (msg.result || msg.status === 'success') {
            setResult(msg);
          } else if (msg.step) {
            setSteps(prev => prev.map((s, i) =>
              i === msg.step - 1
                ? { ...s, status: msg.status, ms: msg.ms || null, error: msg.error || null }
                : s
            ));
          }
        }
      }
    } catch (err) {
      setResult({ result: 'failed', error: err.message });
    } finally {
      setRunning(false);
      loadEnvironments();
    }
  }, [form, token, loadEnvironments]);

  const updateField = (field, value) => setForm(f => ({ ...f, [field]: value }));
  const isFormValid = form.clientName && form.orgName && form.adminUser && form.adminPassword;

  const StatusIcon = ({ status }) => {
    if (status === 'running') return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
    if (status === 'done') return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    if (status === 'failed') return <XCircle className="h-4 w-4 text-red-500" />;
    return <Circle className="h-4 w-4 text-gray-300" />;
  };

  // ── LIST VIEW ──
  if (view === 'list') {
    return (
      <div className="max-w-3xl mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Environments</h1>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={loadEnvironments} disabled={loadingEnvs}>
              <RefreshCw className={`h-4 w-4 mr-1 ${loadingEnvs ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button onClick={() => setView('create')}>
              <Plus className="h-4 w-4 mr-1" /> New Environment
            </Button>
          </div>
        </div>

        {loadingEnvs ? (
          <div className="flex justify-center p-8">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : environments.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-gray-500">
              <Building2 className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p className="text-lg font-medium mb-2">No environments yet</p>
              <p className="mb-4">Create your first environment to get started.</p>
              <Button onClick={() => setView('create')}>
                <Plus className="h-4 w-4 mr-1" /> Create Environment
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {environments.map(env => (
              <Card key={env.clientId} className="hover:border-gray-400 transition-colors">
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-lg">{env.clientName}</p>
                    <p className="text-sm text-gray-500">
                      Org: {env.orgName || '—'} &middot; User: {env.adminUser || '—'}
                    </p>
                    <p className="text-xs text-gray-400">
                      Created: {env.created ? new Date(env.created).toLocaleDateString() : '—'}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => loginToEnvironment(env)}
                    disabled={loggingIn === env.clientId}
                  >
                    {loggingIn === env.clientId ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-1" />
                    ) : (
                      <LogIn className="h-4 w-4 mr-1" />
                    )}
                    Enter
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── CREATE VIEW ──
  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">New Environment</h1>
        <Button variant="ghost" onClick={() => { setView('list'); setResult(null); }}>
          Back to list
        </Button>
      </div>

      <Card>
        <CardHeader><CardTitle>Configuration</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="clientName">Company Name</Label>
              <Input id="clientName" value={form.clientName}
                onChange={e => updateField('clientName', e.target.value)} disabled={running} />
            </div>
            <div>
              <Label htmlFor="orgName">Organization Name</Label>
              <Input id="orgName" value={form.orgName}
                onChange={e => updateField('orgName', e.target.value)} disabled={running} />
            </div>
            <div>
              <Label htmlFor="adminUser">Admin Email</Label>
              <Input id="adminUser" type="email" value={form.adminUser}
                onChange={e => updateField('adminUser', e.target.value)} disabled={running} />
            </div>
            <div>
              <Label htmlFor="adminPassword">Admin Password</Label>
              <Input id="adminPassword" type="password" value={form.adminPassword}
                onChange={e => updateField('adminPassword', e.target.value)} disabled={running} />
            </div>
            <div>
              <Label htmlFor="currency">Currency</Label>
              <select id="currency" value={form.currency}
                onChange={e => updateField('currency', e.target.value)} disabled={running}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <Label htmlFor="language">Language</Label>
              <select id="language" value={form.language}
                onChange={e => updateField('language', e.target.value)} disabled={running}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                {LANGUAGES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
              </select>
            </div>
            <div>
              <Label htmlFor="countryCode">Country</Label>
              <select id="countryCode" value={form.countryCode}
                onChange={e => updateField('countryCode', e.target.value)} disabled={running}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                {COUNTRIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
          </div>
          <Button onClick={runOnboarding} disabled={running || !isFormValid}>
            {running ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating...</> : 'Create Environment'}
          </Button>
        </CardContent>
      </Card>

      {/* Progress Accordion */}
      {(running || result) && (
        <Card>
          <CardHeader><CardTitle>Progress</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {steps.map((step, i) => (
              <Collapsible key={step.name}
                open={step.status === 'running' || step.status === 'failed'}>
                <CollapsibleTrigger className="flex items-center justify-between w-full p-3 rounded-lg bg-gray-50 hover:bg-gray-100">
                  <div className="flex items-center gap-3">
                    <StatusIcon status={step.status} />
                    <span className="font-medium">Step {i + 1}: {step.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {step.ms != null && <span className="text-sm text-gray-500">{step.ms}ms</span>}
                    <ChevronDown className="h-4 w-4" />
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent className="p-3 pl-10 text-sm">
                  {step.status === 'running' && <span className="text-blue-600">Executing...</span>}
                  {step.status === 'failed' && <span className="text-red-600 break-all">{step.error}</span>}
                  {step.status === 'done' && <span className="text-green-600">Completed in {step.ms}ms</span>}
                </CollapsibleContent>
              </Collapsible>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Result */}
      {result && (
        <Card className={result.status === 'success' || result.result === 'success' ? 'border-green-500' : 'border-red-500'}>
          <CardContent className="p-4">
            {result.status === 'success' ? (
              <div className="text-green-700 space-y-2">
                <p className="font-bold">Environment created ({result.totalMs}ms)</p>
                <Button onClick={() => { setView('list'); setResult(null); }}>
                  <LogIn className="h-4 w-4 mr-1" /> Go to Environments
                </Button>
              </div>
            ) : (
              <div className="text-red-700">
                <p className="font-bold">Creation failed</p>
                <p className="text-sm">{result.error}</p>
                {result.rolledBack && <p className="text-sm mt-1">All changes have been rolled back.</p>}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
