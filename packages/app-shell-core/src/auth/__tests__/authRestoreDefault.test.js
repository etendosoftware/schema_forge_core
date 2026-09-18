import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// ETP-4576 — a provider given NO props must still try to restore.
//
// `restoreSession` derives from `credentialMode`, and the session lives in memory rather than
// localStorage. When that default was `bearer` the derivation turned the restore off, so there
// was nothing to restore from AND nothing restoring: every cold load came up anonymous and a
// plain browser refresh signed the user out. It also stranded the mocked E2E suite, which enters
// through a cold load — 564 specs timed out waiting for a dashboard that never came.
//
// Source-reading, because the failure is in the DEFAULT itself: any test that passes the props
// explicitly proves nothing about it. Lives in its own .test.js because the provider's behavioural
// suite is a .jsx, which this package's `npm test` glob does not pick up.
describe('the default scheme leaves the restore armed (ETP-4576)', () => {
  const src = readFileSync(new URL('../AuthContext.jsx', import.meta.url), 'utf8');
  const codeOnly = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

  it('defaults credentialMode to auto, not bearer', () => {
    assert.match(codeOnly, /credentialMode\s*=\s*CREDENTIAL_MODES\.auto/);
    assert.doesNotMatch(codeOnly, /credentialMode\s*=\s*CREDENTIAL_MODES\.bearer/);
  });

  it('keeps restoreSession derived from a mode that arms it', () => {
    const derivation = codeOnly.slice(codeOnly.indexOf('restoreSession ='));
    assert.match(derivation, /CREDENTIAL_MODES\.auto/);
  });
});
