// Tests that a tab can DECLARE its icon instead of the generic DetailView keeping a
// hardcoded key->component table (TAB_ICONS, keyed by 'custom:sif' / 'custom:pricing' /
// 'custom:attachments').
//
// This is the generator half of ETP-4708 / T10-T13 in the contract-ui churn report.
//
// IMPORTANT — the emitted value is a LOGICAL name ('shield', 'pricing', 'attachment'),
// NOT an icon-library export name. The report's own wording says "mapa lucide", but the
// app is mid-migration off lucide: SideMenu.jsx imports from BOTH lucide-react and
// @phosphor-icons/react and its ICON_MAP is a lucide->Phosphor compatibility shim.
// decisions.json is a contract that regenerates into every window, so baking library
// names into it would make finishing that migration a mass rewrite + full regen. With
// logical names it stays a change in one resolver file. Approved as an override of the
// report's letter; see the T12 row.
//
// R3 (sparse decisions) is what the control cases guard: no icon declared means nothing
// emitted, so every existing tab regenerates byte-identical and the shared component
// keeps its current `?? List` default.
//
// Runtime resolution (logical name -> component, List fallback) is covered by the
// app-shell suite.

import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { generatePageComponent } from '../src/generate-frontend.js';

function buildContract(windowExtra = {}) {
  return {
    frontendContract: {
      window: {
        id: '903',
        name: 'Sales Invoice',
        primaryEntity: 'invoice',
        category: 'transaction',
        ...windowExtra,
      },
      entities: {
        invoice: {
          // AttachmentsTab is disabled without a tableName on the header entity.
          tableName: 'C_Invoice',
          fields: [
            {
              name: 'documentNo', column: 'DocumentNo',
              type: 'string', tsType: 'string',
              visibility: 'editable', required: true, grid: true, form: true,
            },
          ],
          searchableFields: ['documentNo'],
          computedFields: [],
        },
      },
    },
    backendContract: { processEndpoints: [] },
  };
}

/** The generated descriptor object for a given tab key. */
function tabEntry(code, key) {
  return code.match(new RegExp(`\\{\\s*key:\\s*'${key}'[^}]*\\}`, 's'));
}

describe('extraTabs[].icon — the SIF case that motivates T10-T13', () => {
  const sifTab = (icon) => ({
    extraTabs: [{ key: 'sif', labelKey: 'sifDataTabs.sectionTitle', component: 'SifTab', ...(icon ? { icon } : {}) }],
  });

  it('emits a declared icon on the extraTabs descriptor', () => {
    const code = generatePageComponent('invoice', null, buildContract(sifTab('shield')));
    assert.match(code, /key:\s*'sif'[^}]*icon:\s*'shield'/s);
  });

  it('does NOT emit icon when the tab does not declare one (R3 default)', () => {
    const code = generatePageComponent('invoice', null, buildContract(sifTab()));
    const entry = tabEntry(code, 'sif');
    assert.ok(entry, 'expected the sif tab descriptor to still be emitted');
    assert.ok(!entry[0].includes('icon'), 'a tab on the default must not carry icon');
  });
});

describe('customPanelTabs[].icon — the pricing case', () => {
  const pricingTab = (icon) => ({
    customPanelTabs: [{ key: 'pricing', labelKey: 'price', component: 'ProductPriceBar', ...(icon ? { icon } : {}) }],
  });

  it('emits a declared icon on the customPanelTabs descriptor', () => {
    const code = generatePageComponent('invoice', null, buildContract(pricingTab('pricing')));
    assert.match(code, /key:\s*'pricing'[^}]*icon:\s*'pricing'/s);
  });

  it('does NOT emit icon when undeclared (R3 default)', () => {
    const code = generatePageComponent('invoice', null, buildContract(pricingTab()));
    const entry = tabEntry(code, 'pricing');
    assert.ok(entry, 'expected the pricing tab descriptor to still be emitted');
    assert.ok(!entry[0].includes('icon'), 'a tab on the default must not carry icon');
  });
});

describe('attachments tab icon', () => {
  it('emits a declared icon on the generator-owned attachments descriptor', () => {
    const code = generatePageComponent('invoice', null, buildContract({
      attachments: { enabled: true, icon: 'attachment' },
    }));
    assert.match(code, /key:\s*'attachments'[^}]*icon:\s*'attachment'/s);
  });

  it('does NOT emit icon when the window enables attachments without one', () => {
    const code = generatePageComponent('invoice', null, buildContract({
      attachments: { enabled: true },
    }));
    const entry = tabEntry(code, 'attachments');
    assert.ok(entry, 'expected the attachments tab descriptor to still be emitted');
    assert.ok(!entry[0].includes('icon:'), 'attachments on the default must not carry icon');
  });

  it('keeps the icon on the descriptor, not inside the forwarded props.config', () => {
    // `config` is handed to AttachmentsTab as props; the icon is read by the tab strip.
    // Emitting it inside config would silently never reach the renderer.
    const code = generatePageComponent('invoice', null, buildContract({
      attachments: { enabled: true, icon: 'attachment' },
    }));
    const entry = tabEntry(code, 'attachments');
    assert.ok(/icon:\s*'attachment',\s*props:/.test(entry[0]), 'icon must precede props on the descriptor');
  });
});

describe('tab.icon — R3 byte-identical control', () => {
  it('a window whose tabs declare no icon produces byte-identical output', () => {
    const withTabs = {
      extraTabs: [{ key: 'sif', labelKey: 'sifDataTabs.sectionTitle', component: 'SifTab' }],
      customPanelTabs: [{ key: 'pricing', labelKey: 'price', component: 'ProductPriceBar' }],
    };
    const before = generatePageComponent('invoice', null, buildContract(withTabs));
    // Same config, but with an explicitly undefined icon on each tab — the shape a
    // window would have if the field existed but was left unset.
    const after = generatePageComponent('invoice', null, buildContract({
      extraTabs: [{ ...withTabs.extraTabs[0], icon: undefined }],
      customPanelTabs: [{ ...withTabs.customPanelTabs[0], icon: undefined }],
    }));
    assert.equal(before, after, 'an unset icon must not change a single byte');
  });

  it('emits the logical name verbatim, without translating it to a library export', () => {
    const code = generatePageComponent('invoice', null, buildContract({
      extraTabs: [{ key: 'sif', labelKey: 'x', component: 'SifTab', icon: 'warehouse-products' }],
    }));
    // Kebab-case logical names must survive untouched — the resolver owns the mapping.
    assert.match(code, /icon:\s*'warehouse-products'/);
  });
});
