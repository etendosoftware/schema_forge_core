import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(__dirname, '..', 'InternalConsumptionActions.jsx'), 'utf8');

describe('InternalConsumptionActions', () => {
  it('exports a default function component', () => {
    assert.match(src, /export default function InternalConsumptionActions/);
  });

  it('accepts data, recordId, token, apiBaseUrl, onClose, onRefresh props', () => {
    assert.match(src, /\{\s*data.*recordId.*token.*apiBaseUrl.*onClose.*onRefresh\s*\}/s);
  });

  it('returns null when status is VO (voided)', () => {
    assert.match(src, /data\?\.status\s*===\s*['"]VO['"]/);
    assert.match(src, /return null/);
  });

  it('POSTs to the processNow action endpoint', () => {
    assert.match(src, /\/action\/processNow/);
    assert.match(src, /method:\s*['"]POST['"]/);
  });

  it('sends action CO in the request body', () => {
    assert.match(src, /action:\s*['"]CO['"]/);
  });

  it('calls onRefresh after successful processing', () => {
    assert.match(src, /onRefresh\?\.\(\)/);
  });

  it('disables the button while processing', () => {
    assert.match(src, /disabled=\{processing\}/);
  });

  it('uses useUI for i18n', () => {
    assert.match(src, /useUI/);
    assert.match(src, /from\s+['"]@\/i18n['"]/);
  });
});
