import React from 'react';
import { ChevronDown } from 'lucide-react';
import { Label } from '@etendosoftware/app-shell-core/components/ui/label';
import { countryFlagEmoji } from '../countries.js';

// Locale codes here look like `es_ES` / `en_US` — the flag is derived from the
// region half (after the underscore), reusing the shared countryFlagEmoji
// helper instead of a separate hardcoded flag map.
function regionFromLocale(localeCode) {
  const region = (localeCode || '').split('_')[1];
  return region ? region.toUpperCase() : '';
}

export function OnboardingLanguageSelect({ label, locale, onChange, options }) {
  const currentFlag = countryFlagEmoji(regionFromLocale(locale));

  return (
    <div className="min-w-[132px]">
      <Label
        htmlFor="onboarding-language"
        className="sr-only"
        data-testid="Label__79cf84">
        {label}
      </Label>
      <div className="relative">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-base leading-none"
        >
          {currentFlag}
        </span>
        <select
          id="onboarding-language"
          aria-label={label}
          value={locale}
          onChange={(event) => onChange(event.target.value)}
          className="h-10 w-full appearance-none rounded-full border border-slate-300 bg-white pl-9 pr-8 text-sm text-slate-900 shadow-sm focus:outline-none focus:ring-4 focus:ring-slate-900/5"
        >
          {options.map((option) => {
            const optionFlag = countryFlagEmoji(regionFromLocale(option.value));
            return (
              <option key={option.value} value={option.value}>
                {optionFlag ? `${optionFlag} ${option.label}` : option.label}
              </option>
            );
          })}
        </select>
        <ChevronDown
          aria-hidden="true"
          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
          data-testid="ChevronDown__79cf84"
        />
      </div>
    </div>
  );
}

export default OnboardingLanguageSelect;
