import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(__dirname, '..', 'AssetsDetailPanel.jsx'), 'utf8');

describe('AssetsDetailPanel — props and structure', () => {
  it('accepts data, token, apiBaseUrl, catalogs, api, editing, onChange props', () => {
    assert.match(src, /data/);
    assert.match(src, /token/);
    assert.match(src, /apiBaseUrl/);
    assert.match(src, /catalogs/);
    assert.match(src, /editing/);
    assert.match(src, /onChange/);
  });

  it('uses EntityForm for field rendering', () => {
    assert.match(src, /EntityForm/);
    assert.match(src, /from '@\/components\/contract-ui'/);
  });

  it('uses useUI for translations', () => {
    assert.match(src, /useUI/);
    assert.match(src, /from '@\/i18n'/);
  });

  it('registers pre-filled currency for new records via useEffect', () => {
    assert.match(src, /useEffect/);
    assert.match(src, /onChange\?\.\('currency', d\.currency\)/);
  });
});

describe('AssetsDetailPanel — 4 form groups', () => {
  it('renders Group 1: Asset Info with assetsGroupInfoTitle', () => {
    assert.match(src, /assetsGroupInfoTitle/);
  });

  it('renders Group 2: Financial Info with assetsGroupFinancialTitle', () => {
    assert.match(src, /assetsGroupFinancialTitle/);
  });

  it('renders Group 3: Depreciation Config with assetsGroupDepreciationTitle', () => {
    assert.match(src, /assetsGroupDepreciationTitle/);
  });

  it('renders Group 4: Dates with assetsGroupDatesTitle', () => {
    assert.match(src, /assetsGroupDatesTitle/);
  });

  it('separates groups with GroupDivider (border-t)', () => {
    assert.match(src, /GroupDivider/);
    assert.match(src, /border-t/);
  });
});

describe('AssetsDetailPanel — depreciation conditional logic', () => {
  it('detects depreciate flag from both boolean true and Y string', () => {
    assert.match(src, /depreciate.*===.*true/);
    assert.match(src, /depreciate.*===.*'Y'/);
  });

  it('ToggleCard for depreciate field is always rendered', () => {
    assert.match(src, /ToggleCard/);
    assert.match(src, /fieldKey="depreciate"/);
  });

  it('depreciation fields only render when depreciate is true', () => {
    assert.match(src, /depreciate.*&&/);
    assert.match(src, /deprecFields/);
  });

  it('date fields only render when depreciate is true', () => {
    assert.match(src, /depreciate.*&&/);
    assert.match(src, /dateFields/);
  });

  it('shows disabled hint text when depreciate is false', () => {
    assert.match(src, /assetsDepreciationDisabledHint/);
  });
});

describe('AssetsDetailPanel — field definitions', () => {
  it('defines group1 fields: searchKey, name, assetCategory, description', () => {
    assert.match(src, /'searchKey'/);
    assert.match(src, /'name'/);
    assert.match(src, /'assetCategory'/);
    assert.match(src, /'description'/);
  });

  it('defines group2 fields: currency, assetValue, residualAssetValue, depreciationAmt', () => {
    assert.match(src, /'currency'/);
    assert.match(src, /'assetValue'/);
    assert.match(src, /'residualAssetValue'/);
    assert.match(src, /'depreciationAmt'/);
  });

  it('currency field has readOnlyLogic when amortization lines exist', () => {
    assert.match(src, /depreciatedPlan/);
    assert.match(src, /depreciatedValue/);
    assert.match(src, /readOnlyLogic/);
  });
});

describe('AssetsDetailPanel — visual style', () => {
  it('applies white background with white input/textarea overrides', () => {
    assert.match(src, /bg-white/);
    assert.match(src, /\[&_input\]:bg-white/);
    assert.match(src, /\[&_textarea\]:bg-white/);
  });

  it('applies p-2 padding to root container', () => {
    assert.match(src, /p-2/);
  });
});
