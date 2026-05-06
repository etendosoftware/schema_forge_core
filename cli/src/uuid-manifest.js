import { randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';

export function getOrCreateUuid(manifest, entityType, key) {
  const fullKey = `${entityType}:${key}`;
  if (!manifest[fullKey]) {
    manifest[fullKey] = randomUUID().replace(/-/g, '').toUpperCase();
  }
  return manifest[fullKey];
}

export async function loadManifest(path) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch { return {}; }
}

export async function saveManifest(path, manifest) {
  await writeFile(path, JSON.stringify(manifest, null, 2) + '\n');
}
