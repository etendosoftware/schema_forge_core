import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { collectSourceFiles, isJavaScriptModule, parseModuleSource, repoRelative, walkAst } from './shared.js';

function isRelativeSpecifier(specifier) {
  return specifier.startsWith('./') || specifier.startsWith('../');
}

function resolveRelativeImport(importerPath, specifier) {
  const base = join(dirname(importerPath), specifier);
  const candidates = [
    base,
    `${base}.js`,
    `${base}.jsx`,
    join(base, 'index.js'),
    join(base, 'index.jsx'),
  ];
  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

function collectRelativeImports(ast) {
  const imports = [];
  walkAst(ast, (node) => {
    if (node.type === 'ImportDeclaration' && typeof node.source?.value === 'string' && isRelativeSpecifier(node.source.value)) {
      imports.push({ specifier: node.source.value, line: node.loc?.start?.line ?? 1 });
      return;
    }
    if (
      node.type === 'CallExpression'
      && node.callee?.type === 'Identifier'
      && node.callee.name === 'require'
      && node.arguments?.[0]?.type === 'StringLiteral'
      && isRelativeSpecifier(node.arguments[0].value)
    ) {
      imports.push({ specifier: node.arguments[0].value, line: node.loc?.start?.line ?? 1 });
    }
  });
  return imports;
}

export async function runImportsCheck(_windowName, { rootDir, windowDir }) {
  const files = collectSourceFiles(join(windowDir, 'generated'), isJavaScriptModule);
  if (files.length === 0) {
    return { status: 'skip', detail: 'No generated .js or .jsx files found.' };
  }

  let resolvedCount = 0;
  for (const filePath of files) {
    const source = readFileSync(filePath, 'utf8');
    const ast = parseModuleSource(source, filePath);
    const imports = collectRelativeImports(ast);

    for (const entry of imports) {
      if (!resolveRelativeImport(filePath, entry.specifier)) {
        return {
          status: 'fail',
          detail: `${repoRelative(rootDir, filePath)}:${entry.line} — unresolved relative import '${entry.specifier}'.`,
        };
      }
      resolvedCount += 1;
    }
  }

  return {
    status: 'pass',
    detail: `Resolved ${resolvedCount} relative import(s).`,
  };
}
