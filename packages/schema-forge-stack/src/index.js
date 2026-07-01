import { installAgentContext } from '@etendosoftware/schema-forge-agent-context';

export const STACK_PACKAGES = [
  '@etendosoftware/schema-forge-core',
  '@etendosoftware/app-shell-core',
  '@etendosoftware/schema-forge-agent-context',
];

export const APP_SHELL_PEERS = [
  '@radix-ui/react-collapsible',
  '@radix-ui/react-dialog',
  '@radix-ui/react-dropdown-menu',
  '@radix-ui/react-label',
  '@radix-ui/react-popover',
  '@radix-ui/react-select',
  '@radix-ui/react-separator',
  '@radix-ui/react-slot',
  '@radix-ui/react-switch',
  '@radix-ui/react-tooltip',
  'class-variance-authority',
  'clsx',
  'cmdk',
  'date-fns',
  'lucide-react',
  'next-themes',
  'react',
  'react-day-picker',
  'react-dom',
  'react-router-dom',
  'sonner',
  'tailwind-merge',
];

async function resolvePackage(name) {
  try {
    return { name, ok: true, resolved: import.meta.resolve(name) };
  } catch (error) {
    return { name, ok: false, error: error.message };
  }
}

export async function doctorStack({ includePeers = true } = {}) {
  const packages = await Promise.all(STACK_PACKAGES.map(resolvePackage));
  const peers = includePeers ? await Promise.all(APP_SHELL_PEERS.map(resolvePackage)) : [];
  return {
    ok: [...packages, ...peers].every((item) => item.ok),
    packages,
    peers,
  };
}

export async function verifyStack() {
  const report = await doctorStack();
  if (!report.ok) {
    return report;
  }

  await import('@etendosoftware/schema-forge-core');
  await import('@etendosoftware/app-shell-core/tailwind-preset');
  await import('@etendosoftware/schema-forge-agent-context');

  return report;
}

function readOptionValue(args, name, fallback) {
  const index = args.indexOf(name);
  if (index === -1) {
    return fallback;
  }
  return args[index + 1] ?? fallback;
}

function printResolutionReport(report) {
  for (const item of report.packages) {
    console.log(`${item.ok ? 'ok' : 'missing'}\tpackage\t${item.name}`);
  }
  for (const item of report.peers) {
    console.log(`${item.ok ? 'ok' : 'missing'}\tpeer\t${item.name}`);
  }
}

export async function runStackCli(args = []) {
  const [command = 'doctor'] = args;

  if (command === 'doctor') {
    const report = await doctorStack({ includePeers: !args.includes('--no-peers') });
    printResolutionReport(report);
    if (!report.ok) {
      throw new Error('Schema Forge stack doctor failed.');
    }
    return;
  }

  if (command === 'verify') {
    const report = await verifyStack();
    printResolutionReport(report);
    if (!report.ok) {
      throw new Error('Schema Forge stack verify failed.');
    }
    console.log('verified\tstack package imports');
    return;
  }

  if (command === 'install-agent-context') {
    const targetDir = readOptionValue(args, '--target', process.cwd());
    const force = args.includes('--force');
    const dryRun = args.includes('--dry-run');
    const results = await installAgentContext({ targetDir, force, dryRun });
    for (const result of results) {
      console.log(`${result.status}\t${result.file}`);
    }
    return;
  }

  throw new Error(`Unknown sf-stack command: ${command}`);
}
