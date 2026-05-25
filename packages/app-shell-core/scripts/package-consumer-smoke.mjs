import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const repoRoot = resolve(new URL('../../..', import.meta.url).pathname);
const packageRoot = resolve(new URL('..', import.meta.url).pathname);
const keepFixture = process.env.SF_KEEP_CONSUMER_FIXTURE === 'true';
const fixtureDir = mkdtempSync(join(tmpdir(), 'app-shell-core-consumer-'));
const tarballDir = join(fixtureDir, 'tarball');

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd || repoRoot,
    encoding: 'utf8',
    stdio: options.capture ? 'pipe' : 'inherit',
    env: {
      ...process.env,
      npm_config_audit: 'false',
      npm_config_fund: 'false',
    },
  });

  if (result.status !== 0) {
    if (options.capture) {
      process.stdout.write(result.stdout || '');
      process.stderr.write(result.stderr || '');
    }
    throw new Error(`${command} ${args.join(' ')} failed with exit code ${result.status}`);
  }

  return result.stdout;
}

function writeFixtureFiles(tarballPath) {
  writeFileSync(join(fixtureDir, 'package.json'), JSON.stringify({
    name: 'app-shell-core-consumer-smoke',
    private: true,
    type: 'module',
    scripts: {
      build: 'vite build',
    },
    dependencies: {
      '@schema-forge/app-shell-core': `file:${tarballPath}`,
      '@vitejs/plugin-react': '^4.3.0',
      '@radix-ui/react-slot': '^1.2.4',
      'class-variance-authority': '^0.7.1',
      clsx: '^2.1.0',
      'lucide-react': '^0.400.0',
      react: '^18.3.0',
      'react-dom': '^18.3.0',
      'react-router-dom': '^7.0.0',
      'tailwind-merge': '^2.2.0',
      vite: '^6.0.0',
    },
    devDependencies: {
      autoprefixer: '^10.4.0',
      postcss: '^8.4.0',
      tailwindcss: '^3.4.0',
    },
  }, null, 2));

  writeFileSync(join(fixtureDir, 'index.html'), '<div id="root"></div><script type="module" src="/src/App.jsx"></script>\n');
  writeFileSync(join(fixtureDir, 'postcss.config.js'), 'export default { plugins: { tailwindcss: {}, autoprefixer: {} } };\n');
  writeFileSync(join(fixtureDir, 'tailwind.config.js'), `import appShellCorePreset from '@schema-forge/app-shell-core/tailwind-preset';

export default {
  presets: [appShellCorePreset],
  content: ['./src/**/*.{js,jsx}', './node_modules/@schema-forge/app-shell-core/src/**/*.{js,jsx}'],
};
`);

  writeFileSync(join(fixtureDir, 'src', 'App.jsx'), `import React from 'react';
import { createRoot } from 'react-dom/client';
import '@schema-forge/app-shell-core/styles.css';
import {
  AppShellRuntime,
  createAppShellConfig,
  createMemoryAuthStorage,
} from '@schema-forge/app-shell-core';
import { Button } from '@schema-forge/app-shell-core/components/ui/button.jsx';
import { Card, CardContent } from '@schema-forge/app-shell-core/components/ui/card.jsx';

function Dashboard() {
  return (
    <Card>
      <CardContent>
        <Button type="button">Standalone dashboard</Button>
      </CardContent>
    </Card>
  );
}

function Login() {
  return <div>Login supplied by consumer</div>;
}

const config = createAppShellConfig({
  menuGroups: [
    {
      id: 'main',
      title: 'Main',
      items: [{ id: 'dashboard', label: 'Dashboard', path: '/dashboard' }],
    },
  ],
  routes: [
    { path: '/', index: true, element: <Dashboard /> },
    { path: '/dashboard', element: <Dashboard /> },
    { path: '/login', public: true, element: <Login /> },
  ],
  reports: [{ id: 'sales-summary', title: 'Sales summary' }],
});

createRoot(document.getElementById('root')).render(
  <AppShellRuntime
    config={config}
    auth={{
      loginPath: '/login',
      storage: createMemoryAuthStorage({ token: 'fixture-token', username: 'fixture-user' }),
    }}
    currency={{ value: 'EUR' }}
  />
);
`);
}

try {
  run('mkdir', ['-p', tarballDir, join(fixtureDir, 'src')]);
  const packOutput = run('npm', ['pack', '--json', '--pack-destination', tarballDir], {
    cwd: packageRoot,
    capture: true,
  });
  const [packed] = JSON.parse(packOutput);
  const tarballPath = join(tarballDir, packed.filename);

  writeFixtureFiles(tarballPath);
  run('npm', ['install', '--ignore-scripts'], { cwd: fixtureDir });
  run('npm', ['run', 'build'], { cwd: fixtureDir });
  console.log(`app-shell-core consumer smoke passed in ${fixtureDir}`);
} finally {
  if (!keepFixture) {
    rmSync(fixtureDir, { recursive: true, force: true });
  } else {
    console.log(`kept fixture at ${fixtureDir}`);
  }
}
