import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveLogoutDestination } from '../logoutRoute.js';

test('keeps a configured internal logout destination', () => {
  assert.equal(resolveLogoutDestination('/onboarding'), '/onboarding');
});

test('rejects external, protocol-relative, and malformed destinations', () => {
  for (const destination of [
    'https://attacker.example/steal-session',
    '//attacker.example/steal-session',
    '/onboarding%ZZ',
    '/onboarding\\escape',
  ]) {
    assert.equal(resolveLogoutDestination(destination), '/');
  }
});

test('rejects logout and nested returnTo loops', () => {
  for (const destination of [
    '/logout',
    '/onboarding?returnTo=/logout',
    '/onboarding?returnTo=%2Flogout',
    '/onboarding?returnTo=%2Fonboarding%3FreturnTo%3D%252Flogout',
  ]) {
    assert.equal(resolveLogoutDestination(destination), '/');
  }
});

test('uses the valid fallback when the configured destination is unsafe', () => {
  assert.equal(
    resolveLogoutDestination('/logout?returnTo=https%3A%2F%2Fattacker.example', '/onboarding'),
    '/onboarding',
  );
});
