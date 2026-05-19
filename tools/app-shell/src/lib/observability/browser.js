import { initObservability } from '../observability.js';
import { createRumProvider } from '../rum.js';
import { createSentryProvider } from '../sentry.js';

export function buildBrowserObservabilityConfig({
  env = import.meta.env,
  location = globalThis.window?.location,
  logger = console,
} = {}) {
  const hostname = location?.hostname;

  return {
    logger,
    context: {
      app: 'app-shell',
      environment: hostname,
    },
    providers: [
      createSentryProvider({
        dsn: env.VITE_SENTRY_DSN,
        hostname,
      }),
      createRumProvider({
        env,
        hostname,
        logger,
      }),
    ],
  };
}

export function initBrowserObservability(options = {}) {
  return initObservability(buildBrowserObservabilityConfig(options));
}
