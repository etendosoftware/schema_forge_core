import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export async function resolveBaseline({ baselineRef, cacheDir, configHash, resolveRefSha, computeBaseline }) {
  try {
    const baselineSha = await resolveRefSha(baselineRef);
    const cachePath = join(cacheDir, `${baselineSha}-${configHash}.json`);

    if (existsSync(cachePath)) {
      return {
        source: 'cache',
        baselineSha,
        cachePath,
        data: JSON.parse(readFileSync(cachePath, 'utf8')),
      };
    }

    mkdirSync(cacheDir, { recursive: true });
    const data = await computeBaseline({ baselineRef, baselineSha, cachePath });
    writeFileSync(cachePath, `${JSON.stringify(data, null, 2)}\n`);

    return {
      source: 'computed',
      baselineSha,
      cachePath,
      data,
    };
  } catch (error) {
    return {
      source: 'unavailable',
      data: null,
      warning: `Unable to compute baseline from ${baselineRef}: ${error?.message || String(error)}`,
    };
  }
}
