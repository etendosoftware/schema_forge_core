/**
 * ETP-6363 — lead attribution: what HubSpot needs to tie a sign-up to the visits that led to it.
 *
 * HubSpot's tracking code (loaded by GTM, only with the visitor's consent) leaves the
 * `hubspotutk` cookie on the `etendo.ai` domain, so the app reads it even when the website set it.
 * The register and single sign-on requests carry it to the backend, which keeps it with the new
 * account and sends it to HubSpot's Forms API once the address is confirmed.
 *
 * Nothing here may block a sign-up: a visitor who refused the cookies has no `hubspotutk`, and the
 * account is created all the same, only without attribution.
 */

/** A `hubspotutk` value: HubSpot writes 32 hex characters. */
const HUTK_PATTERN = /^[a-f0-9]{32}$/i;

/**
 * Query parameters kept in `pageUri`: the campaign ones HubSpot attributes the lead to. Any other
 * is dropped, so a token in the address (a login link, an invitation) never leaves the app.
 */
const ATTRIBUTION_PARAMS = new Set(['gclid', 'gbraid', 'wbraid', 'fbclid', 'msclkid', 'li_fat_id', 'ttclid']);
const ATTRIBUTION_PREFIXES = ['utm_', 'hsa_'];

const MAX_PAGE_URI = 2000;
const MAX_PAGE_NAME = 255;

function isAttributionParam(name) {
  const key = name.toLowerCase();
  return ATTRIBUTION_PARAMS.has(key) || ATTRIBUTION_PREFIXES.some(prefix => key.startsWith(prefix));
}

/**
 * Reads one cookie.
 *
 * @param {string} cookieString `document.cookie`
 * @param {string} name the cookie
 * @returns {string|null} its value, or null when absent or unreadable
 */
export function readCookie(cookieString, name) {
  if (typeof cookieString !== 'string' || !cookieString) return null;
  for (const part of cookieString.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0 || part.slice(0, separator).trim() !== name) continue;
    try {
      return decodeURIComponent(part.slice(separator + 1).trim());
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * The page address HubSpot records with the sign-up, without anything but its campaign
 * parameters.
 *
 * @param {string} href the current address
 * @returns {string|null}
 */
export function attributionPageUri(href) {
  let url;
  try {
    url = new URL(href);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  const kept = new URLSearchParams();
  url.searchParams.forEach((value, key) => {
    if (isAttributionParam(key)) kept.append(key, value);
  });
  const query = kept.toString();
  const uri = `${url.origin}${url.pathname}${query ? `?${query}` : ''}`;
  return uri.length > MAX_PAGE_URI ? `${url.origin}${url.pathname}`.slice(0, MAX_PAGE_URI) : uri;
}

/**
 * What the register and single sign-on requests send as `hubspotContext`.
 *
 * @param {{ cookie?: string, href?: string, title?: string }} [source] the browser's, by default
 * @returns {{ hutk?: string, pageUri?: string, pageName?: string }|null} null when there is
 *   nothing to send (no browser)
 */
export function readHubSpotContext(source) {
  const doc = typeof document === 'undefined' ? null : document;
  const win = typeof window === 'undefined' ? null : window;
  const cookie = source?.cookie ?? doc?.cookie ?? '';
  const href = source?.href ?? win?.location?.href ?? '';
  const title = source?.title ?? doc?.title ?? '';
  const context = {};
  const hutk = readCookie(cookie, 'hubspotutk');
  if (hutk && HUTK_PATTERN.test(hutk)) context.hutk = hutk.toLowerCase();
  const pageUri = href ? attributionPageUri(href) : null;
  if (pageUri) context.pageUri = pageUri;
  const pageName = typeof title === 'string' ? title.trim().slice(0, MAX_PAGE_NAME) : '';
  if (pageName) context.pageName = pageName;
  return Object.keys(context).length ? context : null;
}
