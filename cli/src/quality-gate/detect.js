import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { resolveCanonicalWindow } from './window-aliases.js';

function escapeRegex(text) {
  return text.replace(/[|\\{}()[\]^$+?.]/g, '\\$&');
}

function globToRegExp(pattern) {
  const placeholder = '__DOUBLE_STAR__';
  const escaped = escapeRegex(pattern)
    .replace(/\*\*/g, placeholder)
    .replace(/\*/g, '[^/]*')
    .replaceAll(placeholder, '.*');
  return new RegExp(`^${escaped}$`);
}

function resolveTouchedWindows(filePath, availableWindows) {
  const artifactMatch = filePath.match(/^artifacts\/([^/]+)\//);
  if (artifactMatch) {
    return [{ window: artifactMatch[1], source: 'direct' }];
  }

  const appShellMatch = filePath.match(/^tools\/app-shell\/src\/windows\/custom\/([^/]+)\//);
  if (!appShellMatch) {
    return [];
  }

  const customDir = appShellMatch[1];
  if (availableWindows.includes(customDir)) {
    return [{ window: customDir, source: 'direct' }];
  }
  const canonical = resolveCanonicalWindow(customDir, availableWindows);
  if (canonical) {
    return [{ window: canonical, source: 'direct' }];
  }
  if (customDir === 'shared') {
    return availableWindows.map((window) => ({ window, source: 'global' }));
  }
  return [];
}

function runGit(rootDir, args) {
  return execFileSync('git', args, { cwd: rootDir, encoding: 'utf8' }).trim();
}

export function collectDecisionWindows(rootDir) {
  const artifactsDir = join(rootDir, 'artifacts');
  if (!existsSync(artifactsDir)) {
    return [];
  }

  return readdirSync(artifactsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((windowName) => existsSync(join(artifactsDir, windowName, 'decisions.json')))
    .sort((left, right) => left.localeCompare(right));
}

function checkTouchedWindowScope(rule, changedFile, allWindows, affected) {
  const excluded = (rule.excludePatterns ?? []).some((p) => globToRegExp(p).test(changedFile));
  if (!excluded) {
    for (const entry of resolveTouchedWindows(changedFile, allWindows)) {
      const current = affected.get(entry.window);
      if (current !== 'direct') {
        affected.set(entry.window, entry.source);
      }
    }
  }
}

function checkByFilesAndRule(rule, changedFile, allWindows, affected) {
  if (!globToRegExp(rule.pattern).test(changedFile)) {
    return;
  }

  if (rule.scope === 'all-windows') {
    for (const windowName of allWindows) {
      if (!affected.has(windowName)) {
        affected.set(windowName, 'global');
      }
    }
    return;
  }
  if (rule.scope === 'touched-window') {
    checkTouchedWindowScope(rule, changedFile, allWindows, affected);
    return;
  }

  if (rule.scope === 'named-target' && rule.target) {
    const excluded = (rule.excludePatterns ?? []).some((p) => globToRegExp(p).test(changedFile));
    if (!excluded) {
      affected.set(rule.target, 'direct');
    }
  }
}

export function detectAffectedWindowsDetailed({ changedFiles, blastRadius, availableWindows }) {
  const allWindows = [...availableWindows].sort((left, right) => left.localeCompare(right));
  const affected = new Map();

  for (const changedFile of changedFiles) {
    for (const rule of blastRadius) {
      checkByFilesAndRule(rule, changedFile, allWindows, affected);
    }
  }

  return [...affected.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([window, source]) => ({ window, source }));
}

export function detectAffectedWindows({ changedFiles, blastRadius, availableWindows }) {
  return detectAffectedWindowsDetailed({ changedFiles, blastRadius, availableWindows })
    .map((entry) => entry.window);
}

export function resolveGitRef(rootDir, ref) {
  return runGit(rootDir, ['rev-parse', ref]);
}

export function getChangedFiles({ rootDir, baselineRef, headRef = 'HEAD' }) {
  const compareBase = runGit(rootDir, ['merge-base', baselineRef, headRef]);
  const output = runGit(rootDir, ['diff', '--name-only', compareBase, headRef]);
  return output.split('\n').map((line) => line.trim()).filter(Boolean);
}
