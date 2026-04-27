# Schema Forge Onboarding Test Coverage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove the Schema Forge onboarding frontend works correctly by covering each modified onboarding point with unit tests and a mocked integration/E2E flow that does not require changing Etendo backend state.

**Architecture:** Keep the delivery scoped to the `schema-forge` repository. Extract the non-visual onboarding behavior currently embedded in `tools/app-shell/src/pages/OnboardingPage.jsx` into small pure modules so Node unit tests can assert request construction, NDJSON progress parsing, environment login storage, and readiness checks. Add a Playwright test with mocked `/sws/go/*` and `/sws/neo/*` responses to validate the browser journey without touching a real tenant.

**Tech Stack:** React 18, Vite app-shell, Node.js `node:test`, Playwright E2E, browser `fetch`, localStorage, mocked Playwright routes.

---

## Scope boundaries

This plan is intentionally limited to Schema Forge:

- Do not modify `etendo_core/`.
- Do not modify `modules/com.etendoerp.go/`.
- Do not rely on real DB seed changes as the primary evidence.
- Do not run state-changing onboarding tests by default.
- Use mocks only at the backend/network boundary because `/sws/go/onboarding` is external to Schema Forge and state-changing.

The intended requirement is:

> A user can complete the Schema Forge onboarding frontend, receive an environment session, and land in a state where the app can verify the required Sales Invoice readiness data through NEO selectors/defaults before claiming onboarding success.

## File structure

### Create `tools/app-shell/src/pages/onboarding/onboardingApi.js`

Responsibility: all Schema Forge frontend request construction and response parsing for onboarding endpoints.

Exports:

- `buildAuthHeaders(token)`
- `registerAccount(fetchImpl, baseUrl, form)`
- `loginAccount(fetchImpl, baseUrl, form)`
- `fetchAccount(fetchImpl, baseUrl, token)`
- `fetchEnvironments(fetchImpl, baseUrl, token)`
- `loginEnvironment(fetchImpl, baseUrl, token, env)`
- `runOnboardingStream(fetchImpl, baseUrl, token, form, onMessage)`

### Create `tools/app-shell/src/pages/onboarding/onboardingState.js`

Responsibility: pure transformations for onboarding state.

Exports:

- `initialSetupSteps()`
- `mapBackendStepStatus(status)`
- `applyProgressMessage(steps, message)`
- `buildOnboardingPayload(form)`
- `selectPreferredOrg(role)`
- `buildEnvironmentSessionStorage(env, loginResponse)`
- `isProfileStepValid(form)`
- `isCompanyStepValid(form)`

### Create `tools/app-shell/src/pages/onboarding/onboardingReadiness.js`

Responsibility: Schema Forge frontend readiness contract for the first useful post-onboarding flow.

Exports:

- `READINESS_ENDPOINTS`
- `checkSalesInvoiceReadiness(fetchImpl, baseUrl, token)`

Readiness criteria:

- `/sws/neo/session` returns `200`.
- `/sws/neo/sales-invoice/header/defaults` returns `200`.
- payment-term selector returns at least one item with string `id` and non-empty `label`.
- business-partner/customer selector returns at least one item with string `id` and non-empty `label`.
- document type in defaults is present and not `"0"`.

### Modify `tools/app-shell/src/pages/OnboardingPage.jsx`

Responsibility: UI composition only. Keep visual layout intact, but delegate pure work to the new modules.

Changes:

- Import API helpers from `./onboarding/onboardingApi.js`.
- Import state helpers from `./onboarding/onboardingState.js`.
- Import readiness check from `./onboarding/onboardingReadiness.js`.
- Replace inline request construction with helpers.
- After successful onboarding and environment login, run readiness check before redirecting to `/dashboard`.
- If readiness fails, show a clear error in the onboarding success/progress surface rather than silently redirecting to a broken first invoice experience.

### Create `tools/app-shell/src/pages/onboarding/__tests__/onboardingApi.test.js`

Node unit tests for API helpers.

### Create `tools/app-shell/src/pages/onboarding/__tests__/onboardingState.test.js`

Node unit tests for state transformations.

### Create `tools/app-shell/src/pages/onboarding/__tests__/onboardingReadiness.test.js`

Node unit tests for readiness checks with fetch fakes.

### Create `e2e/tests/flows/onboarding.mocked.spec.js`

Playwright mocked integration test. It validates the real browser UI journey with network routes mocked at `/sws/go/*` and `/sws/neo/*`.

### Modify `Makefile`

Add page-level unit tests to `make test` so these tests actually run in the repository baseline.

Current `make test` only runs:

```make
cd cli && node --test 'test/*.test.js'
node --test tools/app-shell/src/lib/__tests__/*.test.js
```

Change to:

```make
test: ## Run all CLI tests and app-shell unit tests
	cd cli && node --test 'test/*.test.js'
	node --test tools/app-shell/src/lib/__tests__/*.test.js
	node --test tools/app-shell/src/pages/onboarding/__tests__/*.test.js
```

### Modify `docs/qa/user-onboarding-runtime-qa-2026-04-24.md`

Update only after implementation. Record that Schema Forge now has mocked frontend integration coverage and clarify that real backend seed blockers remain outside this repository unless separately fixed in Etendo Go.

---

## Task 1: Extract and test onboarding API helpers

**Files:**
- Create: `tools/app-shell/src/pages/onboarding/onboardingApi.js`
- Create: `tools/app-shell/src/pages/onboarding/__tests__/onboardingApi.test.js`
- Modify: `tools/app-shell/src/pages/OnboardingPage.jsx`

- [ ] **Step 1: Create failing API helper tests**

Create `tools/app-shell/src/pages/onboarding/__tests__/onboardingApi.test.js`:

```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAuthHeaders,
  registerAccount,
  loginAccount,
  fetchAccount,
  fetchEnvironments,
  loginEnvironment,
  runOnboardingStream,
} from '../onboardingApi.js';

function jsonResponse(body, { ok = true, status = 200 } = {}) {
  return {
    ok,
    status,
    async json() {
      return body;
    },
  };
}

function streamResponse(lines) {
  const encoder = new TextEncoder();
  const chunks = lines.map(line => encoder.encode(`${JSON.stringify(line)}\n`));
  let index = 0;
  return {
    ok: true,
    body: {
      getReader() {
        return {
          async read() {
            if (index >= chunks.length) return { done: true, value: undefined };
            return { done: false, value: chunks[index++] };
          },
        };
      },
    },
  };
}

describe('onboardingApi', () => {
  it('buildAuthHeaders includes content type and optional bearer token', () => {
    assert.deepEqual(buildAuthHeaders('platform-token'), {
      'Content-Type': 'application/json',
      Authorization: 'Bearer platform-token',
    });
    assert.deepEqual(buildAuthHeaders(null), {
      'Content-Type': 'application/json',
    });
  });

  it('registerAccount posts the registration form to /sws/go/register', async () => {
    const calls = [];
    const fetchImpl = async (url, options) => {
      calls.push({ url, options });
      return jsonResponse({ token: 'platform-token', account: { email: 'new@example.com' } });
    };

    const result = await registerAccount(fetchImpl, '/etendo', {
      name: 'New User',
      email: 'new@example.com',
      password: 'secret',
    });

    assert.equal(result.token, 'platform-token');
    assert.equal(calls[0].url, '/etendo/sws/go/register');
    assert.equal(calls[0].options.method, 'POST');
    assert.equal(calls[0].options.headers['Content-Type'], 'application/json');
    assert.equal(calls[0].options.body, JSON.stringify({
      name: 'New User',
      email: 'new@example.com',
      password: 'secret',
    }));
  });

  it('loginAccount posts credentials to /sws/go/login', async () => {
    const calls = [];
    const fetchImpl = async (url, options) => {
      calls.push({ url, options });
      return jsonResponse({ token: 'platform-token', account: { email: 'user@example.com' } });
    };

    const result = await loginAccount(fetchImpl, '', {
      email: 'user@example.com',
      password: 'secret',
    });

    assert.equal(result.token, 'platform-token');
    assert.equal(calls[0].url, '/sws/go/login');
    assert.equal(calls[0].options.method, 'POST');
  });

  it('fetchAccount uses the platform token against /sws/go/me', async () => {
    const calls = [];
    const fetchImpl = async (url, options) => {
      calls.push({ url, options });
      return jsonResponse({ email: 'user@example.com', name: 'User' });
    };

    const account = await fetchAccount(fetchImpl, '', 'platform-token');

    assert.equal(account.name, 'User');
    assert.equal(calls[0].url, '/sws/go/me');
    assert.equal(calls[0].options.headers.Authorization, 'Bearer platform-token');
  });

  it('fetchEnvironments returns an empty array when the backend omits environments', async () => {
    const fetchImpl = async () => jsonResponse({});

    const envs = await fetchEnvironments(fetchImpl, '', 'platform-token');

    assert.deepEqual(envs, []);
  });

  it('loginEnvironment calls /sws/go/login with the environment admin user id', async () => {
    const calls = [];
    const fetchImpl = async (url, options) => {
      calls.push({ url, options });
      return jsonResponse({ token: 'env-token', roleList: [] });
    };

    const result = await loginEnvironment(fetchImpl, '', 'platform-token', {
      adminUserId: 'AD_USER_1',
    });

    assert.equal(result.token, 'env-token');
    assert.equal(calls[0].url, '/sws/go/login?userId=AD_USER_1');
    assert.equal(calls[0].options.headers.Authorization, 'Bearer platform-token');
  });

  it('runOnboardingStream posts payload and emits every NDJSON message', async () => {
    const calls = [];
    const messages = [];
    const fetchImpl = async (url, options) => {
      calls.push({ url, options });
      return streamResponse([
        { type: 'progress', step: 'client', status: 'in_progress' },
        { type: 'progress', step: 'client', status: 'done', ms: 20 },
        { type: 'result', success: true },
      ]);
    };

    const result = await runOnboardingStream(fetchImpl, '', 'platform-token', {
      clientName: 'QA Company',
      currency: 'EUR',
      language: 'es_ES',
      countryCode: 'ES',
      fiscalIdValue: 'B12345678',
    }, message => messages.push(message));

    assert.equal(result.success, true);
    assert.equal(calls[0].url, '/sws/go/onboarding');
    assert.equal(calls[0].options.method, 'POST');
    assert.equal(calls[0].options.headers.Authorization, 'Bearer platform-token');
    assert.equal(calls[0].options.body, JSON.stringify({
      clientName: 'QA Company',
      currency: 'EUR',
      language: 'es_ES',
      countryCode: 'ES',
    }));
    assert.equal(messages.length, 3);
  });
});
```

- [ ] **Step 2: Run the failing API tests**

Run:

```bash
node --test tools/app-shell/src/pages/onboarding/__tests__/onboardingApi.test.js
```

Expected: FAIL because `onboardingApi.js` does not exist yet.

- [ ] **Step 3: Implement API helpers**

Create `tools/app-shell/src/pages/onboarding/onboardingApi.js`:

```js
export function buildAuthHeaders(token) {
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function readJsonResponse(res, fallbackMessage) {
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.message || fallbackMessage);
  }
  return data;
}

export async function registerAccount(fetchImpl, baseUrl, form) {
  const res = await fetchImpl(`${baseUrl}/sws/go/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(form),
  });
  return readJsonResponse(res, 'No se pudo crear la cuenta.');
}

export async function loginAccount(fetchImpl, baseUrl, form) {
  const res = await fetchImpl(`${baseUrl}/sws/go/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(form),
  });
  return readJsonResponse(res, 'Credenciales invalidas.');
}

export async function fetchAccount(fetchImpl, baseUrl, token) {
  const res = await fetchImpl(`${baseUrl}/sws/go/me`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return readJsonResponse(res, 'Invalid platform session.');
}

export async function fetchEnvironments(fetchImpl, baseUrl, token) {
  const res = await fetchImpl(`${baseUrl}/sws/go/environments`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  const data = await readJsonResponse(res, 'Could not load environments.');
  return data.environments || [];
}

export async function loginEnvironment(fetchImpl, baseUrl, token, env) {
  const userId = encodeURIComponent(env.adminUserId);
  const res = await fetchImpl(`${baseUrl}/sws/go/login?userId=${userId}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return readJsonResponse(res, 'Login failed.');
}

export async function runOnboardingStream(fetchImpl, baseUrl, token, form, onMessage) {
  const res = await fetchImpl(`${baseUrl}/sws/go/onboarding`, {
    method: 'POST',
    headers: buildAuthHeaders(token),
    body: JSON.stringify({
      clientName: form.clientName,
      currency: form.currency,
      language: form.language,
      countryCode: form.countryCode,
    }),
  });

  if (!res.body?.getReader) {
    throw new Error('Onboarding response stream is not available.');
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let finalResult = null;

  while (true) {
    const { done, value } = await reader.read();
    if (value) buffer += decoder.decode(value, { stream: !done });
    if (done) buffer += decoder.decode();

    const lines = buffer.split('\n');
    buffer = done ? '' : lines.pop();

    for (const line of lines) {
      if (!line.trim()) continue;
      const message = JSON.parse(line);
      onMessage?.(message);
      if (message.type === 'result') {
        finalResult = message;
      }
    }

    if (done) break;
  }

  if (!finalResult) {
    throw new Error('Onboarding finished without a result message.');
  }
  return finalResult;
}
```

- [ ] **Step 4: Run API tests until green**

Run:

```bash
node --test tools/app-shell/src/pages/onboarding/__tests__/onboardingApi.test.js
```

Expected: PASS.

- [ ] **Step 5: Replace API request construction in OnboardingPage**

Modify `tools/app-shell/src/pages/OnboardingPage.jsx` to import:

```js
import {
  registerAccount,
  loginAccount,
  fetchAccount,
  fetchEnvironments,
  loginEnvironment,
  runOnboardingStream,
} from './onboarding/onboardingApi.js';
```

Then replace inline `fetch` calls inside `handleRegister`, `handleLogin`, token validation, `routeByEnvironments`, `loginToEnvironment`, and `runOnboarding` with the helpers. Preserve current UI behavior while moving mechanics out of the component.

- [ ] **Step 6: Run baseline tests**

Run:

```bash
node --test tools/app-shell/src/pages/onboarding/__tests__/onboardingApi.test.js
npm run build --workspace=tools/app-shell
```

Expected: both PASS.

---

## Task 2: Extract and test onboarding state transformations

**Files:**
- Create: `tools/app-shell/src/pages/onboarding/onboardingState.js`
- Create: `tools/app-shell/src/pages/onboarding/__tests__/onboardingState.test.js`
- Modify: `tools/app-shell/src/pages/OnboardingPage.jsx`

- [ ] **Step 1: Create failing state tests**

Create `tools/app-shell/src/pages/onboarding/__tests__/onboardingState.test.js`:

```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyProgressMessage,
  buildEnvironmentSessionStorage,
  buildOnboardingPayload,
  initialSetupSteps,
  isCompanyStepValid,
  isProfileStepValid,
  mapBackendStepStatus,
  selectPreferredOrg,
} from '../onboardingState.js';

describe('onboardingState', () => {
  it('initialSetupSteps returns fresh pending step objects', () => {
    const first = initialSetupSteps();
    const second = initialSetupSteps();

    first[0].status = 'done';

    assert.equal(second[0].name, 'setup');
    assert.equal(second[0].status, 'pending');
    assert.notEqual(first[0], second[0]);
  });

  it('mapBackendStepStatus preserves frontend status vocabulary', () => {
    assert.equal(mapBackendStepStatus('in_progress'), 'running');
    assert.equal(mapBackendStepStatus('done'), 'done');
    assert.equal(mapBackendStepStatus('error'), 'failed');
    assert.equal(mapBackendStepStatus('pending'), 'pending');
  });

  it('applyProgressMessage updates only the matching step', () => {
    const steps = initialSetupSteps();
    const next = applyProgressMessage(steps, {
      type: 'progress',
      step: 'client',
      status: 'done',
      ms: 123,
    });

    assert.equal(next.find(step => step.name === 'client').status, 'done');
    assert.equal(next.find(step => step.name === 'client').ms, 123);
    assert.equal(next.find(step => step.name === 'organization').status, 'pending');
  });

  it('applyProgressMessage stores error text for failed steps', () => {
    const next = applyProgressMessage(initialSetupSteps(), {
      type: 'progress',
      step: 'organization',
      status: 'error',
      message: 'Organization failed',
    });

    const failed = next.find(step => step.name === 'organization');
    assert.equal(failed.status, 'failed');
    assert.equal(failed.error, 'Organization failed');
  });

  it('buildOnboardingPayload sends only fields owned by the onboarding API contract', () => {
    assert.deepEqual(buildOnboardingPayload({
      fullName: 'QA User',
      clientName: 'QA Company',
      currency: 'EUR',
      language: 'es_ES',
      countryCode: 'ES',
      fiscalIdValue: 'B12345678',
      address: 'QA Street',
    }), {
      clientName: 'QA Company',
      currency: 'EUR',
      language: 'es_ES',
      countryCode: 'ES',
    });
  });

  it('selectPreferredOrg prefers a non-star organization', () => {
    assert.deepEqual(selectPreferredOrg({
      orgList: [
        { id: 'STAR', name: '*' },
        { id: 'ORG_1', name: 'QA Org' },
      ],
    }), { id: 'ORG_1', name: 'QA Org' });
  });

  it('selectPreferredOrg falls back to the first organization', () => {
    assert.deepEqual(selectPreferredOrg({
      orgList: [{ id: 'STAR', name: '*' }],
    }), { id: 'STAR', name: '*' });
  });

  it('buildEnvironmentSessionStorage serializes environment login state', () => {
    const storage = buildEnvironmentSessionStorage(
      { adminUserName: 'QA Admin', adminUser: 'qa-admin' },
      {
        token: 'env-token',
        roleList: [
          {
            id: 'ROLE_1',
            name: 'Admin',
            orgList: [{ id: 'ORG_1', name: 'QA Org' }],
          },
        ],
      }
    );

    assert.equal(storage.sf_auth_token, 'env-token');
    assert.equal(storage.sf_auth_user, 'QA Admin');
    assert.equal(JSON.parse(storage.sf_auth_rolelist)[0].id, 'ROLE_1');
    assert.equal(JSON.parse(storage.sf_auth_selected_role).id, 'ROLE_1');
    assert.equal(JSON.parse(storage.sf_auth_selected_org).id, 'ORG_1');
  });

  it('isProfileStepValid requires full name and country', () => {
    assert.equal(isProfileStepValid({ fullName: 'QA User', countryCode: 'ES' }), true);
    assert.equal(isProfileStepValid({ fullName: ' ', countryCode: 'ES' }), false);
    assert.equal(isProfileStepValid({ fullName: 'QA User', countryCode: '' }), false);
  });

  it('isCompanyStepValid requires company name and fiscal id', () => {
    assert.equal(isCompanyStepValid({ clientName: 'QA Company', fiscalIdValue: 'B12345678' }), true);
    assert.equal(isCompanyStepValid({ clientName: ' ', fiscalIdValue: 'B12345678' }), false);
    assert.equal(isCompanyStepValid({ clientName: 'QA Company', fiscalIdValue: ' ' }), false);
  });
});
```

- [ ] **Step 2: Run failing state tests**

Run:

```bash
node --test tools/app-shell/src/pages/onboarding/__tests__/onboardingState.test.js
```

Expected: FAIL because `onboardingState.js` does not exist yet.

- [ ] **Step 3: Implement state helpers**

Create `tools/app-shell/src/pages/onboarding/onboardingState.js`:

```js
export const SETUP_STEP_DEFINITIONS = [
  { name: 'setup', label: 'Preparando contexto', estimate: '1s' },
  { name: 'client', label: 'Crear empresa', estimate: '2 min' },
  { name: 'organization', label: 'Crear organizacion', estimate: '1 min' },
  { name: 'finalize', label: 'Finalizar configuracion', estimate: '1s' },
];

export function initialSetupSteps() {
  return SETUP_STEP_DEFINITIONS.map(step => ({
    ...step,
    status: 'pending',
    ms: null,
    error: null,
  }));
}

export function mapBackendStepStatus(status) {
  if (status === 'in_progress') return 'running';
  if (status === 'done') return 'done';
  if (status === 'error') return 'failed';
  return status;
}

export function applyProgressMessage(steps, message) {
  if (message?.type !== 'progress' || !message.step) return steps;
  return steps.map(step => step.name === message.step
    ? {
      ...step,
      status: mapBackendStepStatus(message.status),
      ms: message.ms || null,
      error: message.status === 'error' ? message.message : null,
    }
    : step);
}

export function buildOnboardingPayload(form) {
  return {
    clientName: form.clientName,
    currency: form.currency,
    language: form.language,
    countryCode: form.countryCode,
  };
}

export function selectPreferredOrg(role) {
  return role?.orgList?.find(org => org.name !== '*') || role?.orgList?.[0] || null;
}

export function buildEnvironmentSessionStorage(env, loginResponse) {
  const values = {
    sf_auth_token: loginResponse.token,
    sf_auth_user: env.adminUserName || env.adminUser || '',
  };

  if (loginResponse.roleList) {
    values.sf_auth_rolelist = JSON.stringify(loginResponse.roleList);
    const role = loginResponse.roleList[0];
    if (role) {
      values.sf_auth_selected_role = JSON.stringify(role);
      const org = selectPreferredOrg(role);
      if (org) values.sf_auth_selected_org = JSON.stringify(org);
    }
  }

  return values;
}

export function isProfileStepValid(form) {
  return Boolean(form.fullName?.trim() && form.countryCode);
}

export function isCompanyStepValid(form) {
  return Boolean(form.clientName?.trim() && form.fiscalIdValue?.trim());
}
```

- [ ] **Step 4: Run state tests until green**

Run:

```bash
node --test tools/app-shell/src/pages/onboarding/__tests__/onboardingState.test.js
```

Expected: PASS.

- [ ] **Step 5: Wire state helpers into OnboardingPage**

Modify `tools/app-shell/src/pages/OnboardingPage.jsx`:

- Keep `SETUP_STEPS` in the component only if icons are needed for rendering.
- Use `initialSetupSteps()` for state initialization and reset.
- Use `applyProgressMessage()` inside the onboarding stream message handler.
- Use `isProfileStepValid(form)` and `isCompanyStepValid(form)` for button enabling.
- Use `buildEnvironmentSessionStorage()` inside environment login and write returned key/value pairs into `localStorage`.

Do not change visible copy or layout in this task.

- [ ] **Step 6: Run state and build verification**

Run:

```bash
node --test tools/app-shell/src/pages/onboarding/__tests__/onboardingState.test.js
npm run build --workspace=tools/app-shell
```

Expected: both PASS.

---

## Task 3: Add Schema Forge readiness checks with unit coverage

**Files:**
- Create: `tools/app-shell/src/pages/onboarding/onboardingReadiness.js`
- Create: `tools/app-shell/src/pages/onboarding/__tests__/onboardingReadiness.test.js`
- Modify: `tools/app-shell/src/pages/OnboardingPage.jsx`

- [ ] **Step 1: Create failing readiness tests**

Create `tools/app-shell/src/pages/onboarding/__tests__/onboardingReadiness.test.js`:

```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { checkSalesInvoiceReadiness, READINESS_ENDPOINTS } from '../onboardingReadiness.js';

function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return body;
    },
  };
}

function createFetchByUrl(responses) {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    const entry = responses.find(response => url.includes(response.includes));
    if (!entry) throw new Error(`Unexpected URL: ${url}`);
    return jsonResponse(entry.status, entry.body);
  };
  fetchImpl.calls = calls;
  return fetchImpl;
}

const readyResponses = [
  { includes: READINESS_ENDPOINTS.session, status: 200, body: { user: 'qa' } },
  { includes: READINESS_ENDPOINTS.defaults, status: 200, body: { documentType: 'DOC_TYPE_1' } },
  { includes: READINESS_ENDPOINTS.paymentTerms, status: 200, body: { items: [{ id: 'TERM_1', label: 'Immediate' }] } },
  { includes: READINESS_ENDPOINTS.customers, status: 200, body: { items: [{ id: 'BP_1', label: 'QA Customer' }] } },
];

describe('checkSalesInvoiceReadiness', () => {
  it('passes when session, defaults, payment terms, customers, and document type are usable', async () => {
    const fetchImpl = createFetchByUrl(readyResponses);

    const result = await checkSalesInvoiceReadiness(fetchImpl, '', 'env-token');

    assert.equal(result.ready, true);
    assert.deepEqual(result.failures, []);
    assert.equal(fetchImpl.calls.length, 4);
    assert.equal(fetchImpl.calls[0].options.headers.Authorization, 'Bearer env-token');
  });

  it('fails when the session endpoint is unauthorized', async () => {
    const fetchImpl = createFetchByUrl([
      { includes: READINESS_ENDPOINTS.session, status: 401, body: {} },
      ...readyResponses.slice(1),
    ]);

    const result = await checkSalesInvoiceReadiness(fetchImpl, '', 'env-token');

    assert.equal(result.ready, false);
    assert.match(result.failures.join('\n'), /session/i);
  });

  it('fails when payment terms are missing', async () => {
    const fetchImpl = createFetchByUrl([
      readyResponses[0],
      readyResponses[1],
      { includes: READINESS_ENDPOINTS.paymentTerms, status: 200, body: { items: [] } },
      readyResponses[3],
    ]);

    const result = await checkSalesInvoiceReadiness(fetchImpl, '', 'env-token');

    assert.equal(result.ready, false);
    assert.match(result.failures.join('\n'), /payment term/i);
  });

  it('fails when customer selector is empty', async () => {
    const fetchImpl = createFetchByUrl([
      readyResponses[0],
      readyResponses[1],
      readyResponses[2],
      { includes: READINESS_ENDPOINTS.customers, status: 200, body: { items: [] } },
    ]);

    const result = await checkSalesInvoiceReadiness(fetchImpl, '', 'env-token');

    assert.equal(result.ready, false);
    assert.match(result.failures.join('\n'), /customer/i);
  });

  it('fails when document type is zero', async () => {
    const fetchImpl = createFetchByUrl([
      readyResponses[0],
      { includes: READINESS_ENDPOINTS.defaults, status: 200, body: { documentType: '0' } },
      readyResponses[2],
      readyResponses[3],
    ]);

    const result = await checkSalesInvoiceReadiness(fetchImpl, '', 'env-token');

    assert.equal(result.ready, false);
    assert.match(result.failures.join('\n'), /document type/i);
  });
});
```

- [ ] **Step 2: Run failing readiness tests**

Run:

```bash
node --test tools/app-shell/src/pages/onboarding/__tests__/onboardingReadiness.test.js
```

Expected: FAIL because `onboardingReadiness.js` does not exist yet.

- [ ] **Step 3: Implement readiness helper**

Create `tools/app-shell/src/pages/onboarding/onboardingReadiness.js`:

```js
export const READINESS_ENDPOINTS = {
  session: '/sws/neo/session',
  defaults: '/sws/neo/sales-invoice/header/defaults',
  paymentTerms: '/sws/neo/sales-invoice/header/selectors/C_PaymentTerm_ID?isSOTrx=Y&isCustomer=Y&limit=50&offset=0',
  customers: '/sws/neo/sales-invoice/header/selectors/C_BPartner_ID?isSOTrx=Y&isCustomer=Y&limit=50&offset=0',
};

async function fetchJson(fetchImpl, baseUrl, token, endpoint, label) {
  const response = await fetchImpl(`${baseUrl}${endpoint}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  let body = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  return { label, status: response.status, ok: response.ok, body };
}

function hasUsableSelectorItem(body) {
  return Array.isArray(body?.items)
    && body.items.some(item => typeof item.id === 'string' && item.id && typeof item.label === 'string' && item.label.trim());
}

function readDocumentType(defaultsBody) {
  return defaultsBody?.documentType
    || defaultsBody?.values?.documentType
    || defaultsBody?.data?.documentType
    || defaultsBody?.defaults?.documentType
    || null;
}

export async function checkSalesInvoiceReadiness(fetchImpl, baseUrl, token) {
  const [session, defaults, paymentTerms, customers] = await Promise.all([
    fetchJson(fetchImpl, baseUrl, token, READINESS_ENDPOINTS.session, 'session'),
    fetchJson(fetchImpl, baseUrl, token, READINESS_ENDPOINTS.defaults, 'sales invoice defaults'),
    fetchJson(fetchImpl, baseUrl, token, READINESS_ENDPOINTS.paymentTerms, 'payment terms'),
    fetchJson(fetchImpl, baseUrl, token, READINESS_ENDPOINTS.customers, 'customers'),
  ]);

  const failures = [];

  if (!session.ok) failures.push(`NEO session is not ready (${session.status}).`);
  if (!defaults.ok) failures.push(`Sales Invoice defaults are not ready (${defaults.status}).`);
  if (!paymentTerms.ok || !hasUsableSelectorItem(paymentTerms.body)) {
    failures.push('Sales Invoice payment term selector has no usable payment term.');
  }
  if (!customers.ok || !hasUsableSelectorItem(customers.body)) {
    failures.push('Sales Invoice customer selector has no usable customer.');
  }

  const documentType = readDocumentType(defaults.body);
  if (!documentType || documentType === '0') {
    failures.push('Sales Invoice document type is missing or invalid.');
  }

  return {
    ready: failures.length === 0,
    failures,
    checks: { session, defaults, paymentTerms, customers },
  };
}
```

- [ ] **Step 4: Run readiness tests until green**

Run:

```bash
node --test tools/app-shell/src/pages/onboarding/__tests__/onboardingReadiness.test.js
```

Expected: PASS.

- [ ] **Step 5: Wire readiness into OnboardingPage after environment login**

Modify `tools/app-shell/src/pages/OnboardingPage.jsx`:

- Import `checkSalesInvoiceReadiness`.
- After a successful `loginEnvironment` response writes `sf_auth_token`, run:

```js
const readiness = await checkSalesInvoiceReadiness(fetch, BASE_URL, data.token);
if (!readiness.ready) {
  setResult({
    status: 'failed',
    error: `El entorno se creó, pero todavía no está listo para facturar: ${readiness.failures.join(' ')}`,
  });
  return;
}
```

- Only redirect to `/dashboard` when readiness is ready.

This makes the frontend tell the truth: onboarding is not considered fully successful if the post-onboarding invoice readiness contract is broken.

- [ ] **Step 6: Run unit and build verification**

Run:

```bash
node --test tools/app-shell/src/pages/onboarding/__tests__/onboardingReadiness.test.js
npm run build --workspace=tools/app-shell
```

Expected: both PASS.

---

## Task 4: Add mocked browser integration coverage for onboarding

**Files:**
- Create: `e2e/tests/flows/onboarding.mocked.spec.js`

- [ ] **Step 1: Create mocked Playwright integration test**

Create `e2e/tests/flows/onboarding.mocked.spec.js`:

```js
import { test, expect } from '@playwright/test';

test.describe('Onboarding with mocked Schema Forge backend boundary', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/sws/go/me', async route => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: { message: 'invalid' } }),
      });
    });

    await page.route('**/sws/go/register', async route => {
      const body = route.request().postDataJSON();
      expect(body).toMatchObject({
        name: 'QA Onboarding User',
        email: /qa-onboarding-.+@example\.com/,
      });
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          token: 'platform-token',
          account: { name: body.name, email: body.email },
        }),
      });
    });

    await page.route('**/sws/go/onboarding', async route => {
      const body = route.request().postDataJSON();
      expect(body).toEqual({
        clientName: 'QA Mock Company',
        currency: 'EUR',
        language: 'es_ES',
        countryCode: 'ES',
      });
      await route.fulfill({
        status: 200,
        contentType: 'application/x-ndjson',
        body: [
          JSON.stringify({ type: 'progress', step: 'setup', status: 'done', ms: 5 }),
          JSON.stringify({ type: 'progress', step: 'client', status: 'done', ms: 10 }),
          JSON.stringify({ type: 'progress', step: 'organization', status: 'done', ms: 15 }),
          JSON.stringify({ type: 'progress', step: 'finalize', status: 'done', ms: 20 }),
          JSON.stringify({ type: 'result', success: true }),
          '',
        ].join('\n'),
      });
    });

    await page.route('**/sws/go/environments', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          environments: [{
            clientId: 'CLIENT_1',
            clientName: 'QA Mock Company',
            adminUserId: 'USER_1',
            adminUserName: 'QA Admin',
          }],
        }),
      });
    });

    await page.route('**/sws/go/login?userId=USER_1', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          token: 'env-token',
          roleList: [{
            id: 'ROLE_1',
            name: 'Admin',
            orgList: [{ id: 'ORG_1', name: 'QA Mock Org' }],
          }],
        }),
      });
    });

    await page.route('**/sws/neo/session', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ user: 'QA Admin' }),
      });
    });

    await page.route('**/sws/neo/sales-invoice/header/defaults', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ documentType: 'DOC_TYPE_1' }),
      });
    });

    await page.route('**/sws/neo/sales-invoice/header/selectors/C_PaymentTerm_ID**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [{ id: 'TERM_1', label: 'Immediate' }] }),
      });
    });

    await page.route('**/sws/neo/sales-invoice/header/selectors/C_BPartner_ID**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [{ id: 'BP_1', label: 'QA Customer' }] }),
      });
    });
  });

  test('registers, creates environment, verifies readiness, and redirects to dashboard', async ({ page }) => {
    const suffix = Date.now();
    await page.goto('/onboarding');

    await page.getByRole('textbox', { name: 'Nombre*' }).fill('QA Onboarding User');
    await page.getByRole('textbox', { name: 'Correo electrónico*' }).fill(`qa-onboarding-${suffix}@example.com`);
    await page.getByRole('textbox', { name: 'Contraseña*' }).fill('OnboardingQA2026!');
    await page.getByRole('button', { name: 'Crear cuenta' }).click();

    await expect(page.getByText(/Vamos a dejar todo listo/i)).toBeVisible();
    await page.getByRole('button', { name: /Continuar/ }).click();

    await page.getByRole('textbox', { name: 'Nombre de la empresa*' }).fill('QA Mock Company');
    await page.locator('#fiscalIdValue').fill('B12345678');
    await page.getByRole('textbox', { name: /Dirección/ }).fill('QA Street 123');

    await Promise.all([
      page.waitForURL('**/dashboard'),
      page.getByRole('button', { name: /Empezar/ }).click(),
    ]);

    await expect.poll(async () => page.evaluate(() => localStorage.getItem('sf_auth_token'))).toBe('env-token');
    await expect.poll(async () => page.evaluate(() => JSON.parse(localStorage.getItem('sf_auth_selected_org')).id)).toBe('ORG_1');
  });
});
```

- [ ] **Step 2: Run mocked integration test**

Run with the app shell dev server already running, or start it in a separate terminal:

```bash
cd tools/app-shell && npm run dev
```

Then run:

```bash
cd e2e && npx playwright test tests/flows/onboarding.mocked.spec.js --project=chromium
```

Expected: PASS. This test is safe by default because every `/sws/go/*` and `/sws/neo/*` endpoint used by the flow is mocked.

- [ ] **Step 3: Add one negative readiness integration test**

Append to `e2e/tests/flows/onboarding.mocked.spec.js`:

```js
test('shows readiness failure instead of redirecting when invoice defaults are invalid', async ({ page }) => {
  await page.route('**/sws/neo/sales-invoice/header/defaults', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ documentType: '0' }),
    });
  });

  const suffix = Date.now();
  await page.goto('/onboarding');

  await page.getByRole('textbox', { name: 'Nombre*' }).fill('QA Onboarding User');
  await page.getByRole('textbox', { name: 'Correo electrónico*' }).fill(`qa-onboarding-negative-${suffix}@example.com`);
  await page.getByRole('textbox', { name: 'Contraseña*' }).fill('OnboardingQA2026!');
  await page.getByRole('button', { name: 'Crear cuenta' }).click();

  await page.getByRole('button', { name: /Continuar/ }).click();
  await page.getByRole('textbox', { name: 'Nombre de la empresa*' }).fill('QA Mock Company');
  await page.locator('#fiscalIdValue').fill('B12345678');
  await page.getByRole('textbox', { name: /Dirección/ }).fill('QA Street 123');
  await page.getByRole('button', { name: /Empezar/ }).click();

  await expect(page.getByText(/todavía no está listo para facturar/i)).toBeVisible();
  await expect(page).not.toHaveURL(/dashboard/);
});
```

Expected: PASS after readiness failure UI is wired in Task 3.

---

## Task 5: Ensure repository baseline executes the new unit tests

**Files:**
- Modify: `Makefile`

- [ ] **Step 1: Modify `make test`**

Change `Makefile` test target to include onboarding page unit tests:

```make
test: ## Run all CLI tests and app-shell unit tests
	cd cli && node --test 'test/*.test.js'
	node --test tools/app-shell/src/lib/__tests__/*.test.js
	node --test tools/app-shell/src/pages/onboarding/__tests__/*.test.js
```

- [ ] **Step 2: Run focused baseline**

Run:

```bash
make test
```

Expected: PASS, including CLI tests, app-shell lib tests, and onboarding page unit tests.

- [ ] **Step 3: Run build**

Run:

```bash
npm run build --workspace=tools/app-shell
```

Expected: PASS.

---

## Task 6: Update delivery evidence docs

**Files:**
- Modify: `docs/qa/user-onboarding-runtime-qa-2026-04-24.md`
- Modify: `docs/plans/evaluations/onboarding-e2e-findings.md`

- [ ] **Step 1: Add Schema Forge-only test evidence**

Append a section to `docs/qa/user-onboarding-runtime-qa-2026-04-24.md`:

```md
## Schema Forge Automated Coverage Added

This repository now covers the Schema Forge onboarding frontend contract without mutating a real Etendo tenant:

- Unit tests for onboarding API request construction and NDJSON stream parsing.
- Unit tests for onboarding progress/state transitions and environment session storage.
- Unit tests for Sales Invoice readiness checks after environment login.
- Mocked Playwright integration test for register → create environment → login environment → readiness check → dashboard redirect.
- Mocked Playwright negative test that blocks dashboard redirect when invoice readiness is invalid.

These tests intentionally mock `/sws/go/*` and `/sws/neo/*` because the backend endpoints are state-changing and owned outside this repository.
```

- [ ] **Step 2: Add exact commands and expected results after running them**

Add:

```md
## Delivery Verification Commands

- `make test` — PASS
- `npm run build --workspace=tools/app-shell` — PASS
- `cd e2e && npx playwright test tests/flows/onboarding.mocked.spec.js --project=chromium` — PASS

## QA

- Pending validation by QA: Matías Bernal / Emilio Polliotti
```

Only write `PASS` after the command has been executed and observed.

- [ ] **Step 3: Update onboarding E2E findings**

In `docs/plans/evaluations/onboarding-e2e-findings.md`, add a short clarification:

```md
## Schema Forge Coverage Boundary

The mocked Schema Forge integration test proves the frontend onboarding contract and readiness gating. It does not prove Etendo Go creates the required seed data in a real tenant; that remains backend/runtime validation outside this repository.
```

---

## Verification checklist

Run these from repository root `/Users/sebastianbarrozo/Documents/work/epic/schema-forge` unless noted:

```bash
node --test tools/app-shell/src/pages/onboarding/__tests__/onboardingApi.test.js
node --test tools/app-shell/src/pages/onboarding/__tests__/onboardingState.test.js
node --test tools/app-shell/src/pages/onboarding/__tests__/onboardingReadiness.test.js
make test
npm run build --workspace=tools/app-shell
```

Run the mocked integration flow with the app-shell dev server available:

```bash
cd tools/app-shell && npm run dev
```

In another terminal:

```bash
cd e2e && npx playwright test tests/flows/onboarding.mocked.spec.js --project=chromium
```

Do not claim full real onboarding completion unless a separate state-changing runtime test is approved and executed:

```bash
cd e2e && RUN_ONBOARDING_E2E=1 npx playwright test tests/flows/onboarding-invoice-readiness.spec.js --project=chromium
```

## Self-review

Spec coverage:

- Unit tests for modified frontend API behavior: Task 1.
- Unit tests for progress/state/session behavior: Task 2.
- Unit tests for invoice readiness contract: Task 3.
- Integration with mocks: Task 4.
- Repository baseline includes new tests: Task 5.
- Delivery evidence and QA pending line: Task 6.

Intentional gap:

- Real backend onboarding seed correctness is not covered here because the user limited scope to Schema Forge. That must be validated in the backend/runtime repository or by an approved state-changing E2E run.
