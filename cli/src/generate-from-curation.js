#!/usr/bin/env node

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { generateContract } from './generate-contract.js';
import { generateBackend } from './generate-backend.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..', '..');

async function loadProperties() {
  const propsPath = join(ROOT, 'schema_forge.properties');
  const text = await readFile(propsPath, 'utf-8');
  const props = {};
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const [key, ...rest] = trimmed.split('=');
    props[key.trim()] = rest.join('=').trim();
  }
  return props;
}

async function readModuleJavaPackage(modulePath) {
  const adModulePath = join(modulePath, 'src-db/database/sourcedata/AD_MODULE.xml');
  const xml = await readFile(adModulePath, 'utf-8');
  const match = xml.match(/<JAVAPACKAGE><!\[CDATA\[([^\]]+)\]\]><\/JAVAPACKAGE>/);
  return match ? match[1] : null;
}

async function main(curationPath) {
  const props = await loadProperties();
  const modulePath = props['module.path'];
  if (!modulePath) {
    throw new Error('module.path not set in schema_forge.properties');
  }

  const javaPackage = await readModuleJavaPackage(modulePath);
  console.log(`Module: ${modulePath}`);
  console.log(`Package: ${javaPackage}`);

  const moduleConfig = { modulePath, javaPackage };

  const raw = await readFile(curationPath, 'utf-8');
  const curation = JSON.parse(raw);

  const windowName = curation.window.name;
  const slug = windowName.replace(/\s+/g, '-').toLowerCase();
  const artifactsDir = join(ROOT, 'artifacts', slug);

  const schema = {
    version: curation.version,
    window: curation.window,
    entities: curation.entities,
  };

  const keptRules = (curation.rules ?? []).filter(r => r.decision === 'keep');
  const processes = curation.processes ?? [];

  // Step 1: Generate contract
  console.log('\nStep 1: Generating contract...');
  const contract = generateContract(schema, keptRules, processes);
  const contractPath = join(artifactsDir, 'contract.json');
  await writeFile(contractPath, JSON.stringify(contract, null, 2), 'utf-8');
  console.log(`  Tests: ${contract.testManifest.summary.total} (${contract.testManifest.summary.byRunner.node} node, ${contract.testManifest.summary.byRunner.junit} junit)`);

  // Step 2: Generate backend into module
  console.log('\nStep 2: Generating backend into module...');
  const result = await generateBackend(schema, keptRules, processes, contract, windowName, moduleConfig);
  console.log(`  Files generated: ${result.filesGenerated}`);

  console.log('\nDone.');
}

const curationPath = process.argv[2];
if (!curationPath) {
  console.error('Usage: node generate-from-curation.js <path/to/curation.json>');
  process.exit(1);
}

main(curationPath).catch((err) => {
  console.error('Generation failed:', err.message);
  console.error(err.stack);
  process.exit(1);
});
