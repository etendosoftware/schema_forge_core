import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { collectSourceFiles, collectTargetSourceFiles, isJavaScriptModule, parseModuleSource, repoRelative } from './shared.js';

export async function runParseCheck(targetName, { rootDir, windowDir }) {
  const generatedDir = join(windowDir, 'generated');
  const files = targetName.startsWith('app-shell:')
    ? collectTargetSourceFiles(rootDir, targetName)
    : collectSourceFiles(generatedDir, isJavaScriptModule);

  if (files.length === 0) {
    return { status: 'skip', detail: 'No generated or targeted .js/.jsx files found.' };
  }

  for (const filePath of files) {
    try {
      parseModuleSource(readFileSync(filePath, 'utf8'), filePath);
    } catch (error) {
      return {
        status: 'fail',
        detail: `${repoRelative(rootDir, filePath)} — ${error.message}`,
      };
    }
  }

  return {
    status: 'pass',
    detail: `Parsed ${files.length} source file(s).`,
  };
}
