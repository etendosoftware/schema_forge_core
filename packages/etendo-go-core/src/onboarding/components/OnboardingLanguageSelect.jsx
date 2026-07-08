import React from 'react';
import { ChevronDown } from 'lucide-react';
import { Label } from '@etendosoftware/app-shell-core/components/ui/label';
import { LocaleFlagIcon } from './LocaleFlagIcon.jsx';

export function OnboardingLanguageSelect({ label, locale, onChange, options }) {
  return (
    <div className="min-w-[132px]">
      <Label
        htmlFor="onboarding-language"
        className="sr-only"
        data-testid="Label__79cf84">
        {label}
      </Label>
      <div className="relative">
        <LocaleFlagIcon
          locale={locale}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
        />
        <select
          id="onboarding-language"
          aria-label={label}
          value={locale}
          onChange={(event) => onChange(event.target.value)}
          className="h-10 w-full appearance-none rounded-full border border-slate-200 bg-white pl-9 pr-8 text-sm text-slate-900 shadow-sm focus:outline-none focus:ring-4 focus:ring-slate-900/5"
        >
          {options.map((option) => (
            // Native <option> elements can only render plain text (no HTML/SVG),
            // so the open dropdown list cannot show flag icons — only the closed
            // control does, via the LocaleFlagIcon overlay above.
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
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
