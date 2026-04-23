import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { collectSourceFiles, isJavaScriptModule, parseModuleSource, repoRelative } from './shared.js';

export async function runParseCheck(_windowName, { rootDir, windowDir }) {
  const generatedDir = join(windowDir, 'generated');
  const files = collectSourceFiles(generatedDir, isJavaScriptModule);

  if (files.length === 0) {
    return { status: 'skip', detail: 'No generated .js or .jsx files found.' };
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
    detail: `Parsed ${files.length} generated source file(s).`,
  };
}
