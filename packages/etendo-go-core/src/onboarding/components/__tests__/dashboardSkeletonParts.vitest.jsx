// @covers packages/etendo-go-core/src/onboarding/components/dashboardSkeletonParts.jsx
import React from 'react';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import * as Phosphor from '@phosphor-icons/react';
import {
  SKELETON_BG,
  ICON_COLOR,
  MENU_GROUPS,
  TABLE_ROW_1,
  TABLE_ROW_2,
  EMPTY_ROW_COUNT,
  CELL_WIDTHS,
  Bar,
  RailMenuItem,
  Checkbox,
  TableRow,
} from '../dashboardSkeletonParts.jsx';

/**
 * ETP-4662 — dashboardSkeletonParts.jsx holds the skeleton primitives shared by
 * SetupPreviewMockup and AuthPreviewMockup. It used to be covered by reading its
 * own source text, which passes even when the primitives stop rendering what
 * they claim. These tests import the real exported values and render the real
 * components, so the contract is observed instead of described.
 *
 * The menu labels are deliberately locale-agnostic skeletons, so the only thing
 * that makes the preview read as "the real app sidebar" is the IDENTITY of the
 * phosphor icons — pinned below against the actual @phosphor-icons/react exports.
 */

afterEach(cleanup);

/** An icon's path data is its visual identity: two different icons never share it. */
function pathsOf(svg) {
  return Array.from(svg.querySelectorAll('path')).map((path) => path.getAttribute('d')).join('|');
}

/** Renders one icon exactly the way the rail does, and returns its visual identity. */
function iconSignature(Icon) {
  const { container, unmount } = render(<Icon size={20} weight="regular" />);
  const signature = pathsOf(container.querySelector('svg'));
  unmount();
  return signature;
}

const ICON_NAMES = ['House', 'Star', 'IdentificationCard', 'TrendUp', 'Receipt', 'Package', 'Bank', 'Plug', 'Gear', 'Flask'];

describe('dashboardSkeletonParts — color tokens (ETP-4662)', () => {
  it('exposes the Figma skeleton background and icon color classes', () => {
    expect(SKELETON_BG).toBe('bg-[#E8EAEF]');
    expect(ICON_COLOR).toBe('text-[#828FA3]');
  });
});

describe('dashboardSkeletonParts — table skeleton constants (ETP-4662)', () => {
  it('exposes the two body rows, the empty-row count and the column widths', () => {
    expect(TABLE_ROW_1).toEqual([35, 29, 73, 90, 90]);
    expect(TABLE_ROW_2).toEqual([84, 54, 108, 130, 130]);
    expect(EMPTY_ROW_COUNT).toBe(10);
    expect(CELL_WIDTHS).toEqual([112, 96, 132, 200, 200]);
  });
});

describe('dashboardSkeletonParts — MENU_GROUPS (ETP-4662)', () => {
  it('holds the same ten phosphor icon components the real app sidebar uses', () => {
    const icons = MENU_GROUPS.flatMap((group) => group.items.map(([Icon]) => Icon));

    expect(icons).toHaveLength(ICON_NAMES.length);
    ICON_NAMES.forEach((name, index) => {
      // Identity, not a look-alike: it IS the export from @phosphor-icons/react.
      expect(icons[index], name).toBe(Phosphor[name]);
      expect(icons[index].displayName, name).toBe(`${name}Icon`);
    });
  });

  it('keeps the [Icon, valueBarWidth, hasTrailingChevron] shape the rail consumes', () => {
    expect(MENU_GROUPS.length).toBeGreaterThan(0);
    for (const group of MENU_GROUPS) {
      expect(typeof group.headingWidth).toBe('number');
      expect(Array.isArray(group.items)).toBe(true);
      for (const item of group.items) {
        expect(item).toHaveLength(3);
        // A renderable React component type (function component or forwardRef object).
        expect(['function', 'object']).toContain(typeof item[0]);
        expect(item[1]).toBeTypeOf('number');
        expect(item[2]).toBeTypeOf('boolean');
      }
    }
  });
});

describe('dashboardSkeletonParts — Bar (ETP-4662)', () => {
  it('renders a skeleton pill sized by its width prop', () => {
    const { container } = render(<Bar width={52} />);
    const pill = container.firstChild;

    expect(pill.tagName).toBe('SPAN');
    expect(pill.style.width).toBe('52px');
    expect(pill.className).toContain('inline-block');
    expect(pill.className).toContain('h-3');
    expect(pill.className).toContain('rounded-full');
    expect(pill.className).toContain(SKELETON_BG);
  });
});

describe('dashboardSkeletonParts — RailMenuItem (ETP-4662)', () => {
  it('composes the icon, a Bar label sized by width, and the chevron when asked', () => {
    const { container } = render(<RailMenuItem icon={Phosphor.House} width={78} hasChevron />);
    const item = container.firstChild;

    const icon = item.querySelector('svg');
    expect(pathsOf(icon)).toBe(iconSignature(Phosphor.House));
    expect(icon.getAttribute('width')).toBe('20');
    expect(icon.getAttribute('height')).toBe('20');

    const bar = Array.from(item.querySelectorAll('span')).find((span) => span.style.width);
    expect(bar.style.width).toBe('78px');
    expect(bar.className).toContain(SKELETON_BG);

    // The trailing chevron is lucide (24px grid), the menu icon is phosphor (256px grid).
    const chevrons = Array.from(item.querySelectorAll('svg')).filter((svg) => svg.getAttribute('viewBox') === '0 0 24 24');
    expect(chevrons).toHaveLength(1);
  });

  it('omits the chevron for items that do not expand', () => {
    const { container } = render(<RailMenuItem icon={Phosphor.House} width={52} hasChevron={false} />);

    const chevrons = Array.from(container.querySelectorAll('svg')).filter((svg) => svg.getAttribute('viewBox') === '0 0 24 24');
    expect(chevrons).toHaveLength(0);
    expect(container.querySelectorAll('svg')).toHaveLength(1);
  });
});

describe('dashboardSkeletonParts — Checkbox (ETP-4662)', () => {
  it('renders a dark fill and a check mark only when checked', () => {
    const { container } = render(<Checkbox checked />);
    const box = container.firstChild;

    expect(box.className).toContain('border-[#121217]');
    expect(box.className).toContain('bg-[#121217]');
    expect(box.className).not.toContain('bg-white');

    const mark = box.querySelector('svg');
    expect(mark).not.toBeNull();
    expect(mark.getAttribute('width')).toBe('8');
    expect(mark.getAttribute('height')).toBe('6');
    expect(mark.querySelector('path').getAttribute('stroke')).toBe('white');
  });

  it('renders an empty white box when unchecked', () => {
    const { container } = render(<Checkbox checked={false} />);
    const box = container.firstChild;

    expect(box.className).toContain('border-[#D1D4DB]');
    expect(box.className).toContain('bg-white');
    expect(box.className).not.toContain('border-[#121217]');
    expect(box.querySelector('svg')).toBeNull();
  });
});

describe('dashboardSkeletonParts — TableRow (ETP-4662)', () => {
  it('renders a Checkbox plus one Bar cell per width, sized by CELL_WIDTHS', () => {
    const { container } = render(<TableRow widths={TABLE_ROW_1} checked={false} />);
    const row = container.firstChild;

    const cells = Array.from(row.children).slice(1);
    expect(cells.map((cell) => cell.style.width)).toEqual(CELL_WIDTHS.map((width) => `${width}px`));
    expect(cells.map((cell) => cell.querySelector('span').style.width)).toEqual(TABLE_ROW_1.map((width) => `${width}px`));

    // The default (row) height.
    expect(row.className).toContain('h-10');
    expect(row.className).not.toContain('h-[52px]');

    // The first cell is the checkbox column; its single child is the Checkbox itself.
    const checkbox = row.firstElementChild.firstElementChild;
    expect(checkbox.className).toContain('bg-white');
    expect(checkbox.querySelector('svg')).toBeNull();
  });

  it('toggles to the tall height and the checked Checkbox', () => {
    const { container } = render(<TableRow widths={TABLE_ROW_2} tall checked />);
    const row = container.firstChild;

    expect(row.className).toContain('h-[52px]');
    expect(row.className).not.toContain('h-10');

    const checkbox = row.firstElementChild.firstElementChild;
    expect(checkbox.className).toContain('bg-[#121217]');
    expect(checkbox.querySelector('svg')).not.toBeNull();
  });
});
