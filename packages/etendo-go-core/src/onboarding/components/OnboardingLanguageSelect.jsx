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
      <Select value={locale} onValueChange={onChange} data-testid="Select__6e9c91">
        <SelectTrigger
          id="onboarding-language"
          aria-label={label}
          // Radix moves DOM focus into the open content, so the shared
          // component's plain `focus:` ring doesn't reliably show on click —
          // force it via the `open` state instead (scoped here, not in the
          // shared select.jsx, since only this dropdown needs it today).
          className="h-10 bg-white text-[#121217] data-[state=open]:ring-1 data-[state=open]:ring-ring"
          data-testid="SelectTrigger__6e9c91">
          <SelectValue data-testid="SelectValue__6e9c91" />
        </SelectTrigger>
        <SelectContent data-testid="SelectContent__6e9c91">
          <SelectGroup data-testid="SelectGroup__6e9c91">
            <SelectLabel
              className="px-4 py-1 text-xs font-normal leading-6 text-[#6C6C89]"
              data-testid="SelectLabel__6e9c91">
              {label}
            </SelectLabel>
            {options.map((option) => (
              // Rendered inside Select.ItemText, whose children Radix automatically
              // projects into the closed trigger's Select.Value — so the flag shows
              // in both the open list AND the closed control from this single source.
              (<SelectItem
                key={option.value}
                value={option.value}
                textValue={option.label}
                className="data-[state=checked]:bg-[rgba(18,18,23,0.05)]"
                data-testid="SelectItem__6e9c91">
                <span className="flex items-center gap-2">
                  <LocaleFlagIcon locale={option.value} data-testid="LocaleFlagIcon__6e9c91" />
                  {option.label}
                </span>
              </SelectItem>)
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  );
}

export default OnboardingLanguageSelect;
