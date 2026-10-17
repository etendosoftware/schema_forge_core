// @covers packages/etendo-go-core/src/onboarding/components/LocaleFlagIcon.jsx
import React from 'react';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { countryFlagEmoji } from '../../countries.js';
import LocaleFlagIconDefault, { LocaleFlagIcon, regionFromLocale } from '../LocaleFlagIcon.jsx';

/**
 * ETP-4444 — LocaleFlagIcon maps a locale (`es_ES` / `en_US`) to a circular flag,
 * with an emoji fallback for every other locale. It used to be covered by slicing
 * and regex-matching its own source text, which cannot tell a rendered flag from
 * a dead branch. These tests execute `regionFromLocale` and mount the component,
 * asserting on the SVG/DOM the browser actually gets.
 */

afterEach(cleanup);

/** `countryFlagEmoji('DE')` → 🇩🇪. The fallback must print exactly that glyph. */
function expectedGlyph(region) {
  return countryFlagEmoji(region);
}

describe('regionFromLocale', () => {
  it('derives the region from the part after the underscore, upper-cased', () => {
    expect(regionFromLocale('es_ES')).toBe('ES');
    expect(regionFromLocale('en_US')).toBe('US');
    expect(regionFromLocale('pt_br')).toBe('BR');
  });

  it('returns an empty region for an empty, single-part or garbage locale', () => {
    expect(regionFromLocale('')).toBe('');
    expect(regionFromLocale('fr')).toBe('');
    expect(regionFromLocale('es_')).toBe('');
    expect(regionFromLocale(undefined)).toBe('');
    expect(regionFromLocale(null)).toBe('');
  });

  it('only reads the segment right after the first underscore', () => {
    expect(regionFromLocale('_ES')).toBe('ES');
    expect(regionFromLocale('a_b_c')).toBe('B');
  });
});

describe('LocaleFlagIcon — Spain branch', () => {
  it('renders a circular-clipped <svg> with the Spain palette', () => {
    const { container } = render(<LocaleFlagIcon locale="es_ES" />);
    const wrapper = container.firstChild;

    expect(wrapper.tagName).toBe('SPAN');
    expect(wrapper.className).toContain('overflow-hidden');
    expect(wrapper.className).toContain('rounded-full');

    const svg = wrapper.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg.getAttribute('viewBox')).toBe('0 0 20 20');

    // Circular crop: the group is clipped by a circle the clipPath defines.
    const clipPath = svg.querySelector('clipPath');
    const circle = clipPath.querySelector('circle');
    expect(circle.getAttribute('cx')).toBe('10');
    expect(circle.getAttribute('cy')).toBe('10');
    expect(circle.getAttribute('r')).toBe('10');
    expect(svg.querySelector('g').getAttribute('clip-path')).toBe(`url(#${clipPath.getAttribute('id')})`);

    const fills = Array.from(svg.querySelectorAll('rect')).map((rect) => rect.getAttribute('fill'));
    expect(fills).toEqual(['#AA151B', '#F1BF00']);
  });

  it('marks the flag decorative (the accessible name lives on the trigger)', () => {
    const { container } = render(<LocaleFlagIcon locale="es_ES" />);

    expect(container.querySelector('svg').getAttribute('aria-hidden')).toBe('true');
  });
});

describe('LocaleFlagIcon — United States branch', () => {
  it('renders a circular-clipped <svg> with seven alternating stripes and the canton', () => {
    const { container } = render(<LocaleFlagIcon locale="en_US" />);

    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg.getAttribute('viewBox')).toBe('0 0 20 20');

    const clipPath = svg.querySelector('clipPath');
    expect(clipPath.querySelector('circle').getAttribute('r')).toBe('10');
    expect(svg.querySelector('g').getAttribute('clip-path')).toBe(`url(#${clipPath.getAttribute('id')})`);

    const rects = Array.from(svg.querySelectorAll('rect'));
    const stripes = rects.slice(0, 7);
    expect(stripes).toHaveLength(7);
    expect(stripes.map((rect) => rect.getAttribute('fill'))).toEqual([
      '#B22234',
      '#FFFFFF',
      '#B22234',
      '#FFFFFF',
      '#B22234',
      '#FFFFFF',
      '#B22234',
    ]);
    expect(stripes.every((rect) => rect.getAttribute('width') === '20')).toBe(true);

    // The canton is the eighth, distinct rect in the top-left corner.
    expect(rects).toHaveLength(8);
    const canton = rects[7];
    expect(canton.getAttribute('fill')).toBe('#3C3B6E');
    expect(canton.getAttribute('x')).toBe('0');
    expect(canton.getAttribute('y')).toBe('0');
  });

  it('marks the flag decorative (the accessible name lives on the trigger)', () => {
    const { container } = render(<LocaleFlagIcon locale="en_US" />);

    expect(container.querySelector('svg').getAttribute('aria-hidden')).toBe('true');
  });
});

describe('LocaleFlagIcon — emoji fallback branch', () => {
  it.each(['de_DE', 'fr_FR', 'it_IT'])('falls back to the countryFlagEmoji glyph for %s', (locale) => {
    const region = locale.split('_')[1];
    const { container } = render(<LocaleFlagIcon locale={locale} />);
    const span = container.firstChild;

    expect(span.tagName).toBe('SPAN');
    expect(span.textContent).toBe(expectedGlyph(region));
    expect(span.textContent).not.toBe('');
    expect(span.querySelector('svg')).toBeNull();
    expect(span.getAttribute('aria-hidden')).toBe('true');
    expect(span.className).toContain('items-center');
    expect(span.className).toContain('justify-center');
    expect(span.className).toContain('rounded-full');
    expect(span.className).toContain('text-xs');
  });

  it('falls back (without crashing) for an empty or single-part locale', () => {
    for (const locale of ['', 'es', 'xx', undefined]) {
      const { container, unmount } = render(<LocaleFlagIcon locale={locale} />);
      const span = container.firstChild;

      expect(span.tagName, String(locale)).toBe('SPAN');
      expect(span.textContent, String(locale)).toBe('');
      expect(span.querySelector('svg'), String(locale)).toBeNull();
      unmount();
    }
  });
});

describe('LocaleFlagIcon — className threading', () => {
  it('appends the caller className on all three branches', () => {
    for (const locale of ['es_ES', 'en_US', 'de_DE', '']) {
      const { container, unmount } = render(<LocaleFlagIcon locale={locale} className="ring-1 ring-offset-1" />);
      const root = container.firstChild;

      expect(root.className, locale).toContain('ring-1');
      expect(root.className, locale).toContain('ring-offset-1');
      // The shared circular footprint survives the extra class.
      expect(root.className, locale).toContain('h-5 w-5');
      expect(root.className, locale).toContain('rounded-full');
      unmount();
    }
  });

  it('is also available as the default export', () => {
    expect(LocaleFlagIconDefault).toBe(LocaleFlagIcon);
  });
});
