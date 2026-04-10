import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext.jsx';
import { createApiFetch } from '@/auth/api.js';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Shield, CheckCircle2, XCircle, Loader2, Plug } from 'lucide-react';

function detectBaseUrl() {
  const path = window.location.pathname;
  const webIdx = path.indexOf('/web/');
  if (webIdx !== -1) return path.substring(0, webIdx);
  return import.meta.env.VITE_API_BASE || '';
}

function detectMcpUrl() {
  return window.location.origin + '/mcp';
}

const SCOPE_LABELS = {
  'neo:read': { label: 'Read data', description: 'View records, selectors, and schemas' },
  'neo:write': { label: 'Write data', description: 'Create, update, and delete records' },
  'neo:process': { label: 'Run processes', description: 'Execute business processes' },
  'neo:report': { label: 'Generate reports', description: 'Generate and download reports' },
  'neo:*': { label: 'Full access', description: 'All permissions (read, write, process, report)' },
};

export default function AuthorizePage() {
  const { token, username, logout } = useAuth();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState('idle'); // idle | authorizing | success | error
  const [errorMessage, setErrorMessage] = useState('');

  const clientId = searchParams.get('client_id');
  const redirectUri = searchParams.get('redirect_uri');
  const codeChallenge = searchParams.get('code_challenge');
  const state = searchParams.get('state');
  const scope = searchParams.get('scope') || 'neo:read neo:write';
  const responseType = searchParams.get('response_type');

  const scopes = scope.split(/\s+/).filter(Boolean);
  const isOAuthFlow = !!(clientId && redirectUri && codeChallenge && responseType === 'code');

  const apiFetch = useMemo(
    () => createApiFetch(detectBaseUrl(), () => token, logout),
    [token, logout]
  );

  async function handleAuthorize() {
    setStatus('authorizing');
    setErrorMessage('');
    try {
      const res = await fetch('/oauth2/authorize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          token,
          client_id: clientId,
          redirect_uri: redirectUri,
          code_challenge: codeChallenge,
          state,
          scope,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error_description || err.error || `Authorization failed (${res.status})`);
      }

      const data = await res.json();
      if (data.redirect_url) {
        setStatus('success');
        setTimeout(() => {
          window.location.href = data.redirect_url;
        }, 1000);
      } else {
        throw new Error('No redirect URL received');
      }
    } catch (err) {
      setStatus('error');
      setErrorMessage(err.message);
    }
  }

  function handleDeny() {
    if (redirectUri) {
      const sep = redirectUri.includes('?') ? '&' : '?';
      window.location.href = `${redirectUri}${sep}error=access_denied&error_description=User+denied+the+request${state ? `&state=${state}` : ''}`;
    }
  }

  // No OAuth params — show the connections landing page
  if (!isOAuthFlow) {
    return <ConnectionsLanding />;
  }

  return (
    <div className="flex min-h-[80vh] items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardContent className="pt-6">
          <div className="flex flex-col items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
              <Shield className="h-7 w-7 text-primary" />
            </div>

            <div className="text-center">
              <h1 className="text-xl font-semibold">Authorize Connection</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                An application is requesting access to your Etendo account
              </p>
            </div>

            <div className="w-full rounded-lg border bg-muted/30 p-3">
              <div className="text-xs font-medium text-muted-foreground">Application</div>
              <div className="mt-0.5 font-mono text-sm">{clientId}</div>
            </div>

            <div className="w-full rounded-lg border bg-muted/30 p-3">
              <div className="text-xs font-medium text-muted-foreground">Signed in as</div>
              <div className="mt-0.5 text-sm font-medium">{username}</div>
            </div>

            <div className="w-full">
              <div className="mb-2 text-xs font-medium text-muted-foreground">
                Requested permissions
              </div>
              <div className="flex flex-wrap gap-1.5">
                {scopes.map((s) => {
                  const info = SCOPE_LABELS[s] || { label: s, description: '' };
                  return (
                    <Badge key={s} variant="secondary" className="text-xs" title={info.description}>
                      {info.label}
                    </Badge>
                  );
                })}
              </div>
            </div>

            {status === 'error' && (
              <div className="flex w-full items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                <XCircle className="h-4 w-4 shrink-0" />
                {errorMessage}
              </div>
            )}

            {status === 'success' ? (
              <div className="flex w-full items-center gap-2 rounded-lg border border-green-500/30 bg-green-50 p-3 text-sm text-green-700 dark:bg-green-950/30 dark:text-green-400">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                Authorized! Redirecting...
              </div>
            ) : (
              <div className="flex w-full gap-3 pt-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={handleDeny}
                  disabled={status === 'authorizing'}
                >
                  Deny
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleAuthorize}
                  disabled={status === 'authorizing'}
                >
                  {status === 'authorizing' ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Authorizing...</>
                  ) : (
                    'Authorize'
                  )}
                </Button>
              </div>
            )}

            <p className="text-center text-xs text-muted-foreground">
              Redirect: <span className="font-mono">{redirectUri}</span>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ConnectionsLanding() {
  return (
    <div className="flex min-h-[80vh] items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardContent className="pt-6">
          <div className="flex flex-col items-center gap-6">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
              <Plug className="h-7 w-7 text-primary" />
            </div>

            <div className="text-center">
              <h1 className="text-xl font-semibold">Connect con Claude</h1>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                Connect Claude Desktop or any MCP-compatible client to your Etendo instance.
                The client will be redirected here to request your permission.
              </p>
            </div>

            <div className="w-full space-y-3">
              <h2 className="text-sm font-medium">How it works</h2>
              <ol className="space-y-2 text-sm text-muted-foreground">
                <li className="flex gap-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">1</span>
                  Add this Etendo server as an MCP remote in Claude Desktop
                </li>
                <li className="flex gap-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">2</span>
                  Claude will open this page to request access
                </li>
                <li className="flex gap-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">3</span>
                  Review the permissions and click Authorize
                </li>
                <li className="flex gap-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">4</span>
                  Claude can now read and write data in Etendo on your behalf
                </li>
              </ol>
            </div>

            <div className="w-full rounded-lg border bg-muted/30 p-4">
              <div className="mb-2 text-xs font-medium text-muted-foreground">MCP Server URL</div>
              <code className="block break-all text-sm">
                {detectMcpUrl()}
              </code>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
