// @covers packages/app-shell-core/src/lib/environmentAccessGate.js
import { describe, it, beforeEach } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  getEnvironmentAccessDecision,
  observeEnvironmentAccessResponse,
  readAccessErrorMessage,
  resetEnvironmentAccessGateForTest,
  setEnvironmentAccessDecision,
  subscribeEnvironmentAccessDecision,
} from '../environmentAccessGate.js';

const PREFIX = 'Environment access is not available: ';

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status, headers: { 'Content-Type': 'application/json' },
  });
}

describe('readAccessErrorMessage — every envelope a blocked surface answers with', () => {
  it('reads NEO\'s nested error.message', () => {
    assert.equal(readAccessErrorMessage({ error: { message: `${PREFIX}DEMO_TRIAL_EXPIRED` } }),
      `${PREFIX}DEMO_TRIAL_EXPIRED`);
  });

  it('reads the plain string error Copilot and MCP send', () => {
    assert.equal(readAccessErrorMessage({ error: `${PREFIX}SUBSCRIPTION_REQUIRED` }),
      `${PREFIX}SUBSCRIPTION_REQUIRED`);
  });

  it('falls back to a top-level message, and to an empty string', () => {
    assert.equal(readAccessErrorMessage({ message: 'm' }), 'm');
    assert.equal(readAccessErrorMessage({}), '');
    assert.equal(readAccessErrorMessage(null), '');
  });
});

describe('observeEnvironmentAccessResponse — transport-level detection', () => {
  beforeEach(() => resetEnvironmentAccessGateForTest());

  it('records a blocking decision from a 402 and notifies subscribers', async () => {
    let notified = 0;
    subscribeEnvironmentAccessDecision(() => { notified += 1; });

    await observeEnvironmentAccessResponse(
      jsonResponse(402, { error: { message: `${PREFIX}DEMO_TRIAL_EXPIRED`, status: 402 } }));

    assert.equal(getEnvironmentAccessDecision(), 'DEMO_TRIAL_EXPIRED');
    assert.equal(notified, 1);
  });

  it('leaves the caller\'s body unread', async () => {
    const response = jsonResponse(402, { error: `${PREFIX}SUBSCRIPTION_REQUIRED` });

    await observeEnvironmentAccessResponse(response);

    assert.equal(response.bodyUsed, false);
    assert.equal((await response.json()).error, `${PREFIX}SUBSCRIPTION_REQUIRED`);
  });

  it('ignores a non-402, whatever its body says', async () => {
    await observeEnvironmentAccessResponse(
      jsonResponse(403, { error: `${PREFIX}DEMO_TRIAL_EXPIRED` }));

    assert.equal(getEnvironmentAccessDecision(), null);
  });

  it('ignores a 402 that is not a commercial block', async () => {
    await observeEnvironmentAccessResponse(
      jsonResponse(402, { error: `${PREFIX}MEMBERSHIP_REQUIRED` }));
    await observeEnvironmentAccessResponse(jsonResponse(402, { error: 'payment_required' }));

    assert.equal(getEnvironmentAccessDecision(), null);
  });

  it('records nothing and does not throw on a body that is not JSON', async () => {
    await observeEnvironmentAccessResponse(new Response('<html>', { status: 402 }));

    assert.equal(getEnvironmentAccessDecision(), null);
  });

  it('does not record a block for a session that is no longer the live one', async () => {
    // The body read is asynchronous: a 402 from the environment the user just left must not
    // block the one they switched to.
    await observeEnvironmentAccessResponse(
      jsonResponse(402, { error: `${PREFIX}DEMO_TRIAL_EXPIRED` }), () => false);

    assert.equal(getEnvironmentAccessDecision(), null);
  });

  it('never clears a recorded block', async () => {
    setEnvironmentAccessDecision('DEMO_TRIAL_EXPIRED');

    await observeEnvironmentAccessResponse(jsonResponse(200, {}));
    await observeEnvironmentAccessResponse(
      jsonResponse(402, { error: `${PREFIX}MEMBERSHIP_REQUIRED` }));

    assert.equal(getEnvironmentAccessDecision(), 'DEMO_TRIAL_EXPIRED');
  });

  it('tolerates a response-like object without clone()', async () => {
    await observeEnvironmentAccessResponse({ status: 402 });

    assert.equal(getEnvironmentAccessDecision(), null);
  });
});
