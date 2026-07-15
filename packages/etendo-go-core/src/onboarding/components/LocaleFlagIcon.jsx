import React, { useId } from 'react';
import { countryFlagEmoji } from '../countries.js';

// Locale codes here look like `es_ES` / `en_US` — the flag region is derived
// from the part after the underscore. Shared with OnboardingLanguageSelect.jsx
// so both stay in sync on how a locale maps to a region code.
export function regionFromLocale(localeCode) {
  const region = (localeCode || '').split('_')[1];
  return region ? region.toUpperCase() : '';
}

// Minimal hand-authored circular flag icons for the two locales this app
// ships today (es_ES, en_US — see config.localeCodes usage in LoginStep.jsx).
// Deliberately not pulling in a flag-icon library for two flags; any
// additional locale falls back to the emoji glyph below instead of crashing.
function SpainFlag({ clipId }) {
  return (
    <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true">
      <clipPath id={clipId}>
        <circle cx="10" cy="10" r="10" />
      </clipPath>
      <g clipPath={`url(#${clipId})`}>
        <rect x="0" y="0" width="20" height="20" fill="#AA151B" />
        <rect x="0" y="5" width="20" height="10" fill="#F1BF00" />
      </g>
    </svg>
  );
}

function UnitedStatesFlag({ clipId }) {
  const stripeHeight = 20 / 7;
  const stripes = Array.from({ length: 7 }, (_, index) => (
    <rect
      key={index}
      x="0"
      y={index * stripeHeight}
      width="20"
      height={stripeHeight}
      fill={index % 2 === 0 ? '#B22234' : '#FFFFFF'}
    />
  ));
  return (
    <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true">
      <clipPath id={clipId}>
        <circle cx="10" cy="10" r="10" />
      </clipPath>
      <g clipPath={`url(#${clipId})`}>
        {stripes}
        <rect x="0" y="0" width="9" height="10" fill="#3C3B6E" />
      </g>
    </svg>
  );
}

function FallbackFlag({ region, className }) {
  const glyph = countryFlagEmoji(region);
  return (
    <span
      aria-hidden="true"
      className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-xs leading-none ${className || ''}`}
    >
      {glyph}
    </span>
  );
}

export function LocaleFlagIcon({ locale, className }) {
  const region = regionFromLocale(locale);
  const clipId = useId();

  if (region === 'ES') {
    return (
      <span className={`inline-flex h-5 w-5 overflow-hidden rounded-full ${className || ''}`}>
        <SpainFlag clipId={clipId} />
      </span>
    );
  }

  if (region === 'US') {
    return (
      <span className={`inline-flex h-5 w-5 overflow-hidden rounded-full ${className || ''}`}>
        <UnitedStatesFlag clipId={clipId} />
      </span>
    );
  }

  return <FallbackFlag region={region} className={className} />;
}

export default LocaleFlagIcon;
