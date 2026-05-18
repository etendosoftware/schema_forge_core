import { existsSync, readFileSync } from 'node:fs';
import { join, sep } from 'node:path';
import { collectSourceFiles, collectTargetSourceFiles, isJavaScriptModule, parseModuleSource, readJson, repoRelative, walkAst } from './shared.js';
import { getAliasDirs } from '../window-aliases.js';

const IGNORED_VISIBILITIES = new Set(['discarded', 'system']);
const SCANNED_ATTRIBUTES = new Set(['title', 'placeholder', 'aria-label']);
const TRANSLATOR_HOOKS = new Set(['useUI', 'useLabel', 'useMenuLabel']);
const SCANNED_LITERAL_PROPERTIES = new Set(['label', 'title', 'description', 'placeholder', 'switchPrompt', 'switchAction', 'error']);

function collectAllowlist(source) {
  const match = source.match(/i18n-allowlist:\s*(\[[^\]]*\])/);
  if (!match) {
    return new Set();
  }

  try {
    const values = JSON.parse(match[1]);
    return new Set(Array.isArray(values) ? values : []);
  } catch {
    return new Set();
  }
}

function significantText(value) {
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized.length > 2 ? normalized : null;
}

function collectTranslatorAliases(ast) {
  const aliases = new Set(['t']);
  walkAst(ast, (node) => {
    if (
      node.type === 'VariableDeclarator'
      && node.id?.type === 'Identifier'
      && node.init?.type === 'CallExpression'
      && node.init.callee?.type === 'Identifier'
      && TRANSLATOR_HOOKS.has(node.init.callee.name)
    ) {
      aliases.add(node.id.name);
    }
  });
  return aliases;
}

function isNonTestJsModule(filePath) {
  return isJavaScriptModule(filePath)
    && !filePath.split(sep).includes('__tests__')
    && !/\.(?:test|spec)\.[jt]sx?$/.test(filePath);
}

function collectCustomFiles(rootDir, windowDir, windowName) {
  if (windowName.startsWith('app-shell:')) {
    return collectTargetSourceFiles(rootDir, windowName);
  }

  const appShellCustomDir = join(rootDir, 'tools', 'app-shell', 'src', 'windows', 'custom');
  const aliases = getAliasDirs(windowName);
  return [
    ...collectSourceFiles(join(windowDir, 'custom'), isNonTestJsModule),
    ...collectSourceFiles(join(appShellCustomDir, windowName), isNonTestJsModule),
    ...aliases.flatMap((alias) => collectSourceFiles(join(appShellCustomDir, alias), isNonTestJsModule)),
    ...collectSourceFiles(join(appShellCustomDir, 'shared'), isNonTestJsModule),
  ].sort((left, right) => left.localeCompare(right));
}

function collectStringViolations(ast, source, rootDir, filePath) {
  const violations = [];
  const allowlist = collectAllowlist(source);
  const translatorAliases = collectTranslatorAliases(ast);

  walkAst(ast, (node) => {
    if (node.type === 'JSXText') {
      const text = significantText(node.value || '');
      if (text && !allowlist.has(text)) {
        violations.push(`${repoRelative(rootDir, filePath)}:${node.loc?.start?.line ?? 1} — hardcoded JSX text '${text}'.`);
      }
      return;
    }

    if (
      node.type === 'JSXAttribute'
      && node.name?.type === 'JSXIdentifier'
      && SCANNED_ATTRIBUTES.has(node.name.name)
      && node.value?.type === 'StringLiteral'
    ) {
      const text = significantText(node.value.value || '');
      if (text && !allowlist.has(text)) {
        violations.push(`${repoRelative(rootDir, filePath)}:${node.loc?.start?.line ?? 1} — hardcoded ${node.name.name} '${text}'.`);
      }
      return;
    }

    if (
      node.type === 'ObjectProperty'
      && !node.computed
      && ((node.key?.type === 'Identifier' && SCANNED_LITERAL_PROPERTIES.has(node.key.name))
        || (node.key?.type === 'StringLiteral' && SCANNED_LITERAL_PROPERTIES.has(node.key.value)))
      && node.value?.type === 'StringLiteral'
    ) {
      const text = significantText(node.value.value || '');
      if (text && !allowlist.has(text)) {
        const propertyName = node.key.type === 'Identifier' ? node.key.name : node.key.value;
        violations.push(`${repoRelative(rootDir, filePath)}:${node.loc?.start?.line ?? 1} — hardcoded ${propertyName} '${text}'.`);
      }
      return;
    }

    if (
      node.type === 'CallExpression'
      && node.callee?.type === 'Identifier'
      && translatorAliases.has(node.callee.name)
      && node.arguments?.[0]?.type === 'StringLiteral'
    ) {
      allowlist.add(node.arguments[0].value);
    }
  });

  return violations;
}

export async function runI18nCheck(windowName, { rootDir, windowDir }) {
  const violations = [];

  if (!windowName.startsWith('app-shell:')) {
    const contractPath = join(windowDir, 'contract.json');
    if (!existsSync(contractPath)) {
      return { status: 'skip', detail: 'contract.json is missing.' };
    }

    const contract = readJson(contractPath);
    for (const [entityName, entity] of Object.entries(contract.frontendContract?.entities ?? {})) {
      for (const field of entity.fields ?? []) {
        if (!field.form || IGNORED_VISIBILITIES.has(field.visibility)) {
          continue;
        }
        if (typeof field.column !== 'string' || field.column.trim().length === 0) {
          violations.push(`${entityName}.${field.name} is missing a non-empty column key for i18n lookup.`);
        }
      }
    }
  }

  const customFiles = collectCustomFiles(rootDir, windowDir, windowName);
  for (const filePath of customFiles) {
    const source = readFileSync(filePath, 'utf8');
    const ast = parseModuleSource(source, filePath);
    violations.push(...collectStringViolations(ast, source, rootDir, filePath));
  }

  if (violations.length > 0) {
    return { status: 'fail', detail: violations.join(' ') };
  }

  return { status: 'pass', detail: 'i18n coverage and custom code checks passed.' };
}
