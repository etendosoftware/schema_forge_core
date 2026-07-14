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
          className="h-10 bg-white text-[#121217]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>{label}</SelectLabel>
            {options.map((option) => (
              // Rendered inside Select.ItemText, whose children Radix automatically
              // projects into the closed trigger's Select.Value — so the flag shows
              // in both the open list AND the closed control from this single source.
              <SelectItem key={option.value} value={option.value} textValue={option.label}>
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
