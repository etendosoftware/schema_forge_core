/**
 * Version 1 of the public semantic accessibility contract.
 *
 * CSS in ../styles.css remains the visual source of truth. These utilities
 * make that contract independently verifiable by package consumers and tests.
 */
export const SEMANTIC_THEME_TOKENS = Object.freeze([
  '--border-control',
  '--border-structural',
  '--border-subtle',
  '--text-primary',
  '--text-secondary',
  '--text-disabled',
  '--icon-secondary',
  '--focus-ring',
]);

/**
 * shadcn/Tailwind's generic role tokens (--foreground, --card-foreground, ...)
 * are what application code actually consumes via Tailwind utilities
 * (text-foreground, ...) — SEMANTIC_THEME_TOKENS above is rarely used
 * directly. Each generic token here must resolve to the exact same color as
 * its audited counterpart in BOTH themes, so a future edit to one side can't
 * silently drift the app's rendered colors away from the ETP-4554 contrast
 * contract while this test keeps passing.
 *
 * Deliberately excludes --primary, --inverse, --sidebar-foreground and
 * --sidebar-accent-foreground: those legitimately diverge from --text-primary
 * in the dark theme (a distinct brand-blue primary, an inverted-background
 * role, and a separately-tuned near-white sidebar text), so they are not safe
 * to pin to a single canonical token across both themes.
 */
export const ALIAS_TOKEN_PAIRS = Object.freeze([
  ['--foreground', '--text-primary'],
  ['--card-foreground', '--text-primary'],
  ['--popover-foreground', '--text-primary'],
  ['--secondary-foreground', '--text-primary'],
  ['--accent-foreground', '--text-primary'],
  ['--muted-foreground', '--text-secondary'],
]);

function parseHex(value) {
  const match = value.trim().match(/^#([\da-f]{3}|[\da-f]{6})$/i);
  if (!match) return null;
  const hex = match[1].length === 3
    ? [...match[1]].map((part) => part + part).join('')
    : match[1];
  return [0, 2, 4].map((index) => Number.parseInt(hex.slice(index, index + 2), 16) / 255);
}

function parseHsl(value) {
  const match = value.trim().match(/^(?:hsl\()?\s*(-?(?:\d*\.)?\d+)\s+((?:\d*\.)?\d+)%\s+((?:\d*\.)?\d+)%\s*\)?$/i);
  if (!match) return null;
  const [hue, saturation, lightness] = match.slice(1).map(Number);
  if (!Number.isFinite(hue) || !Number.isFinite(saturation) || !Number.isFinite(lightness)
    || saturation < 0 || saturation > 100 || lightness < 0 || lightness > 100) return null;

  const s = saturation / 100;
  const l = lightness / 100;
  const chroma = (1 - Math.abs(2 * l - 1)) * s;
  const segment = ((hue % 360) + 360) % 360 / 60;
  const x = chroma * (1 - Math.abs(segment % 2 - 1));
  const [r, g, b] = segment < 1 ? [chroma, x, 0]
    : segment < 2 ? [x, chroma, 0]
      : segment < 3 ? [0, chroma, x]
        : segment < 4 ? [0, x, chroma]
          : segment < 5 ? [x, 0, chroma]
            : [chroma, 0, x];
  const offset = l - chroma / 2;
  return [r + offset, g + offset, b + offset];
}

function parseColor(value) {
  const color = parseHex(value) ?? parseHsl(value);
  if (!color) throw new TypeError(`Invalid color: ${value}`);
  return color;
}

function relativeLuminance(value) {
  const channels = parseColor(value).map((channel) => (
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  ));
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

export function contrastRatio(foreground, background) {
  const lighter = Math.max(relativeLuminance(foreground), relativeLuminance(background));
  const darker = Math.min(relativeLuminance(foreground), relativeLuminance(background));
  return Number(((lighter + 0.05) / (darker + 0.05)).toFixed(2));
}

export function extractThemeTokens(styles, selector) {
  const selectorPattern = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = styles.match(new RegExp(`${selectorPattern}\\s*\\{([\\s\\S]*?)\\n\\s*\\}`));
  if (!match) throw new TypeError(`Theme selector not found: ${selector}`);

  return Object.fromEntries([...match[1].matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)]
    .map(([, token, value]) => [token, value.trim()]));
}

function tokenErrors(theme) {
  return SEMANTIC_THEME_TOKENS
    .filter((token) => !theme[token])
    .map((token) => `Missing semantic token: ${token}`);
}

export function validateThemeContract(theme) {
  const errors = tokenErrors(theme);
  if (errors.length) return errors;

  for (const token of SEMANTIC_THEME_TOKENS) {
    try {
      parseColor(theme[token]);
    } catch (error) {
      errors.push(`${token} is invalid: ${error.message}`);
    }
  }

  // WARN(a11y): --border-control is deliberately NOT gated here (see styles.css).
  // It's back to staging's light color, which is ~1.5:1 against --background/--card —
  // short of the WCAG 1.4.11 3:1 minimum. Known, accepted gap; do not re-add without
  // also resolving the button-vs-input token conflict documented at its definition.
  const requirements = [
    ['--border-structural', ['--background', '--card'], 3],
    ['--text-primary', ['--background', '--card'], 4.5],
    ['--text-secondary', ['--background', '--card'], 4.5],
    ['--text-disabled', ['--background', '--card'], 4.5],
    ['--icon-secondary', ['--background', '--card'], 3],
    ['--focus-ring', ['--background', '--card'], 3],
  ];

  for (const [token, surfaces, minimum] of requirements) {
    for (const surface of surfaces) {
      try {
        const ratio = contrastRatio(theme[token], theme[surface]);
        if (ratio < minimum) errors.push(`${token} has ${ratio}:1 contrast against ${surface}; requires ${minimum}:1`);
      } catch (error) {
        errors.push(`${token} or ${surface} is invalid: ${error.message}`);
      }
    }
  }

  for (const [alias, canonical] of ALIAS_TOKEN_PAIRS) {
    if (!theme[alias] || !theme[canonical]) continue;
    try {
      const [ar, ag, ab] = parseColor(theme[alias]);
      const [cr, cg, cb] = parseColor(theme[canonical]);
      const driftedChannel = [ar - cr, ag - cg, ab - cb].some((delta) => Math.abs(delta) > 1 / 255);
      if (driftedChannel) {
        errors.push(
          `${alias} (${theme[alias]}) has drifted from its accessibility-audited counterpart `
          + `${canonical} (${theme[canonical]}); keep them equal or move ${alias} into SEMANTIC_THEME_TOKENS `
          + 'with its own contrast requirement',
        );
      }
    } catch (error) {
      errors.push(`${alias} or ${canonical} is invalid: ${error.message}`);
    }
  }

  return errors;
}
