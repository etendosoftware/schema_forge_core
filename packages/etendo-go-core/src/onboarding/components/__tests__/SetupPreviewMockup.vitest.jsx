// @covers packages/etendo-go-core/src/onboarding/components/SetupPreviewMockup.jsx
import React from 'react';
import { cleanup, render, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { SetupPreviewMockup } from '../SetupPreviewMockup.jsx';
import { MENU_GROUPS, SKELETON_BG } from '../dashboardSkeletonParts.jsx';

/**
 * ETP-4445 — the onboarding right panel is a live skeleton preview of the app
 * dashboard. The old suite pinned it by regex-matching the component's source,
 * so it could pass while the panel rendered nothing. These tests mount it and
 * assert on the DOM: the live user/company, the real icons, the variant-driven
 * gradient cross-fade and the reduced-motion guards.
 */

afterEach(cleanup);

const PHOSPHOR_VIEW_BOX = '0 0 256 256';

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

/** The phosphor icons the preview renders, in document (and therefore menu) order. */
function renderedPhosphorIcons(container) {
  return Array.from(container.querySelectorAll('svg'))
    .filter((svg) => svg.getAttribute('viewBox') === PHOSPHOR_VIEW_BOX)
    .map(pathsOf);
}

function rail(container) {
  return container.querySelector('aside');
}

function railHeader(container) {
  return rail(container).firstElementChild;
}

function railFooter(container) {
  return rail(container).lastElementChild;
}

/** Both gradient masks are always mounted; only their opacity changes. */
function gradient(container, direction) {
  return Array.from(container.firstChild.children)
    .find((child) => (child.style.background || '').startsWith(`linear-gradient(${direction}deg`));
}

function card(container) {
  return Array.from(container.firstChild.children)
    .find((child) => child.className.includes('rounded-[20px]'));
}

describe('SetupPreviewMockup — root (ETP-4445)', () => {
  it('renders the preview surface and defaults to the profile variant', () => {
    const { container } = render(<SetupPreviewMockup />);
    const root = container.firstChild;

    expect(root.getAttribute('data-testid')).toBe('SetupPreviewMockup__79cf84');
    // Omitting `variant` must frame the profile step: top fade on, bottom fade off.
    expect(gradient(container, 180).style.opacity).toBe('1');
    expect(gradient(container, 0).style.opacity).toBe('0');
  });
});

describe('SetupPreviewMockup — live user in the footer (ETP-4445)', () => {
  it('renders the typed name and its uppercased initial in the rail footer', () => {
    const { container } = render(<SetupPreviewMockup userName="  ada lovelace  " orgName="" />);
    const footer = railFooter(container);

    expect(within(footer).getByText('ada lovelace')).toBeTruthy();
    const initial = within(footer).getByText('A');
    expect(initial.className).toContain(SKELETON_BG);
    expect(initial.className).toContain('rounded-full');
  });

  it('falls back to the neutral placeholders until a name is typed, and updates live', () => {
    const { container, rerender } = render(<SetupPreviewMockup userName="" orgName="" />);

    expect(within(railFooter(container)).getByText('Tu nombre')).toBeTruthy();
    expect(within(railFooter(container)).getByText('?')).toBeTruthy();

    rerender(<SetupPreviewMockup userName="Bea" orgName="" />);

    const footer = railFooter(container);
    expect(within(footer).getByText('Bea')).toBeTruthy();
    expect(within(footer).getByText('B')).toBeTruthy();
    expect(within(footer).queryByText('Tu nombre')).toBeNull();
  });
});

describe('SetupPreviewMockup — company in the header (ETP-4445)', () => {
  it('renders the typed company name live in the rail header', () => {
    const { container } = render(<SetupPreviewMockup orgName="  Acme Corp  " />);
    const header = railHeader(container);

    const name = within(header).getByText('Acme Corp');
    expect(name.tagName).toBe('SPAN');
    expect(name.className).toContain('truncate');
    expect(name.className).toContain('max-w-[108px]');
  });

  it('shows a skeleton bar instead of a name until a company is typed', () => {
    const { container } = render(<SetupPreviewMockup orgName="   " />);
    const header = railHeader(container);

    expect(header.textContent.trim()).toBe('');
    const skeleton = Array.from(header.querySelectorAll('span'))
      .find((span) => span.className.includes('h-2.5') && span.className.includes('w-[90px]'));
    expect(skeleton).toBeTruthy();
    expect(skeleton.className).toContain('rounded-full');
    expect(skeleton.className).toContain(SKELETON_BG);
  });

  it('uses the real product favicon, in both variants', () => {
    for (const variant of ['profile', 'company']) {
      const { container, unmount } = render(<SetupPreviewMockup variant={variant} />);
      const favicon = railHeader(container).querySelector('img');

      expect(favicon, variant).not.toBeNull();
      expect(favicon.getAttribute('src'), variant).toBe('/favicon.png');
      unmount();
    }
  });
});

describe('SetupPreviewMockup — menu icons (ETP-4445)', () => {
  it('renders exactly the shared MENU_GROUPS phosphor icons, in menu order', () => {
    const { container } = render(<SetupPreviewMockup />);

    const expected = MENU_GROUPS.flatMap((group) => group.items.map(([Icon]) => iconSignature(Icon)));

    expect(renderedPhosphorIcons(container)).toEqual(expected);
  });
});

describe('SetupPreviewMockup — variant cross-fade (ETP-4445)', () => {
  it('fades the top gradient in profile and the bottom one in company', () => {
    const profile = render(<SetupPreviewMockup variant="profile" />);
    expect(gradient(profile.container, 180).style.opacity).toBe('1');
    expect(gradient(profile.container, 0).style.opacity).toBe('0');

    cleanup();

    const company = render(<SetupPreviewMockup variant="company" />);
    // Both masks stay mounted so the switch is a transition, not a hard swap.
    expect(gradient(company.container, 180).style.opacity).toBe('0');
    expect(gradient(company.container, 0).style.opacity).toBe('1');
  });
});

describe('SetupPreviewMockup — reduced motion (ETP-4445)', () => {
  it('disables the card transition and both gradient cross-fades for reduced motion', () => {
    const { container } = render(<SetupPreviewMockup />);

    const cardElement = card(container);
    expect(cardElement.className).toContain('transition-[top,bottom,box-shadow]');
    expect(cardElement.className).toContain('motion-reduce:transition-none');

    for (const direction of [180, 0]) {
      const gradientElement = gradient(container, direction);
      expect(gradientElement.className, String(direction)).toContain('transition-opacity');
      expect(gradientElement.className, String(direction)).toContain('motion-reduce:transition-none');
    }
  });
});
