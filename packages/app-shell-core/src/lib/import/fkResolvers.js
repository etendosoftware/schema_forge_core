const resolvers = new Map();

/**
 * Register a custom foreign-key resolver under a name a composite descriptor can look
 * up by string (same pattern as `buildOperations.js`'s descriptor registry). Exists
 * because some FK columns can't be resolved independently by distinct value — e.g. a
 * region name means different things depending on which country a row already
 * resolved to — so they opt out of the generic `resolveForeignKeys` distinct-value
 * batching entirely and are resolved by the composite descriptor itself, one value (and
 * whatever extra context it needs, e.g. an already-resolved country id) at a time.
 */
export function registerFkResolver(name, fn) {
  resolvers.set(name, fn);
}

export function getFkResolver(name) {
  return resolvers.get(name);
}
