import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(__dirname, '..', 'index.jsx'), 'utf8');

describe('GoodsMovementsWindow custom wrapper', () => {
  it('exports a default function component', () => {
    assert.match(src, /export default function GoodsMovementsWindow/);
  });

  it('imports GeneratedApp from generated artifacts', () => {
    assert.match(src, /import GeneratedApp from '@generated\/goods-movements/);
  });

  it('imports MovementTable from generated artifacts', () => {
    assert.match(src, /import MovementTable from '@generated\/goods-movements/);
  });

  it('renders GeneratedApp with custom Table', () => {
    assert.match(src, /GeneratedApp/);
    assert.match(src, /Table=\{CustomMovementTable\}/);
  });

  it('defines COLUMNS with expected fields', () => {
    assert.match(src, /key:\s*'name'/);
    assert.match(src, /key:\s*'movementDate'/);
    assert.match(src, /key:\s*'documentNo'/);
    assert.match(src, /key:\s*'processed'/);
  });

  it('movementDate column has dot: false', () => {
    assert.match(src, /movementDate.*dot:\s*false/s);
  });

  it('processed column has type status', () => {
    assert.match(src, /key:\s*'processed'.*type:\s*'status'/s);
  });

  it('passes props through to GeneratedApp', () => {
    assert.match(src, /\{\.\.\.props\}/);
  });
});
