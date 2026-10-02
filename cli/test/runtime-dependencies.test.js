/**
 * Contract: every package a bin can load at runtime is a `dependency` (ETP-5511).
 *
 * A consumer installs @etendosoftware/schema-forge-cli without its
 * devDependencies, so a runtime import of a devDependency works in this repo and
 * crashes in every consumer with ERR_MODULE_NOT_FOUND. That shipped:
 * sf-validate-pipeline reached `@babel/parser` through quality-gate, and
 * sf-quality-gate reached `ajv`, both declared only as devDependencies.
 *
 * Static check: parse every module reachable from a `bin` entry (static
 * imports, re-exports and literal `import()` calls, following relative paths)
 * and require each bare specifier to be a Node builtin or a `dependencies`
 * entry. Specifiers inside template strings (the JSX the generators emit) are
 * not imports and are not seen by the parser.
 */
import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync, existsSync } from 'node:fs';
import { builtinModules } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from '@babel/parser';

const CLI_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(join(CLI_DIR, 'package.json'), 'utf8'));
const DEPENDENCIES = new Set(Object.keys(pkg.dependencies ?? {}));
const BUILTINS = new Set(builtinModules);

/** '@scope/name/sub' -> '@scope/name', 'name/sub' -> 'name'. */
export function packageNameOf(specifier) {
  const parts = specifier.split('/');
  return specifier.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
}

/** Every import source literal in a module (static, re-export, literal import()). */
export function importSourcesOf(code) {
  const ast = parse(code, {
    sourceType: 'module',
    allowHashBang: true,
    allowAwaitOutsideFunction: true,
    plugins: ['importAttributes'],
  });
  const sources = [];
  const visit = (node) => {
    if (!node || typeof node.type !== 'string') return;
    if (
      (node.type === 'ImportDeclaration'
        || node.type === 'ExportAllDeclaration'
        || node.type === 'ExportNamedDeclaration')
      && node.source
    ) {
      sources.push(node.source.value);
    }
    if (node.type === 'ImportExpression' && node.source?.type === 'StringLiteral') {
      sources.push(node.source.value);
    }
    if (
      node.type === 'CallExpression'
      && node.callee?.type === 'Import'
      && node.arguments[0]?.type === 'StringLiteral'
    ) {
      sources.push(node.arguments[0].value);
    }
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.forEach(visit);
      else if (value && typeof value === 'object') visit(value);
    }
  };
  visit(ast.program);
  return sources;
}

function resolveRelative(fromFile, specifier) {
  const base = resolve(dirname(fromFile), specifier);
  return [base, `${base}.js`, join(base, 'index.js')].find(
    (candidate) => existsSync(candidate) && candidate.endsWith('.js'),
  );
}

/** Map of bare package name -> first module that imports it, over the bin graph. */
function collectRuntimePackages(entries) {
  const seen = new Set();
  const packages = new Map();
  const queue = [...entries];
  while (queue.length > 0) {
    const file = queue.shift();
    if (seen.has(file)) continue;
    seen.add(file);
    for (const specifier of importSourcesOf(readFileSync(file, 'utf8'))) {
      if (specifier.startsWith('.')) {
        const target = resolveRelative(file, specifier);
        if (target) queue.push(target);
        continue;
      }
      const name = specifier.startsWith('node:') ? specifier : packageNameOf(specifier);
      if (!packages.has(name)) packages.set(name, file.slice(CLI_DIR.length + 1));
    }
  }
  return packages;
}

describe('cli runtime dependencies', () => {
  it('importSourcesOf ignores specifiers inside template strings', () => {
    const code = "import a from 'pg';\nconst s = `import x from 'sonner';`;\nawait import('ajv');";
    assert.deepEqual(importSourcesOf(code), ['pg', 'ajv']);
  });

  it('every package imported by bin-reachable code is in dependencies', () => {
    const entries = Object.values(pkg.bin).map((target) => join(CLI_DIR, target));
    const packages = collectRuntimePackages(entries);
    const missing = [...packages]
      .filter(([name]) => !name.startsWith('node:') && !BUILTINS.has(name) && !DEPENDENCIES.has(name))
      .map(([name, file]) => `${name} (imported by ${file})`);
    assert.deepEqual(missing, [], `runtime imports missing from cli/package.json dependencies:\n  ${missing.join('\n  ')}`);
  });
});
