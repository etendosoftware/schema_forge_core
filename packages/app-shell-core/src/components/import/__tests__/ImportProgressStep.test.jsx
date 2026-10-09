// @covers packages/app-shell-core/src/components/import/ImportProgressStep.jsx
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { ImportProgressStep } from '../ImportProgressStep.jsx';

afterEach(() => {
  cleanup();
});

describe('ImportProgressStep', () => {
  it('shows the percent value', () => {
    render(<ImportProgressStep percent={42} />);
    expect(screen.getByTestId('ImportProgressStep__percent').textContent).toBe('42%');
  });

  it('sets the progress bar width to the percent value', () => {
    render(<ImportProgressStep percent={42} />);
    expect(screen.getByTestId('ImportProgressStep__bar').style.width).toBe('42%');
  });

  // ETP-5676 — a bare percentage is not reassuring on a 2,000-row file.
  describe('processed counter', () => {
    beforeEach(() => localStorage.setItem('schema-forge-locale', 'en_US'));
    afterEach(() => localStorage.removeItem('schema-forge-locale'));

    it('shows processed / total next to the percentage', () => {
      render(<ImportProgressStep percent={62} processed={1234} total={2000} />);
      expect(screen.getByTestId('ImportProgressStep__counter').textContent).toBe('1,234 / 2,000 processed');
    });

    it('groups thousands per the session locale, including four-digit numbers', () => {
      localStorage.setItem('schema-forge-locale', 'es_ES');
      render(<ImportProgressStep percent={62} processed={1234} total={2000} />);
      expect(screen.getByTestId('ImportProgressStep__counter').textContent).toBe('1.234 / 2.000 processed');
    });

    it('uses the translated template and keeps the counter in a polite live region', () => {
      render(<ImportProgressStep percent={50} processed={1} total={2} labels={{ counter: '{processed} de {total} procesados' }} />);
      const counter = screen.getByTestId('ImportProgressStep__counter');
      expect(counter.textContent).toBe('1 de 2 procesados');
      expect(counter.getAttribute('aria-live')).toBe('polite');
    });

    it('renders no counter when the caller reports no total', () => {
      render(<ImportProgressStep percent={50} />);
      expect(screen.queryByTestId('ImportProgressStep__counter')).toBeNull();
    });
  });
});
