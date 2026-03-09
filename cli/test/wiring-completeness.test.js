import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..', '..');
const ARTIFACTS = resolve(ROOT, 'artifacts');
const APP_SHELL = resolve(ROOT, 'tools', 'app-shell', 'src');

// --- Helpers ---

function readText(filePath) {
  return readFileSync(filePath, 'utf-8');
}

// --- Load data ---

const menu = JSON.parse(readText(resolve(APP_SHELL, 'menu.json')));
const registrySource = readText(resolve(APP_SHELL, 'windows', 'registry.js'));
const appSource = readText(resolve(APP_SHELL, 'App.jsx'));

// All menu items flat
const allMenuItems = menu.menu.flatMap(g => g.items.map(i => i.name));

// Overview/aggregate pages: have their own route + React component in App.jsx
// Entity windows: loaded dynamically via WindowLoader + registry
const SPECIAL_PAGES = new Set([
  'dashboard', 'sales', 'purchases', 'accounting', 'inventory', 'contacts',
  'crm', 'hr', 'projects', 'reports', 'onboarding', 'smart-scan', 'preview',
]);

const entityWindows = allMenuItems.filter(name => !SPECIAL_PAGES.has(name));

// Artifact directories
const artifactDirs = readdirSync(ARTIFACTS, { withFileTypes: true })
  .filter(d => d.isDirectory())
  .map(d => d.name);

const entityArtifacts = artifactDirs.filter(d =>
  existsSync(resolve(ARTIFACTS, d, 'contract.json'))
);

const aggregateArtifacts = artifactDirs.filter(d =>
  existsSync(resolve(ARTIFACTS, d, 'aggregate-contract.json'))
);

// --- Tests ---

describe('Wiring completeness', () => {

  describe('Every entity artifact has mockData.js', () => {
    for (const entity of entityArtifacts) {
      it(`${entity} should have generated mockData.js`, () => {
        const mockPath = resolve(ARTIFACTS, entity, 'generated', 'web', entity, 'mockData.js');
        assert.ok(
          existsSync(mockPath),
          `Missing: artifacts/${entity}/generated/web/${entity}/mockData.js`
        );
      });
    }
  });

  describe('Every aggregate artifact has generated mockData.js', () => {
    for (const agg of aggregateArtifacts) {
      it(`${agg} should have generated/mockData.js`, () => {
        const mockPath = resolve(ARTIFACTS, agg, 'generated', 'mockData.js');
        assert.ok(
          existsSync(mockPath),
          `Missing: artifacts/${agg}/generated/mockData.js`
        );
      });
    }
  });

  describe('Every entity window in menu.json has a loader in registry.js', () => {
    for (const win of entityWindows) {
      it(`${win} should be registered in windowLoaders`, () => {
        const pattern = `'${win}'`;
        assert.ok(
          registrySource.includes(pattern),
          `Window '${win}' is in menu.json but NOT in registry.js windowLoaders`
        );
      });
    }
  });

  describe('Every entity window in menu.json has mockData in App.jsx loadAllMockData', () => {
    for (const win of entityWindows) {
      it(`${win} mockData should be imported in App.jsx`, () => {
        const pattern = `/${win}/`;
        assert.ok(
          appSource.includes(pattern),
          `Window '${win}' mockData is NOT imported in App.jsx loadAllMockData`
        );
      });
    }
  });

  describe('Every entity artifact has generated frontend components', () => {
    for (const entity of entityArtifacts) {
      it(`${entity} should have generated index.jsx`, () => {
        const indexPath = resolve(ARTIFACTS, entity, 'generated', 'web', entity, 'index.jsx');
        assert.ok(
          existsSync(indexPath),
          `Missing: artifacts/${entity}/generated/web/${entity}/index.jsx`
        );
      });
    }
  });

  describe('Every aggregate artifact has generated config.js', () => {
    for (const agg of aggregateArtifacts) {
      it(`${agg} should have generated/config.js`, () => {
        const configPath = resolve(ARTIFACTS, agg, 'generated', 'config.js');
        assert.ok(
          existsSync(configPath),
          `Missing: artifacts/${agg}/generated/config.js`
        );
      });
    }
  });

  describe('No orphan entity windows (in registry but not in menu)', () => {
    const registeredWindows = [...registrySource.matchAll(/'([^']+)':\s*\(\)/g)]
      .map(m => m[1]);
    for (const win of registeredWindows) {
      it(`${win} in registry should exist in menu.json`, () => {
        assert.ok(
          allMenuItems.includes(win),
          `Window '${win}' is in registry.js but NOT in menu.json`
        );
      });
    }
  });
});
