import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { parse } from '@babel/parser';

export function collectSourceFiles(dir, predicate = () => true) {
  if (!existsSync(dir)) {
    return [];
  }

  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectSourceFiles(fullPath, predicate));
      continue;
    }
    if (predicate(fullPath)) {
      files.push(fullPath);
    }
  }
  return files.sort((left, right) => left.localeCompare(right));
}

export function isJavaScriptModule(filePath) {
  return filePath.endsWith('.js') || filePath.endsWith('.jsx');
}

export function isOnboardingTarget(targetName) {
  return targetName === 'app-shell:onboarding';
}

export function collectTargetSourceFiles(rootDir, targetName) {
  const pagesDir = join(rootDir, 'tools', 'app-shell', 'src', 'pages');

  if (isOnboardingTarget(targetName)) {
    const onboardingFiles = collectSourceFiles(
      join(pagesDir, 'onboarding'),
      (filePath) => isJavaScriptModule(filePath) && !filePath.split(sep).includes('__tests__')
    );
    const onboardingPagePath = join(pagesDir, 'OnboardingPage.jsx');
    return [
      ...(existsSync(onboardingPagePath) ? [onboardingPagePath] : []),
      ...onboardingFiles,
    ].sort((left, right) => left.localeCompare(right));
  }

  if (targetName === 'app-shell:pages') {
    const onboardingPagePath = join(pagesDir, 'OnboardingPage.jsx');
    return collectSourceFiles(
      pagesDir,
      (filePath) => {
        const rel = relative(pagesDir, filePath);
        const isOnboarding = filePath === onboardingPagePath || rel.startsWith('onboarding' + sep);
        const isTest = filePath.split(sep).includes('__tests__');
        return isJavaScriptModule(filePath) && !isTest && !isOnboarding;
      }
    );
  }

  return [];
}

export function parseModuleSource(source, filename) {
  return parse(source, {
    sourceType: 'module',
    plugins: ['jsx'],
    errorRecovery: false,
    sourceFilename: filename,
  });
}

export function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

export function repoRelative(rootDir, filePath) {
  return relative(rootDir, filePath).replaceAll('\\', '/');
}

export function walkAst(node, visit) {
  if (!node || typeof node !== 'object') {
    return;
  }

  if (Array.isArray(node)) {
    node.forEach((child) => walkAst(child, visit));
    return;
  }

  if (typeof node.type === 'string') {
    visit(node);
  }

  for (const [key, value] of Object.entries(node)) {
    if (key === 'loc' || key === 'start' || key === 'end') {
      continue;
    }
    walkAst(value, visit);
  }
}
