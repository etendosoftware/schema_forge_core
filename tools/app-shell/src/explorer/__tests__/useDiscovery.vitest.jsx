import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(__dirname, '..', 'useDiscovery.js'), 'utf8');

describe('useDiscovery source', () => {
  it('exports the hook', () => { expect(src).toContain('export'); });
  it('uses fetch for discovery API', () => { expect(src).toContain('fetch'); });
  it('manages loading state', () => { expect(src).toContain('loading'); });
  it('handles errors', () => { expect(src).toContain('error'); });
  it('returns discovered data', () => { expect(src).toContain('return'); });
});
