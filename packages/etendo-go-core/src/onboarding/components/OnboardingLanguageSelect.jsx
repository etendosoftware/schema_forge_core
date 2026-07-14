import React from 'react';
import { Label } from '@etendosoftware/app-shell-core/components/ui/label';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@etendosoftware/app-shell-core/components/ui/select';
import { LocaleFlagIcon } from './LocaleFlagIcon.jsx';

export function OnboardingLanguageSelect({ label, locale, onChange, options, 'data-testid': testId }) {
  return (
    <div className="w-[152px]" data-testid={testId}>
      <Label
        htmlFor="onboarding-language"
        className="sr-only"
        data-testid="Label__79cf84">
        {label}
      </Label>
      <Select value={locale} onValueChange={onChange}>
        <SelectTrigger
          id="onboarding-language"
          aria-label={label}
          // Radix moves DOM focus into the open content, so the shared
          // component's plain `focus:` ring doesn't reliably show on click —
          // force it via the `open` state instead (scoped here, not in the
          // shared select.jsx, since only this dropdown needs it today).
          className="h-10 bg-white text-[#121217] data-[state=open]:ring-1 data-[state=open]:ring-ring">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel className="px-4 py-1 text-xs font-normal leading-6 text-[#6C6C89]">
              {label}
            </SelectLabel>
            {options.map((option) => (
              // Rendered inside Select.ItemText, whose children Radix automatically
              // projects into the closed trigger's Select.Value — so the flag shows
              // in both the open list AND the closed control from this single source.
              <SelectItem
                key={option.value}
                value={option.value}
                textValue={option.label}
                className="data-[state=checked]:bg-[rgba(18,18,23,0.05)]">
                <span className="flex items-center gap-2">
                  <LocaleFlagIcon locale={option.value} />
                  {option.label}
                </span>
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  );
}

export default OnboardingLanguageSelect;
