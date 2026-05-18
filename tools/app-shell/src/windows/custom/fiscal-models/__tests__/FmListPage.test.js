import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(__dirname, '..', 'FmListPage.jsx'), 'utf8');

describe('FmListPage — exports', () => {
  it('has a default export', () => assert.match(src, /export default/));
});

describe('FmListPage — upcoming deadlines widget', () => {
  it('renders fm-upcoming container', () => assert.match(src, /fm-upcoming/));
  it('uses computeUpcomingDeadlines', () => assert.match(src, /computeUpcomingDeadlines/));
  it('passes decls to the widget', () => assert.match(src, /decls={decls}/));
});

describe('FmListPage — table', () => {
  it('renders fm-table', () => assert.match(src, /fm-table/));
  it('shows model column', () => assert.match(src, /decl\.model/));
  it('shows year column', () => assert.match(src, /decl\.year/));
  it('renders StatusPillMenu for status column', () => assert.match(src, /StatusPillMenu/));
});

describe('FmListPage — navigation', () => {
  it('calls onSelect with declaration on row click', () => assert.match(src, /onSelect/));
});
