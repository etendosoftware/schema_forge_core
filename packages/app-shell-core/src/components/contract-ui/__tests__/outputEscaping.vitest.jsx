/**
 * ETP-4561 — characterization: record values (untrusted API/DB text) rendered by the
 * shared contract-ui option list and by plain JSX text/attributes appear as TEXT.
 * React's default escaping is the defense; no code change. Regression coverage only.
 * The grid cell / form field / record title components live in schema_forge
 * (`tools/app-shell/.../contract-ui/__tests__/output-escaping.vitest.jsx`); this covers the
 * core-owned renderers.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, cleanup } from '@testing-library/react';

import { DistinctValuesList } from '../DistinctValuesList.jsx';

afterEach(cleanup);

globalThis.IntersectionObserver = class {
  observe() {}

  unobserve() {}

  disconnect() {}
};

const PAYLOADS = [
  '<script>window.__xss = 1</script>',
  '<img src=x onerror="window.__xss = 1">',
  '"><svg onload=window.__xss=1>',
  "O'Brien & \"Sons\" <b>bold</b>",
];

describe('React text rendering of untrusted record values', () => {
  for (const payload of PAYLOADS) {
    it(`DistinctValuesList renders ${JSON.stringify(payload)} as text`, () => {
      const { container } = render(
        <DistinctValuesList
          activeCode={null}
          allLabel={null}
          codes={['k']}
          labelFor={() => payload}
          distinct={{ values: [], loading: false, loadingMore: false, hasMore: false, search: '', setSearch: vi.fn(), loadMore: vi.fn() }}
          onSelect={vi.fn()}
          searchPlaceholder="s"
        />,
      );
      expect(screen.getByText(payload)).toBeInTheDocument();
      expect(container.querySelector('script, img, svg[onload], b')).toBeNull();
      expect(window.__xss).toBeUndefined();
    });

    it(`a JSX attribute carrying ${JSON.stringify(payload)} cannot add attributes`, () => {
      const { container } = render(<span title={payload} data-testid="t">{payload}</span>);
      const el = container.querySelector('span');
      expect(el.getAttribute('title')).toBe(payload);
      expect(el.hasAttribute('onerror')).toBe(false);
      expect(el.hasAttribute('onload')).toBe(false);
      expect(el.textContent).toBe(payload);
    });
  }
});
