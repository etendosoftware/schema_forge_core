// Tests that secondaryTabs.<key>.excludeFields is emitted on the generated tab
// descriptor as `excludeFields: [...]`, and ONLY when the tab declares it.
//
// This is the generator half of ETP-4708 / L2 in the contract-ui churn report: the
// generic DetailView used to hardcode `props.st.key === "contact" ? ["active"] : []`
// in its secondary detail sidebar. The window now declares which fields its tab
// form hides, and the generic component just reads `props.st.excludeFields ?? []`.
//
// R3 (sparse decisions) is what the control cases below guard: the default is []
// (hide nothing), so a tab that does not declare excludeFields must produce a
// byte-identical descriptor to before this feature existed.
//
// Runtime consumption of the emitted prop (EntityForm filtering the fields out) is
// covered by the app-shell suite (EntityForm excludeFields tests).

import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { generatePageComponent } from '../src/generate-frontend.js';

// Minimal contract: header entity + one table-form secondary tab whose detail form
// should hide the `active` flag.
function buildContract() {
  return {
    frontendContract: {
      window: {
        id: '901',
        name: 'Contacts',
        primaryEntity: 'businessPartner',
        category: 'master',
        secondaryTabs: {
          contact: {
            label: 'Person',
            tabOrder: 1,
            excludeFields: ['active'],
          },
        },
      },
      entities: {
        businessPartner: {
          fields: [
            {
              name: 'name', column: 'Name',
              type: 'string', tsType: 'string',
              visibility: 'editable', required: true, grid: true, form: true,
            },
          ],
          searchableFields: ['name'],
          computedFields: [],
        },
        contact: {
          fields: [
            {
              name: 'firstName', column: 'Firstname',
              type: 'string', tsType: 'string',
              visibility: 'editable', required: true, grid: true, form: true, label: 'First Name',
            },
            {
              name: 'active', column: 'IsActive',
              type: 'boolean', tsType: 'boolean',
              visibility: 'editable', required: false, grid: true, form: true, label: 'Active',
            },
          ],
          searchableFields: [],
          computedFields: [],
        },
      },
    },
    backendContract: { processEndpoints: [] },
  };
}

/** The generated descriptor object for the `contact` secondary tab. */
function contactTabEntry(code) {
  return code.match(/\{\s*key:\s*'contact'[^}]*\}/s);
}

describe('secondaryTabs.excludeFields — emitted tab descriptor', () => {
  it('emits excludeFields on the declaring tab', () => {
    const code = generatePageComponent('businessPartner', null, buildContract());
    assert.match(
      code,
      /key:\s*'contact'[^}]*excludeFields:\s*\["active"\]/s,
      'expected the contact tab descriptor to carry excludeFields: ["active"]',
    );
  });

  it('does NOT emit excludeFields when the tab does not declare it (R3 default)', () => {
    const contract = buildContract();
    delete contract.frontendContract.window.secondaryTabs.contact.excludeFields;
    const code = generatePageComponent('businessPartner', null, contract);
    const entry = contactTabEntry(code);
    assert.ok(entry, 'expected the contact tab descriptor to still be emitted');
    assert.ok(
      !entry[0].includes('excludeFields'),
      'a tab on the default must not carry excludeFields',
    );
    assert.ok(!/excludeFields/.test(code), 'no excludeFields anywhere without the declaration');
  });

  it('does NOT emit excludeFields for an explicitly empty array (default in disguise)', () => {
    const contract = buildContract();
    contract.frontendContract.window.secondaryTabs.contact.excludeFields = [];
    const code = generatePageComponent('businessPartner', null, contract);
    assert.ok(
      !/excludeFields/.test(code),
      'an empty array is the default and must not be emitted (arrays are truthy — needs a length gate)',
    );
  });

  it('emits every declared field, preserving order', () => {
    const contract = buildContract();
    contract.frontendContract.window.secondaryTabs.contact.excludeFields = ['active', 'firstName'];
    const code = generatePageComponent('businessPartner', null, contract);
    assert.match(code, /excludeFields:\s*\["active","firstName"\]/);
  });

  it('emits field keys verbatim, not their columns', () => {
    const code = generatePageComponent('businessPartner', null, buildContract());
    // EntityForm filters on `f.key`, so emitting the AD column would silently no-op.
    assert.match(code, /excludeFields:\s*\["active"\]/);
    assert.doesNotMatch(code, /excludeFields:\s*\["IsActive"\]/);
  });
});
