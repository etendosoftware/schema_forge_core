import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createSessionController } from '../sessionController.js';
import { createMemoryAuthStorage } from '../session.js';
import { sessionFixture } from './refreshFixtures.js';

describe('cookie restore identity (ETP-5645)', () => {
  it('keeps the identity when the first persisting replace catches storage up', () => {
    const controller = createSessionController({}, createMemoryAuthStorage(), undefined, 'http://api');
    const session = sessionFixture();
    controller.replace(session, { refresh: false, persist: false });
    const snapshot = controller.capture();
    assert.equal(controller.isSameIdentity(snapshot), true);
    controller.replace(session, { refresh: false, bump: false });
    assert.equal(controller.isSameIdentity(snapshot), true);
  });

  it('still reports a different identity after logout', () => {
    const controller = createSessionController({}, createMemoryAuthStorage(), undefined, 'http://api');
    controller.replace(sessionFixture(), { refresh: false, persist: false });
    const snapshot = controller.capture();
    controller.logout();
    assert.equal(controller.isSameIdentity(snapshot), false);
  });
});
