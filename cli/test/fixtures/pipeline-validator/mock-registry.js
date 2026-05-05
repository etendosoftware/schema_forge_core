/**
 * Mock registry used by validate-pipeline fixture tests.
 * Simulates a partial registry that includes window-ok and window-ok-2
 * but NOT window-orphan-registry (triggering F3) and
 * includes window-registry-orphan (triggering F10).
 */
export const windowLoaders = {
  'window-ok': () => Promise.resolve({}),
  'window-ok-2': () => Promise.resolve({}),
  // window-registry-orphan is listed here but its index.jsx does NOT exist
  'window-registry-orphan': () => Promise.resolve({}),
  // window-orphan-registry is intentionally absent → F3
};

export const customLoaders = {};
