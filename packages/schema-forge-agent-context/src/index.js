import { copyFile, mkdir, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = fileURLToPath(new URL('../', import.meta.url));
const contextRoot = path.join(packageRoot, 'context');

export const DEFAULT_CONTEXT_FILES = [
  'AGENTS.md',
  'CLAUDE.md',
  '.github/copilot-instructions.md',
  '.github/copilot-review-instructions.md',
  'docs/agent-context-index.md',
  'docs/architecture-overview.md',
  'docs/contract-generation-ownership.md',
];

function resolveInside(baseDir, relativePath) {
  const resolved = path.resolve(baseDir, relativePath);
  const relative = path.relative(baseDir, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Refusing to access path outside ${baseDir}: ${relativePath}`);
  }
  return resolved;
}

export async function listAgentContextFiles() {
  const files = [];

  async function walk(dir) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
        continue;
      }
      if (entry.isFile()) {
        files.push(path.relative(contextRoot, fullPath).split(path.sep).join('/'));
      }
    }
  }

  await walk(contextRoot);
  return files.sort();
}

export async function installAgentContext({
  targetDir = process.cwd(),
  force = false,
  dryRun = false,
  files = DEFAULT_CONTEXT_FILES,
} = {}) {
  const targetRoot = path.resolve(targetDir);
  const results = [];

  for (const file of files) {
    const source = resolveInside(contextRoot, file);
    const target = resolveInside(targetRoot, file);
    const targetExists = await stat(target).then(() => true, () => false);
    const status = targetExists && !force ? 'skipped' : dryRun ? 'planned' : 'installed';

    if (!dryRun && status === 'installed') {
      await mkdir(path.dirname(target), { recursive: true });
      await copyFile(source, target);
    }

    results.push({ file, status });
  }

  return results;
}

function readOptionValue(args, name, fallback) {
  const index = args.indexOf(name);
  if (index === -1) {
    return fallback;
  }
  return args[index + 1] ?? fallback;
}

export async function runAgentContextCli(args = []) {
  const [command = 'list'] = args;

  if (command === 'list') {
    const files = await listAgentContextFiles();
    console.log(files.join('\n'));
    return;
  }

  if (command === 'install') {
    const targetDir = readOptionValue(args, '--target', process.cwd());
    const force = args.includes('--force');
    const dryRun = args.includes('--dry-run');
    const results = await installAgentContext({ targetDir, force, dryRun });
    for (const result of results) {
      console.log(`${result.status}\t${result.file}`);
    }
    return;
  }

  throw new Error(`Unknown sf-agent-context command: ${command}`);
}
