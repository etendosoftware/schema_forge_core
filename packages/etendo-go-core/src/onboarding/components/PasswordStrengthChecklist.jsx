import React from 'react';
import { Check } from 'lucide-react';
import { useUI } from '@etendosoftware/app-shell-core/i18n';
import { getPasswordChecks, PASSWORD_RULES } from '../passwordPolicy.js';

const PASSWORD_RULE_LABELS = {
  minLength: 'onboardingPasswordReqMinLength',
  uppercase: 'onboardingPasswordReqUppercase',
  lowercase: 'onboardingPasswordReqLowercase',
  number: 'onboardingPasswordReqNumber',
  special: 'onboardingPasswordReqSpecial',
};

const DEFAULT_CLASS_NAME = 'space-y-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm';

/**
 * Live checklist of the password strength rules (ETP-5258).
 *
 * Every screen where a user picks a new password renders this same list — register, reset,
 * change, and the first password of an SSO account — so the rules the user sees cannot drift
 * from passwordPolicy.js, which mirrors the backend's PasswordPolicy. Renders nothing until the
 * user starts typing, so an empty form stays uncluttered.
 *
 * @param password    the password being typed
 * @param testIdPrefix prefix for the list and per-rule data-testids (`<prefix>-requirements`,
 *                    `<prefix>-rule-<rule>`), so each screen keeps addressable test ids
 * @param className   container classes, for hosts whose surface differs from the onboarding card
 */
export function PasswordStrengthChecklist({ password, testIdPrefix = 'password', className = DEFAULT_CLASS_NAME }) {
  const ui = useUI();
  if (!password) return null;
  const checks = getPasswordChecks(password);

  return (
    <ul data-testid={`${testIdPrefix}-requirements`} className={className}>
      <li className="mb-1 font-medium text-slate-600">
        {ui('onboardingPasswordRequirementsTitle')}
      </li>
      {PASSWORD_RULES.map(rule => {
        const met = checks[rule];
        return (
          <li
            key={rule}
            data-testid={`${testIdPrefix}-rule-${rule}`}
            data-met={met ? 'true' : 'false'}
            className={`flex items-center gap-2 ${met ? 'text-emerald-600' : 'text-slate-400'}`}
          >
            {met
              ? <Check className="h-4 w-4 shrink-0" data-testid="Check__79cf84" />
              : <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-slate-300" aria-hidden="true" />}
            <span>{ui(PASSWORD_RULE_LABELS[rule])}</span>
          </li>
        );
      })}
    </ul>
  );
}
