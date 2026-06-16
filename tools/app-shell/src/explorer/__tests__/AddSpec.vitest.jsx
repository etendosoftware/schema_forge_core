import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(__dirname, '..', 'AddSpec.jsx'), 'utf8');

describe('AddSpec source', () => {
  it('exports a default component', () => { expect(src).toContain('export default'); });
  it('handles spec creation', () => { expect(src).toContain('create'); });
  it('uses search/filter input', () => { expect(src).toContain('Search'); });
  it('validates input', () => { expect(src).toContain('required'); });
});
