import { createObservability } from './observability/core.js';

export { createObservability } from './observability/core.js';

const observability = createObservability();

export const initObservability = observability.initObservability;
export const track = observability.track;
export const page = observability.page;
export const identify = observability.identify;
export const captureException = observability.captureException;
export const flush = observability.flush;
export const setContext = observability.setContext;
