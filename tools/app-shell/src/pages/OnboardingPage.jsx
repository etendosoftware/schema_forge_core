import React, { useState } from 'react';
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
  Loader2,
  CheckCircle2,
  XCircle,
  Circle,
  ChevronDown,
} from 'lucide-react';

const STEPS = [
  { name: 'createClient', label: 'Create Client' },
  { name: 'createOrganization', label: 'Create Organization' },
  { name: 'createClientAdmin', label: 'Create Client Admin' },
  { name: 'createOrgAdmin', label: 'Create Org Admin' },
  { name: 'createRole', label: 'Create Role + Access' },
  { name: 'seedReferenceData', label: 'Seed Reference Data' },
  { name: 'createDocTypes', label: 'Document Types + Sequences' },
  { name: 'markOrgReady', label: 'Mark Org Ready' },
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

const SELECT_CLASS =
  'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50';

const INITIAL_FORM = {
  clientName: '',
  orgName: '',
  adminUser: '',
  adminPassword: '',
  currency: '',
  language: '',
  country: '',
};

// -- Status helpers -----------------------------------------------------------

function initStepState() {
  return Object.fromEntries(
    STEPS.map((s) => [s.name, { status: 'pending', messages: [], open: false }])
  );
}

function StatusIcon({ status }) {
  if (status === 'running') return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
  if (status === 'done') return <CheckCircle2 className="h-4 w-4 text-green-500" />;
  if (status === 'failed') return <XCircle className="h-4 w-4 text-red-500" />;
  return <Circle className="h-4 w-4 text-muted-foreground" />;
}

// -- Main component -----------------------------------------------------------

export default function OnboardingPage() {
  const [form, setForm] = useState(INITIAL_FORM);
  const [running, setRunning] = useState(false);
  const [stepState, setStepState] = useState(initStepState);
  const [result, setResult] = useState(null); // { success: bool, message: string }

  const set = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const setStep = (name, patch) =>
    setStepState((prev) => ({
      ...prev,
      [name]: { ...prev[name], ...patch },
    }));

  const canSubmit =
    form.clientName &&
    form.orgName &&
    form.adminUser &&
    form.adminPassword &&
    form.currency &&
    form.language &&
    form.country;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!canSubmit || running) return;

    setRunning(true);
    setResult(null);
    setStepState(initStepState());

    const token = localStorage.getItem('token');

    let response;
    try {
      response = await fetch('/sws/go/onboarding', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(form),
      });
    } catch (err) {
      setResult({ success: false, message: `Network error: ${err.message}` });
      setRunning(false);
      return;
    }

    if (!response.body) {
      setResult({ success: false, message: 'No response body from server.' });
      setRunning(false);
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop(); // keep partial last line

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          let event;
          try {
            event = JSON.parse(trimmed);
          } catch {
            continue;
          }

          if (event.step) {
            const { step: name, status, message } = event;
            setStepState((prev) => {
              const current = prev[name] ?? { status: 'pending', messages: [], open: false };
              const isActive = status === 'running' || status === 'failed';
              return {
                ...prev,
                [name]: {
                  ...current,
                  status,
                  open: isActive ? true : current.open,
                  messages: message
                    ? [...current.messages, message]
                    : current.messages,
                },
              };
            });
          }

          if (event.type === 'result') {
            setResult({ success: event.success, message: event.message });
          }
        }
      }

      // flush remaining buffer
      if (buffer.trim()) {
        try {
          const event = JSON.parse(buffer.trim());
          if (event.type === 'result') {
            setResult({ success: event.success, message: event.message });
          }
        } catch {
          // ignore unparseable tail
        }
      }
    } catch (err) {
      setResult({ success: false, message: `Stream error: ${err.message}` });
    } finally {
      setRunning(false);
    }
  }

  const toggleOpen = (name) =>
    setStepState((prev) => ({
      ...prev,
      [name]: { ...prev[name], open: !prev[name].open },
    }));

  // -- Render ------------------------------------------------------------------

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Setup Wizard</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Configure a new client and organization in Etendo.
        </p>
      </div>

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Client Name */}
            <div className="space-y-1.5">
              <Label htmlFor="clientName">Client Name</Label>
              <Input
                id="clientName"
                placeholder="Acme Corp"
                value={form.clientName}
                onChange={(e) => set('clientName', e.target.value)}
                disabled={running}
              />
            </div>

            {/* Org Name */}
            <div className="space-y-1.5">
              <Label htmlFor="orgName">Organization Name</Label>
              <Input
                id="orgName"
                placeholder="Acme Spain"
                value={form.orgName}
                onChange={(e) => set('orgName', e.target.value)}
                disabled={running}
              />
            </div>

            {/* Admin User */}
            <div className="space-y-1.5">
              <Label htmlFor="adminUser">Admin Username</Label>
              <Input
                id="adminUser"
                placeholder="admin"
                value={form.adminUser}
                onChange={(e) => set('adminUser', e.target.value)}
                disabled={running}
              />
            </div>

            {/* Admin Password */}
            <div className="space-y-1.5">
              <Label htmlFor="adminPassword">Admin Password</Label>
              <Input
                id="adminPassword"
                type="password"
                placeholder="••••••••"
                value={form.adminPassword}
                onChange={(e) => set('adminPassword', e.target.value)}
                disabled={running}
              />
            </div>

            {/* Currency */}
            <div className="space-y-1.5">
              <Label htmlFor="currency">Currency</Label>
              <select
                id="currency"
                className={SELECT_CLASS}
                value={form.currency}
                onChange={(e) => set('currency', e.target.value)}
                disabled={running}
              >
                <option value="">Select currency...</option>
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {/* Language */}
            <div className="space-y-1.5">
              <Label htmlFor="language">Language</Label>
              <select
                id="language"
                className={SELECT_CLASS}
                value={form.language}
                onChange={(e) => set('language', e.target.value)}
                disabled={running}
              >
                <option value="">Select language...</option>
                {LANGUAGES.map((l) => (
                  <option key={l.value} value={l.value}>{l.label}</option>
                ))}
              </select>
            </div>

            {/* Country */}
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="country">Country</Label>
              <select
                id="country"
                className={SELECT_CLASS}
                value={form.country}
                onChange={(e) => set('country', e.target.value)}
                disabled={running}
              >
                <option value="">Select country...</option>
                {COUNTRIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>

            {/* Submit */}
            <div className="md:col-span-2 flex justify-end pt-2">
              <Button type="submit" disabled={!canSubmit || running}>
                {running && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {running ? 'Running...' : 'Start Setup'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Accordion — step progress */}
      <div className="space-y-2">
        {STEPS.map((step) => {
          const state = stepState[step.name];
          const isActive = state.status !== 'pending';

          return (
            <Collapsible
              key={step.name}
              open={state.open}
              onOpenChange={() => toggleOpen(step.name)}
            >
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className={`flex w-full items-center justify-between rounded-md border px-4 py-3 text-sm font-medium transition-colors hover:bg-muted/50 ${
                    isActive ? 'bg-muted/30' : 'bg-background'
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <StatusIcon status={state.status} />
                    {step.label}
                  </span>
                  {state.messages.length > 0 && (
                    <ChevronDown
                      className={`h-4 w-4 text-muted-foreground transition-transform ${
                        state.open ? 'rotate-180' : ''
                      }`}
                    />
                  )}
                </button>
              </CollapsibleTrigger>

              {state.messages.length > 0 && (
                <CollapsibleContent>
                  <div className="rounded-b-md border border-t-0 bg-muted/20 px-4 py-3 space-y-1">
                    {state.messages.map((msg, i) => (
                      <p key={i} className="text-xs text-muted-foreground font-mono">
                        {msg}
                      </p>
                    ))}
                  </div>
                </CollapsibleContent>
              )}
            </Collapsible>
          );
        })}
      </div>

      {/* Result card */}
      {result && (
        <Card
          className={
            result.success
              ? 'border-green-500 bg-green-50 dark:bg-green-950/20'
              : 'border-red-500 bg-red-50 dark:bg-red-950/20'
          }
        >
          <CardContent className="flex items-start gap-3 pt-4">
            {result.success ? (
              <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
            ) : (
              <XCircle className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
            )}
            <div className="space-y-1">
              <p className="font-medium text-sm">
                {result.success ? 'Setup completed successfully' : 'Setup failed'}
              </p>
              <p className="text-sm text-muted-foreground">{result.message}</p>
              {!result.success && (
                <p className="text-xs text-muted-foreground mt-1">
                  All changes have been rolled back. You can fix the configuration and try again.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
