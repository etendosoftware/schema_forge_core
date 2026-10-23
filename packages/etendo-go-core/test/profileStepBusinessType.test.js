import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const profileStep = readFileSync(
  join(__dirname, '..', 'src', 'onboarding', 'steps', 'ProfileStep.jsx'),
  'utf8',
);

describe('ProfileStep business type fallback', () => {
  it('offers only business types supported by organization persistence by default', () => {
    assert.match(
      profileStep,
      /config\.businessTypeValues\s*\|\|\s*\['company',\s*'freelancer'\]/,
    );
    assert.doesNotMatch(profileStep, /\['company',\s*'freelancer',\s*'advisory'\]/);
  });
});
