#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

export const ENVIRONMENTS = {
  staging: { name: 'staging', origin: 'https://go.staging.etendo.cloud' },
  experimental: { name: 'experimental', origin: 'https://go.experimental.etendo.cloud' },
};

const PROCESS_ID = 'B0985AF0989E40A7B664917C0EA203BE';
const PROCESS_ACTION = 'com.etendoerp.sequences.SequencesGenerator';
const DEFAULT_ORGANIZATION_ENTITY = 'Organization';
const DEFAULT_PAGE_SIZE = 10000;
const ORGANIZATION_ENTITY_ALIASES = new Map([
  ['adorg', DEFAULT_ORGANIZATION_ENTITY],
  ['ad_org', DEFAULT_ORGANIZATION_ENTITY],
  ['ad_org_id', DEFAULT_ORGANIZATION_ENTITY],
  ['organization', DEFAULT_ORGANIZATION_ENTITY],
]);

export function normalizeOrganizationEntity(value) {
  const raw = String(value || DEFAULT_ORGANIZATION_ENTITY).trim();
  return ORGANIZATION_ENTITY_ALIASES.get(raw.toLowerCase()) || raw;
}

export function normalizeEtendoBaseUrl(value) {
  const trimmed = String(value || '').trim().replace(/\/+$/, '');
  if (!trimmed) throw new Error('Missing base URL');
  return trimmed.endsWith('/etendo') ? trimmed : `${trimmed}/etendo`;
}

export function buildProcessUrl(baseUrl) {
  const normalized = normalizeEtendoBaseUrl(baseUrl);
  return `${normalized}/org.openbravo.client.kernel?processId=${PROCESS_ID}&reportId=null&windowId=null&_action=${PROCESS_ACTION}`;
}

export function buildContextSwitchUrl(baseUrl) {
  const normalized = normalizeEtendoBaseUrl(baseUrl);
  return `${normalized}/org.openbravo.client.kernel?command=save&_action=org.openbravo.client.application.navigationbarcomponents.UserInfoWidgetActionHandler`;
}

function buildSessionDynamicUrl(baseUrl) {
  return `${normalizeEtendoBaseUrl(baseUrl)}/org.openbravo.client.kernel/OBCLKER_Kernel/SessionDynamic`;
}

function usage() {
  return `Usage: scripts/run-sequence-generator-cloud.mjs [options]

Runs the Etendo Create Sequences process for every non-system organization in the selected cloud environments.
Dry-run is the default; pass --execute to perform writes.

Options:
  --env <all|staging|experimental>  Environment to target. Repeatable. Default: all.
  --execute                         Actually call the process. Without this, only prints planned calls.
  --clients-file <path>             Use a JSON file with organizations instead of remote discovery.
  --organization-entity <name>      JSON REST entity for AD_Org. Default: Organization.
  --user <username>                 Etendo username for every selected environment.
  --password <password>             Etendo password for every selected environment.
  --debug                           Print safe request/response details when a remote call fails.
  --help                            Show this help.

Credentials default to admin/admin. They can be overridden with environment variables:
  ETENDO_CLOUD_USER / ETENDO_CLOUD_PASSWORD
  ETENDO_STAGING_USER / ETENDO_STAGING_PASSWORD
  ETENDO_EXPERIMENTAL_USER / ETENDO_EXPERIMENTAL_PASSWORD

Clients file format:
  [
    { "environment": "staging", "orgId": "...", "orgName": "...", "clientId": "..." },
    { "environment": "experimental", "id": "...", "name": "...", "client": { "id": "..." } }
  ]
`;
}

export function parseArgs(argv) {
  const options = {
    envs: [],
    execute: false,
    clientsFile: null,
    organizationEntity: DEFAULT_ORGANIZATION_ENTITY,
    user: null,
    password: null,
    help: false,
    debug: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--execute') {
      options.execute = true;
    } else if (arg === '--debug') {
      options.debug = true;
    } else if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg === '--env') {
      const value = argv[++i];
      if (!value) throw new Error('--env requires a value');
      options.envs.push(value);
    } else if (arg === '--clients-file') {
      options.clientsFile = argv[++i];
      if (!options.clientsFile) throw new Error('--clients-file requires a value');
    } else if (arg === '--organization-entity') {
      options.organizationEntity = argv[++i];
      if (!options.organizationEntity) throw new Error('--organization-entity requires a value');
    } else if (arg === '--user') {
      options.user = argv[++i];
      if (!options.user) throw new Error('--user requires a value');
    } else if (arg === '--password') {
      options.password = argv[++i];
      if (!options.password) throw new Error('--password requires a value');
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (options.envs.length === 0) options.envs = ['all'];
  return options;
}

export function selectTargets(options) {
  const requested = new Set(options.envs.includes('all') ? Object.keys(ENVIRONMENTS) : options.envs);
  const unknown = [...requested].filter(name => !ENVIRONMENTS[name]);
  if (unknown.length) throw new Error(`Unknown environment(s): ${unknown.join(', ')}`);
  return [...requested].map(name => ({ ...ENVIRONMENTS[name], baseUrl: normalizeEtendoBaseUrl(ENVIRONMENTS[name].origin) }));
}

function envKey(name) {
  return name.toUpperCase().replace(/[^A-Z0-9]/g, '_');
}

export function credentialsFor(target, options, env = process.env) {
  const key = envKey(target.name);
  const user = options.user || env[`ETENDO_${key}_USER`] || env.ETENDO_CLOUD_USER || 'admin';
  const password = options.password || env[`ETENDO_${key}_PASSWORD`] || env.ETENDO_CLOUD_PASSWORD || 'admin';
  return { user, password };
}

export function buildBasicAuthHeader(user, password) {
  return `Basic ${Buffer.from(`${user}:${password}`, 'utf8').toString('base64')}`;
}

function getSetCookies(headers) {
  if (typeof headers.getSetCookie === 'function') return headers.getSetCookie();
  const single = headers.get('set-cookie');
  return single ? [single] : [];
}

function cookieHeaderFromSetCookie(setCookies) {
  return setCookies
    .map(cookie => cookie.split(';')[0])
    .filter(Boolean)
    .join('; ');
}

function safeHeaders(headers) {
  const result = {};
  for (const [key, value] of headers.entries()) {
    const lower = key.toLowerCase();
    result[key] = lower === 'set-cookie' || lower === 'authorization' || lower === 'cookie'
      ? '[redacted]'
      : value;
  }
  return result;
}

function debugFailure(options, context, response, text) {
  if (!options.debug) return;
  console.error(`\n[debug] ${context}`);
  console.error(`[debug] status: ${response.status} ${response.statusText}`);
  console.error(`[debug] url: ${response.url || '(unavailable)'}`);
  console.error(`[debug] headers: ${JSON.stringify(safeHeaders(response.headers), null, 2)}`);
  console.error(`[debug] body: ${text.slice(0, 2000) || '(empty)'}`);
}

async function readJson(response, context, options = {}) {
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    debugFailure(options, context, response, text);
    throw new Error(`${context} returned non-JSON response (${response.status}): ${text.slice(0, 300)}`);
  }
  if (!response.ok || data?.status === 'error' || data?.response?.status === -1 || data?.response?.error) {
    debugFailure(options, context, response, text);
    const message = data?.message || data?.error?.message || data?.response?.error?.message || text.slice(0, 300);
    throw new Error(`${context} failed (${response.status}): ${message}`);
  }
  return data;

}
export function isAcceptedContextSwitchResponse(text) {
  const trimmed = String(text || '').trim();
  if (trimmed.startsWith('window.location.href')) return true;
  try {
    JSON.parse(trimmed);
    return true;
  } catch {
    return false;
  }
}

async function login(target, options) {
  const { user, password } = credentialsFor(target, options);
  const response = await fetch(`${target.baseUrl}/sws/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: user, password }),
  });
  const cookies = cookieHeaderFromSetCookie(getSetCookies(response.headers));
  const data = await readJson(response, `${target.name} login`, options);
  if (!data.token) throw new Error(`${target.name} login did not return a token`);
  if (!cookies) throw new Error(`${target.name} login did not return a session cookie`);
  return { token: data.token, cookies };
}

function extractRows(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.response?.data)) return payload.response.data;
  if (Array.isArray(payload?.response?.items)) return payload.response.items;
  if (Array.isArray(payload?.items)) return payload.items;
  throw new Error('Could not find a row array in JSON REST response');
}

function readId(value) {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'object') return value.id || value.value || null;
  return null;
}

function normalizeOrganization(row) {
  const id = row.orgId ?? row.adOrgId ?? row.id ?? row.AD_Org_ID ?? row.organizationId;
  const clientId = row.clientId ?? row.adClientId ?? row.AD_Client_ID ?? readId(row.client) ?? readId(row.client$_identifier);
  const searchKey = row.searchKey ?? row.value ?? row.searchkey ?? row.Value ?? '';
  const name = row.orgName ?? row.name ?? row.identifier ?? row._identifier ?? row.Name ?? '';
  return { id, name, searchKey, clientId };
}

export function selectRunnableOrganizations(rows) {
  return rows.map(normalizeOrganization);
}

function extractAssignedObjectLiteral(script, marker) {
  const markerIndex = script.indexOf(marker);
  if (markerIndex === -1) throw new Error(`Missing marker in SessionDynamic: ${marker}`);
  const start = script.indexOf('{', markerIndex);
  if (start === -1) throw new Error(`Missing object literal after marker: ${marker}`);

  let depth = 0;
  let quote = null;
  let escaped = false;
  for (let i = start; i < script.length; i += 1) {
    const char = script[i];
    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === quote) {
        quote = null;
      }
      continue;
    }
    if (char === '\'' || char === '"' || char === '`') {
      quote = char;
      continue;
    }
    if (char === '{') depth += 1;
    if (char === '}') {
      depth -= 1;
      if (depth === 0) return script.slice(start, i + 1);
    }
  }
  throw new Error(`Unterminated object literal after marker: ${marker}`);
}

function firstWarehouseId(role, orgId) {
  const entry = (role.warehouseOrgMap || []).find(item => item.orgId === orgId);
  const first = entry?.warehouseMap?.[0];
  return first?.id || null;
}

export function parseSessionDynamicOrganizations(script) {
  const literal = extractAssignedObjectLiteral(script, 'OB.User.userInfo');
  const sandbox = { OB: { User: {} } };
  vm.runInNewContext(
    `Array.prototype.sortByProperty = function () { return this; }; OB.User.userInfo = ${literal};`,
    sandbox,
    { timeout: 1000 }
  );

  const roleNames = new Map((sandbox.OB.User.userInfo?.role?.valueMap || []).map(role => [role.id, role._identifier || '']));
  const roles = sandbox.OB.User.userInfo?.role?.roles || [];
  const organizationsById = new Map();
  for (const role of roles) {
    const roleName = roleNames.get(role.id) || '';
    for (const org of role.organizationValueMap || []) {
      if (org.id === '0' || org._identifier === '*') continue;
      const candidate = {
        id: org.id,
        name: org._identifier || org.name || org.id,
        searchKey: '',
        clientId: null,
        clientName: role.client || null,
        roleId: role.id,
        roleName,
        warehouseId: firstWarehouseId(role, org.id),
      };
      const existing = organizationsById.get(candidate.id);
      if (!existing || (!/admin/i.test(existing.roleName) && /admin/i.test(candidate.roleName))) {
        organizationsById.set(candidate.id, candidate);
      }
    }
  }
  return [...organizationsById.values()];
}

export function buildOrganizationDiscoveryUrl(baseUrl, organizationEntity) {
  const entityName = normalizeOrganizationEntity(organizationEntity);
  const url = new URL(`${normalizeEtendoBaseUrl(baseUrl)}/org.openbravo.service.json.jsonrest/${entityName}`);
  url.searchParams.set('_sortBy', 'name');
  url.searchParams.set('_startRow', '0');
  url.searchParams.set('_endRow', String(DEFAULT_PAGE_SIZE));
  return url;
}

async function fetchText(response, context, options = {}) {
  const text = await response.text();
  if (!response.ok) {
    debugFailure(options, context, response, text);
    throw new Error(`${context} failed (${response.status}): ${text.slice(0, 300)}`);
  }
  return text;
}

async function discoverOrganizations(target, session) {
  const { user, password } = credentialsFor(target, target.options || {});
  const response = await fetch(buildSessionDynamicUrl(target.baseUrl), {
    headers: {
      Authorization: buildBasicAuthHeader(user, password),
      Cookie: session.cookies,
      Accept: '*/*',
    },
  });
  const script = await fetchText(response, `${target.name} SessionDynamic`, target.options || {});
  return parseSessionDynamicOrganizations(script);
}

async function loadOrganizationsFromFile(path, targetName) {
  const raw = await readFile(path, 'utf8');
  const parsed = JSON.parse(raw);
  const rows = Array.isArray(parsed) ? parsed : parsed.organizations;
  if (!Array.isArray(rows)) throw new Error('clients file must be an array or { "organizations": [...] }');
  return selectRunnableOrganizations(rows.filter(row => !row.environment || row.environment === targetName));
}

async function switchContext(target, session, org) {
  if (!org.roleId || !org.clientName) {
    throw new Error(`Missing role/client context for organization ${org.name || org.id}`);
  }
  const response = await fetch(buildContextSwitchUrl(target.baseUrl), {
    method: 'POST',
    headers: {
      Accept: '*/*',
      'Content-Type': 'application/json;charset=UTF-8',
      Cookie: session.cookies,
      Origin: target.origin,
      Referer: `${target.baseUrl}/`,
    },
    body: JSON.stringify({
      language: '192',
      role: org.roleId,
      client: org.clientName,
      organization: org.id,
      warehouse: org.warehouseId || '',
      default: false,
    }),
  });
  const text = await fetchText(response, `${target.name} context switch for ${org.name || org.id}`, target.options || {});
  if (!isAcceptedContextSwitchResponse(text)) {
    throw new Error(`${target.name} context switch for ${org.name || org.id} returned unexpected response: ${text.slice(0, 300)}`);
  }
}

async function runSequenceProcess(target, session, org) {
  const response = await fetch(buildProcessUrl(target.baseUrl), {
    method: 'POST',
    headers: {
      Accept: '*/*',
      'Content-Type': 'application/json;charset=UTF-8',
      Authorization: `Bearer ${session.token}`,
      Cookie: session.cookies,
      Origin: target.origin,
      Referer: `${target.baseUrl}/`,
    },
    body: JSON.stringify({
      _buttonValue: 'DONE',
      _params: { ad_org_id: org.id },
    }),
  });
  return readJson(response, `${target.name} sequence generation for ${org.name || org.id}`, target.options || {});
}

async function runTarget(target, options) {
  console.log(`\n[${target.name}] ${target.origin}`);
  const targetWithOptions = { ...target, options };
  const session = await login(targetWithOptions, options);
  const organizations = options.clientsFile
    ? await loadOrganizationsFromFile(options.clientsFile, target.name)
    : await discoverOrganizations(targetWithOptions, session);

  if (organizations.length === 0) {
    console.log(`[${target.name}] No runnable organizations found.`);
    return { planned: 0, executed: 0, failed: 0 };
  }

  console.log(`[${target.name}] Organizations: ${organizations.length}`);
  let executed = 0;
  let failed = 0;

  for (const org of organizations) {
    const label = `${org.name || org.id} (${org.id})${org.roleName ? ` via ${org.roleName}` : ''}`;
    if (!options.execute) {
      console.log(`[dry-run] ${target.name}: would run sequence generator for ${label}`);
      continue;
    }
    try {
      await switchContext(targetWithOptions, session, org);
      await runSequenceProcess(targetWithOptions, session, org);
      executed += 1;
      console.log(`[ok] ${target.name}: generated sequences for ${label}`);
    } catch (error) {
      failed += 1;
      console.error(`[error] ${target.name}: ${label}: ${error.message}`);
    }
  }

  return { planned: organizations.length, executed, failed };
}

async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  if (options.help) {
    console.log(usage());
    return;
  }

  if (!options.execute) {
    console.log('Dry-run mode. Pass --execute to perform writes.');
  }

  const targets = selectTargets(options);
  const totals = { planned: 0, executed: 0, failed: 0 };
  for (const target of targets) {
    const result = await runTarget(target, options);
    totals.planned += result.planned;
    totals.executed += result.executed;
    totals.failed += result.failed;
  }

  console.log(`\nSummary: planned=${totals.planned}, executed=${totals.executed}, failed=${totals.failed}`);
  if (totals.failed > 0) process.exitCode = 1;
}

const invokedPath = process.argv[1] ? fileURLToPath(import.meta.url) === process.argv[1] : false;
if (invokedPath) {
  main().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
