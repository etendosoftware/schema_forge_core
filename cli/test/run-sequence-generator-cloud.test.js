import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  ENVIRONMENTS,
  buildProcessUrl,
  buildBasicAuthHeader,
  buildOrganizationDiscoveryUrl,
  buildContextSwitchUrl,
  normalizeOrganizationEntity,
  normalizeEtendoBaseUrl,
  parseArgs,
  selectTargets,
  parseSessionDynamicOrganizations,
  selectRunnableOrganizations,
  credentialsFor,
  isAcceptedContextSwitchResponse,
} from '../../scripts/run-sequence-generator-cloud.mjs';

describe('run-sequence-generator-cloud helpers', () => {
  it('normalizes go origins to the Etendo context URL', () => {
    assert.equal(
      normalizeEtendoBaseUrl('https://go.experimental.etendo.cloud'),
      'https://go.experimental.etendo.cloud/etendo'
    );
    assert.equal(
      normalizeEtendoBaseUrl('https://go.staging.etendo.cloud/etendo/'),
      'https://go.staging.etendo.cloud/etendo'
    );
  });

  it('builds the classic sequence generator process URL', () => {
    assert.equal(
      buildProcessUrl('https://go.experimental.etendo.cloud/etendo'),
      'https://go.experimental.etendo.cloud/etendo/org.openbravo.client.kernel?processId=B0985AF0989E40A7B664917C0EA203BE&reportId=null&windowId=null&_action=com.etendoerp.sequences.SequencesGenerator'
    );
  });

  it('defaults to staging and experimental in dry-run mode', () => {
    const options = parseArgs([]);

    assert.equal(options.execute, false);
    assert.deepEqual(selectTargets(options).map(target => target.name), ['staging', 'experimental']);
    assert.equal(ENVIRONMENTS.experimental.origin, 'https://go.experimental.etendo.cloud');
  });

  it('uses admin/admin as the default cloud credentials', () => {
    const credentials = credentialsFor({ name: 'staging' }, parseArgs([]), {});

    assert.deepEqual(credentials, { user: 'admin', password: 'admin' });
  });

  it('parses debug mode for failed remote inspection', () => {
    const options = parseArgs(['--debug']);

    assert.equal(options.debug, true);
  });


  it('builds Basic auth for JSON REST discovery', () => {
    assert.equal(buildBasicAuthHeader('admin', 'admin'), 'Basic YWRtaW46YWRtaW4=');
  });

  it('maps ADOrg to the JSON REST Organization entity', () => {
    assert.equal(normalizeOrganizationEntity('ADOrg'), 'Organization');
  });
  it('keeps every organization returned by JSON REST without local filtering', () => {
    const organizations = selectRunnableOrganizations([
      { id: '0', name: 'System', searchKey: '0', clientId: '0' },
      { id: 'STAR', name: '*', searchKey: '*', clientId: 'CLIENT_1' },
      { id: 'ORG_1', name: 'Acme', searchKey: 'ACME', clientId: 'CLIENT_1' },
      { id: 'ORG_2', name: 'Beta', value: 'BETA', client: { id: 'CLIENT_2' } },
      { id: '', name: 'Broken', searchKey: 'BROKEN', clientId: 'CLIENT_3' },
    ]);

    assert.deepEqual(organizations, [
      { id: '0', name: 'System', searchKey: '0', clientId: '0' },
      { id: 'STAR', name: '*', searchKey: '*', clientId: 'CLIENT_1' },
      { id: 'ORG_1', name: 'Acme', searchKey: 'ACME', clientId: 'CLIENT_1' },
      { id: 'ORG_2', name: 'Beta', searchKey: 'BETA', clientId: 'CLIENT_2' },
      { id: '', name: 'Broken', searchKey: 'BROKEN', clientId: 'CLIENT_3' },
    ]);
  });

  it('builds organization discovery URL without server-side filters', () => {
    const url = buildOrganizationDiscoveryUrl('https://go.staging.etendo.cloud/etendo', 'ADOrg');

    assert.equal(url.searchParams.has('_where'), false);
    assert.equal(url.searchParams.get('_sortBy'), 'name');
    assert.equal(url.pathname, '/etendo/org.openbravo.service.json.jsonrest/Organization');
  });

  it('builds the classic context switch URL', () => {
    assert.equal(
      buildContextSwitchUrl('https://go.staging.etendo.cloud/etendo'),
      'https://go.staging.etendo.cloud/etendo/org.openbravo.client.kernel?command=save&_action=org.openbravo.client.application.navigationbarcomponents.UserInfoWidgetActionHandler'
    );
  });


  it('accepts the JavaScript redirect returned by context switch', () => {
    assert.equal(isAcceptedContextSwitchResponse("window.location.href = 'https://go.staging.etendo.cloud/etendo/';"), true);
    assert.equal(isAcceptedContextSwitchResponse('{"responseActions":[]}'), true);
    assert.equal(isAcceptedContextSwitchResponse('not accepted'), false);
  });
  it('extracts organizations across SessionDynamic roles with execution context', () => {
    const script = `
      OB.User.userInfo = {
        role: {
          valueMap: [
            { id: 'ROLE_A', _identifier: 'Client A Sales - Client A' },
            { id: 'ROLE_ADMIN', _identifier: 'Client A Admin - Client A' },
            { id: 'ROLE_B', _identifier: 'Client B Admin - Client B' }
          ],
          roles: [
            {
              id: 'ROLE_A',
              client: 'Client A',
              organizationValueMap: [
                { id: '0', _identifier: '*' },
                { id: 'ORG_A', _identifier: 'Org A' }
              ].sortByProperty('_identifier', true),
              warehouseOrgMap: [
                { orgId: 'ORG_A', warehouseMap: [{ id: 'WH_A_SALES', _identifier: 'Warehouse A Sales' }] }
              ]
            },
            {
              id: 'ROLE_ADMIN',
              client: 'Client A',
              organizationValueMap: [
                { id: 'ORG_A', _identifier: 'Org A' }
              ].sortByProperty('_identifier', true),
              warehouseOrgMap: [
                { orgId: 'ORG_A', warehouseMap: [{ id: 'WH_A', _identifier: 'Warehouse A' }] }
              ]
            },
            {
              id: 'ROLE_B',
              client: 'Client B',
              organizationValueMap: [
                { id: 'ORG_B', _identifier: 'Org B' }
              ].sortByProperty('_identifier', true),
              warehouseOrgMap: []
            }
          ]
        }
      };
    `;

    assert.deepEqual(parseSessionDynamicOrganizations(script), [
      { id: 'ORG_A', name: 'Org A', searchKey: '', clientId: null, clientName: 'Client A', roleId: 'ROLE_ADMIN', roleName: 'Client A Admin - Client A', warehouseId: 'WH_A' },
      { id: 'ORG_B', name: 'Org B', searchKey: '', clientId: null, clientName: 'Client B', roleId: 'ROLE_B', roleName: 'Client B Admin - Client B', warehouseId: null },
    ]);
  });
});
