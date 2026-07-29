/**
 * Selector catalog hook — intentionally a no-op eager loader.
 *
 * Rationale: selector options are fetched lazily by each individual input when the user
 * opens the dropdown (see SelectorInput / SearchInput). FK labels for already-selected
 * values arrive as `<field>$_identifier` from the backend — both in the /defaults payload
 * (NeoDefaultsService.tryInjectIdentifier) and in callout responses
 * (updates.<field>._identifier). The old eager-fetch behavior caused N parallel selector
 * requests on every form mount and on every selector-context change, which is the main
 * source of request amplification we saw in the network tab.
 *
 * Returns the static `fallback` catalogs (used in mock mode or as a safety net) with
 * `catalogsLoaded: true` so any gated downstream effect runs immediately.
 */
export function useCatalogs(api, token, apiBaseUrl, fallback = {}) {
  return { catalogs: fallback, catalogsLoaded: true };
}
