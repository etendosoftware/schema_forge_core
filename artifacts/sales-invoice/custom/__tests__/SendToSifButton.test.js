import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(__dirname, '..', 'SendToSifButton.jsx'), 'utf8');

describe('SendToSifButton', () => {

  it('exports a default function component named SendToSifButton', () => {
    assert.match(src, /export default function SendToSifButton/);
  });

  it('accepts data, recordId, token, apiBaseUrl, and status props', () => {
    assert.match(src, /\{\s*data.*recordId.*token.*apiBaseUrl.*status\s*\}/);
  });

  it('returns null when status is not CO', () => {
    assert.match(src, /status\s*!==\s*'CO'/);
  });

  it('uses useFiscalConfig hook', () => {
    assert.match(src, /useFiscalConfig/);
  });

  it('imports useFiscalConfig from fiscal-config path', () => {
    assert.match(src, /from\s+['"]@\/windows\/custom\/fiscal-config\/useFiscalConfig/);
  });

  it('defines VISIBLE_PROFILES set with sii, tbai, and sii+tbai profiles', () => {
    assert.match(src, /VISIBLE_PROFILES/);
    assert.match(src, /'sii'/);
    assert.match(src, /'tbai'/);
    assert.match(src, /'sii\+tbai'/);
  });

  it('returns null when profile is not in VISIBLE_PROFILES', () => {
    assert.match(src, /VISIBLE_PROFILES\.has\(profile\)/);
  });

  it('calls SII endpoint Em_aeatsii_send', () => {
    assert.match(src, /Em_aeatsii_send/);
  });

  it('calls TBAI endpoint Em_Tbai_Xmlgenerator', () => {
    assert.match(src, /Em_Tbai_Xmlgenerator/);
  });

  it('uses three modal phases: confirm, sending, results', () => {
    assert.match(src, /'confirm'/);
    assert.match(src, /'sending'/);
    assert.match(src, /'results'/);
  });

  it('sets phase to sending before fetch calls', () => {
    assert.match(src, /setPhase\('sending'\)/);
  });

  it('sets phase to results after fetch calls', () => {
    assert.match(src, /setPhase\('results'\)/);
  });

  it('handles SII and TBAI independently (separate try/catch)', () => {
    const catchCount = (src.match(/\}\s*catch\s*\(/g) || []).length;
    assert.ok(catchCount >= 2, `Expected at least 2 catch blocks, found ${catchCount}`);
  });

  it('uses sendToSif i18n key for button label', () => {
    assert.match(src, /ui\(['"]sendToSif['"]\)/);
  });

  it('uses sendToSifTitle i18n key for modal title', () => {
    assert.match(src, /ui\(['"]sendToSifTitle['"]\)/);
  });

  it('uses sendToSifSending i18n key during send phase', () => {
    assert.match(src, /ui\(['"]sendToSifSending['"]\)/);
  });

  it('shows success and error result rows using i18n keys', () => {
    assert.match(src, /ui\(['"]sendToSifSuccessSii['"]\)/);
    assert.match(src, /ui\(['"]sendToSifSuccessTbai['"]\)/);
    assert.match(src, /ui\(['"]sendToSifErrorSii['"]\)/);
    assert.match(src, /ui\(['"]sendToSifErrorTbai['"]\)/);
  });

  it('derives orgId from selectedOrg via useAuth', () => {
    assert.match(src, /useAuth/);
    assert.match(src, /selectedOrg/);
  });
});
