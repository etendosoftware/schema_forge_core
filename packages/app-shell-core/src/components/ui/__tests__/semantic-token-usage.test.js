import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const componentUrls = {
  Input: new URL('../input.jsx', import.meta.url),
  Select: new URL('../select.jsx', import.meta.url),
  Table: new URL('../table.jsx', import.meta.url),
  Checkbox: new URL('../checkbox.jsx', import.meta.url),
  AddLineButton: new URL('../add-line-button.jsx', import.meta.url),
  ShellLayout: new URL('../../../layout/ShellLayout.jsx', import.meta.url),
};

const prohibitedLiteralColor = /#[0-9A-Fa-f]{3,8}/;

describe('core primitives use the semantic accessibility contract (ETP-4554)', () => {
  for (const [name, url] of Object.entries(componentUrls)) {
    it(`${name} does not bypass semantic tokens with a literal color`, async () => {
      const source = await readFile(url, 'utf8');
      assert.doesNotMatch(source, prohibitedLiteralColor);
      assert.doesNotMatch(source, /0\.5px|disabled:opacity/);
    });
  }

  it('uses control borders and a visible focus ring for form primitives', async () => {
    const [input, select, checkbox] = await Promise.all([
      readFile(componentUrls.Input, 'utf8'),
      readFile(componentUrls.Select, 'utf8'),
      readFile(componentUrls.Checkbox, 'utf8'),
    ]);
    for (const source of [input, select, checkbox]) {
      assert.match(source, /border-border-control/);
      assert.match(source, /(?:ring-focus-ring|--focus-ring)/);
      assert.doesNotMatch(source, /disabled:opacity-|opacity:\s*0\.5/);
    }
  });

  it('defines the field hover / disabled-border tokens in both themes (ETP-5479)', async () => {
    const css = await readFile(new URL('../../../styles.css', import.meta.url), 'utf8');
    const rootBlock = css.slice(css.indexOf(':root {'), css.indexOf('.dark {'));
    const darkBlock = css.slice(css.indexOf('.dark {'));
    for (const block of [rootBlock, darkBlock]) {
      assert.match(block, /--field-hover:\s*[^;]+;/);
      assert.match(block, /--field-disabled-border:\s*[^;]+;/);
    }
    // Light values come from the design: #F5F7F9 fill, #D1D4DB disabled border.
    assert.match(rootBlock, /--field-hover:\s*210 25% 96\.9%;/);
    assert.match(rootBlock, /--field-disabled-border:\s*222 12\.2% 83\.9%;/);
  });

  it('dark theme overrides the field tokens inside the .dark block with resolvable dark values (ETP-5479)', async () => {
    const css = await readFile(new URL('../../../styles.css', import.meta.url), 'utf8');
    const block = (selector) => {
      const start = css.indexOf(`${selector} {`);
      assert.notEqual(start, -1, `${selector} block not found`);
      return css.slice(start, css.indexOf('\n  }', start));
    };
    const tokenValue = (body, name) => body.match(new RegExp(`--${name}:\\s*([^;]+);`))?.[1].trim();
    const rootBlock = block(':root');
    const darkBlock = block('.dark');

    for (const name of ['field-hover', 'field-disabled-border']) {
      const dark = tokenValue(darkBlock, name);
      assert.ok(dark, `--${name} must be declared inside the .dark block itself`);
      // Inheriting the light literals would paint a near-white fill on the dark card.
      assert.notEqual(dark, tokenValue(rootBlock, name), `--${name} dark value must differ from light`);
      // A var() alias must point at a token the dark theme actually defines.
      const alias = dark.match(/^var\(--([\w-]+)\)$/)?.[1];
      if (alias) assert.ok(tokenValue(darkBlock, alias), `--${name} aliases undefined dark token --${alias}`);
    }
  });

  it('uses structural boundaries without opacity dilution', async () => {
    const [table, shell] = await Promise.all([
      readFile(componentUrls.Table, 'utf8'),
      readFile(componentUrls.ShellLayout, 'utf8'),
    ]);
    for (const source of [table, shell]) {
      assert.match(source, /border-border-structural/);
      assert.doesNotMatch(source, /border-border\/(?:40|50)/);
    }
  });
});
