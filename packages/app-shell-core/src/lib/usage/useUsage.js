import { useCallback } from 'react';
import { useApiFetch } from '../../auth/useApiFetch.js';
import { useObservability } from '../../observability/ObservabilityContext.jsx';
import { getUsageClient } from './usageClient.js';

/**
 * `trackUsage(eventType, { target, action, outcome, errorCode, durationMs, properties })`
 * (ETP-5462). Instrument once: the event's catalog entry (`usageEvents.js`) decides whether it
 * goes to the usage table, to Mixpanel through the host's `ObservabilityProvider`, or both.
 *
 * The request goes out with this tree's session-bound `apiFetch` (request policy), handed to the
 * shared client at track time. Fire-and-forget: it returns nothing and never throws.
 *
 * @param {{ client?: ReturnType<typeof getUsageClient> }} [options] test seam
 */
export function useUsage({ client } = {}) {
  const apiFetch = useApiFetch();
  const { trackUsageEvent } = useObservability();

  const trackUsage = useCallback((eventType, fields) => {
    const usage = client ?? getUsageClient();
    usage.setRequest(apiFetch);
    // A host value that predates ETP-5462 carries no `trackUsageEvent`: the provider replaces
    // the default object instead of merging into it.
    usage.setMixpanel(typeof trackUsageEvent === 'function' ? trackUsageEvent : null);
    usage.track(eventType, fields);
  }, [client, apiFetch, trackUsageEvent]);

  return { trackUsage };
}
