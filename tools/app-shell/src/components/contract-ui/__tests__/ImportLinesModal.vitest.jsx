import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(__dirname, '..', 'ImportLinesModal.jsx'), 'utf8');

describe('ImportLinesModal source', () => {
  it('exports a default component', () => { expect(src).toContain('export default'); });
  it('uses Checkbox from UI', () => { expect(src).toContain('Checkbox'); });
  it('uses sonner toast', () => { expect(src).toContain('toast'); });
  it('uses fetch for import API', () => { expect(src).toContain('fetch'); });
  it('shows loading state', () => { expect(src).toContain('loading'); });
  it('handles errors', () => { expect(src).toContain('error'); });
});
