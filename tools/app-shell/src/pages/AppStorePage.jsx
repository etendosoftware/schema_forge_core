import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Store,
  ShoppingCart,
  FlaskConical,
  Package,
  Loader2,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react';
import { APP_CATALOG } from '@/apps-registry.js';
import {
  useInstalledApps,
  installApp,
  uninstallApp,
} from '@/hooks/useInstalledApps.js';

const ICON_MAP = {
  ShoppingCart,
  FlaskConical,
  Package,
  Store,
};

function pickIcon(name) {
  return ICON_MAP[name] || Package;
}

function AppCard({ app, installed, busy, onInstall, onUninstall }) {
  const Icon = pickIcon(app.icon);

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted">
              <Icon className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <CardTitle className="text-base leading-tight">
                {app.displayName}
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                v{app.version} · {app.author}
              </p>
            </div>
          </div>
          {installed && (
            <Badge variant="secondary" className="gap-1">
              <CheckCircle2 className="h-3 w-3" />
              Installed
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex-1 space-y-3">
        <p className="text-sm text-muted-foreground">{app.description}</p>

        <div className="text-xs text-muted-foreground">
          <div className="font-medium text-foreground mb-1">Adds menu entries</div>
          <ul className="list-disc pl-4 space-y-0.5">
            {app.menuEntries.map((e) => (
              <li key={e.name}>
                {e.label}{' '}
                <span className="text-muted-foreground/70">({e.menuGroup || app.menuGroup})</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <ExternalLink className="h-3 w-3" />
          <span className="truncate">{app.iframeUrl}</span>
        </div>
      </CardContent>

      <CardFooter className="justify-end gap-2">
        {installed ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onUninstall(app.appId)}
            disabled={busy}
          >
            Uninstall
          </Button>
        ) : (
          <Button
            size="sm"
            onClick={() => onInstall(app.appId)}
            disabled={busy}
          >
            {busy ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" />
                Installing…
              </>
            ) : (
              'Install'
            )}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}

export default function AppStorePage() {
  const installedIds = useInstalledApps();
  const installedSet = new Set(installedIds);
  const [busyId, setBusyId] = useState(null);

  const handleInstall = async (appId) => {
    setBusyId(appId);
    // Simulated install — the real work is just a localStorage write,
    // but the spinner makes the "external artifact" feel real.
    await new Promise((r) => setTimeout(r, 900));
    installApp(appId);
    setBusyId(null);
  };

  const handleUninstall = (appId) => {
    uninstallApp(appId);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10">
          <Store className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">App Store</h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            External apps built on the Etendo Apps SDK. Each app runs in its
            own iframe with its own BFF — installing one here adds its menu
            entries to the shell; uninstalling removes them. No shell rebuild
            required.
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {APP_CATALOG.map((app) => (
          <AppCard
            key={app.appId}
            app={app}
            installed={installedSet.has(app.appId)}
            busy={busyId === app.appId}
            onInstall={handleInstall}
            onUninstall={handleUninstall}
          />
        ))}
      </div>
    </div>
  );
}
