import { existsSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

/** This package's root: cli/ in a checkout, node_modules/@etendosoftware/schema-forge-cli once installed. */
const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

/**
 * Root of the repo a CLI operates on (the one holding artifacts/, tools/, ...).
 *
 * 1. SF_ROOT, when set (the Makefile and cli/sf-local export it).
 * 2. Running from a source checkout: the checkout root, one level above cli/.
 * 3. Installed under node_modules: the nearest directory at or above cwd that
 *    holds artifacts/, else cwd. Never the package's own location — `../..` of
 *    an installed script is node_modules/@etendosoftware, which holds no repo.
 */
export function resolveRepoRoot({ env = process.env, cwd = process.cwd(), packageRoot = PACKAGE_ROOT } = {}) {
  if (env.SF_ROOT) return resolve(env.SF_ROOT);
  if (!packageRoot.split(sep).includes('node_modules')) return resolve(packageRoot, '..');
  for (let dir = resolve(cwd); ; dir = dirname(dir)) {
    if (existsSync(join(dir, 'artifacts'))) return dir;
    if (dirname(dir) === dir) return resolve(cwd);
  }
}
