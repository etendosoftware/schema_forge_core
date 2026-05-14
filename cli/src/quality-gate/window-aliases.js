/**
 * Single source of truth for window alias relationships used by the
 * quality-gate tooling. An alias entry declares that the source files under
 * `windows/custom/<aliasDir>/` belong logically to a canonical window's
 * code surface (e.g. legacy `businessPartner` directory still contributes to
 * the `contacts` window).
 *
 * Two consumers exist today:
 *   - detect.js — maps a touched alias dir back to its canonical window.
 *   - checks/i18n.js — when scanning a canonical window, also scans its alias dirs.
 *
 * Adding a new alias should require editing only this file.
 */
export const WINDOW_ALIASES = [
  { canonical: 'contacts', aliasDirs: ['businessPartner'] },
];

export function resolveCanonicalWindow(customDir, availableWindows) {
  for (const { canonical, aliasDirs } of WINDOW_ALIASES) {
    if (aliasDirs.includes(customDir) && availableWindows.includes(canonical)) {
      return canonical;
    }
  }
  return null;
}

export function getAliasDirs(canonicalWindow) {
  const entry = WINDOW_ALIASES.find((a) => a.canonical === canonicalWindow);
  return entry ? [...entry.aliasDirs] : [];
}
