import { track } from '../observability.js';
import { buildObservabilityEvent, getObservabilityEvent } from './events.js';

function getPerformanceNow() {
  if (typeof globalThis.performance?.now === 'function') {
    return globalThis.performance.now();
  }

  return undefined;
}

function toDurationMs(startedAt, endedAt) {
  if (!Number.isFinite(startedAt) || !Number.isFinite(endedAt)) {
    return undefined;
  }

  return Math.max(0, Math.round(endedAt - startedAt));
}

export function startTiming(name, options = {}) {
  const eventDefinition = getObservabilityEvent(name);
  const startedAt = (options.now ?? getPerformanceNow)();
  const baseProperties = { ...(options.properties ?? {}) };
  const client = options.client ?? { track };
  let stopped = false;

  return async function stop(extraProps = {}) {
    if (stopped) return undefined;
    stopped = true;
    if (!eventDefinition) return undefined;

    const durationMs = toDurationMs(startedAt, (options.now ?? getPerformanceNow)());
    if (durationMs == null) return undefined;

    const event = buildObservabilityEvent(eventDefinition, {
      ...baseProperties,
      ...extraProps,
      durationMs,
    });

    if (!event.name) return undefined;

    await client.track(event.name, event.properties);
    return event;
  };
}
