import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';

export function resolvePublicApiSchema({ apiVersion, windows }) {
  const entities = {};
  for (const { entityName, specName, contract } of windows) {
    const fields = contract.frontendContract.entities[entityName].fields;
    const exposedFields = {};
    for (const field of fields) {
      if (!field.publicApi || field.publicApi.exposed !== true) continue;
      exposedFields[field.publicApi.name || field.name] = {
        publicApi: true,
        direction: 'out',
        internalPath: field.name,
        type: field.publicApi.type,
        handlerId: field.publicApi.handlerId ?? null,
      };
    }
    if (Object.keys(exposedFields).length === 0) continue;
    entities[entityName] = {
      publicApi: true,
      // NeoServlet's real URL pattern is /sws/neo/{specName}/{entityName} (see
      // docs/architecture-overview.md) — the artifact/spec directory name, not
      // always the same as the AD entity name (e.g. contacts -> businessPartner).
      specName: specName ?? entityName,
      operations: ['GET', 'LIST'],
      fields: exposedFields,
    };
  }
  return { apiVersion, entities };
}

export function writePublicApiSchema({ apiVersion, windows, outputPath }) {
  const resolved = resolvePublicApiSchema({ apiVersion, windows });
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, JSON.stringify(resolved, null, 2) + '\n');
  return resolved;
}

export function loadContractsForWindows(entries, artifactsRoot) {
  return entries.map(({ entityName, windowName }) => ({
    entityName,
    specName: windowName,
    contract: JSON.parse(
      readFileSync(`${artifactsRoot}/${windowName}/contract.json`, 'utf-8')
    ),
  }));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const artifactsRoot = process.argv.includes('--artifacts-root')
    ? process.argv[process.argv.indexOf('--artifacts-root') + 1]
    : 'artifacts';
  const windows = loadContractsForWindows(
    [
      { windowName: 'product', entityName: 'product' },
      { windowName: 'contacts', entityName: 'businessPartner' },
    ],
    artifactsRoot
  );
  const result = writePublicApiSchema({
    apiVersion: 'v1',
    windows,
    outputPath: `${artifactsRoot}/_public-api/allowlist.v1.json`,
  });
  console.log(`Wrote ${Object.keys(result.entities).length} entities to allowlist.v1.json`);
}
