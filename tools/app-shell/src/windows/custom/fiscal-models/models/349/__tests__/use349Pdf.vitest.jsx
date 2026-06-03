import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { use349Pdf } from '../use349Pdf.js';

vi.mock('../../../../shared/pdfUtils.js', () => ({
  renderPdf: vi.fn(),
  COMMON_HANDLEBARS_HELPERS: '',
}));

import { renderPdf } from '../../../../shared/pdfUtils.js';

beforeEach(() => {
  vi.clearAllMocks();
  globalThis.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
  globalThis.URL.revokeObjectURL = vi.fn();
});

describe('use349Pdf — initial state', () => {
  it('pdfUrl is null initially', () => {
    const { result } = renderHook(() => use349Pdf());
    expect(result.current.pdfUrl).toBeNull();
  });

  it('loading is false initially', () => {
    const { result } = renderHook(() => use349Pdf());
    expect(result.current.loading).toBe(false);
  });

  it('error is null initially', () => {
    const { result } = renderHook(() => use349Pdf());
    expect(result.current.error).toBeNull();
  });
});

describe('use349Pdf — generatePdf', () => {
  it('sets loading true while generating, false after', async () => {
    let resolveBlob;
    renderPdf.mockReturnValue(new Promise(res => { resolveBlob = res; }));

    const { result } = renderHook(() => use349Pdf());

    let generatePromise;
    act(() => {
      generatePromise = result.current.generatePdf({ year: 2026, period: 'T1' }, []);
    });

    expect(result.current.loading).toBe(true);

    await act(async () => {
      resolveBlob(new Blob(['pdf'], { type: 'application/pdf' }));
      await generatePromise;
    });

    expect(result.current.loading).toBe(false);
  });

  it('calls renderPdf with the operators data', async () => {
    const mockBlob = new Blob(['pdf'], { type: 'application/pdf' });
    renderPdf.mockResolvedValue(mockBlob);

    const operators = [
      { nif: 'IT12345678901', name: 'Test SRL', key: 'A', base: 1000 },
    ];
    const { result } = renderHook(() => use349Pdf());

    await act(async () => {
      await result.current.generatePdf({ year: 2026, period: 'T1' }, operators);
    });

    expect(renderPdf).toHaveBeenCalledTimes(1);
    const [, , , data] = renderPdf.mock.calls[0];
    expect(data.operators).toEqual(operators);
  });

  it('sets pdfUrl to object URL when renderPdf succeeds', async () => {
    const mockBlob = new Blob(['pdf'], { type: 'application/pdf' });
    renderPdf.mockResolvedValue(mockBlob);

    const { result } = renderHook(() => use349Pdf());

    await act(async () => {
      await result.current.generatePdf({ year: 2026, period: 'T1' }, []);
    });

    expect(result.current.pdfUrl).toBe('blob:mock-url');
    expect(URL.createObjectURL).toHaveBeenCalledWith(mockBlob);
  });

  it('sets error when renderPdf throws', async () => {
    renderPdf.mockRejectedValue(new Error('render failed'));

    const { result } = renderHook(() => use349Pdf());

    await act(async () => {
      await result.current.generatePdf({ year: 2026, period: 'T1' }, []);
    });

    expect(result.current.error).toBe('render failed');
    expect(result.current.pdfUrl).toBeNull();
  });

  it('includes totalAmount = sum of operator bases in data passed to renderPdf', async () => {
    const mockBlob = new Blob(['pdf'], { type: 'application/pdf' });
    renderPdf.mockResolvedValue(mockBlob);

    const operators = [
      { nif: 'DE123456789', name: 'Bayern GmbH', key: 'E', base: 500 },
      { nif: 'FR40123456789', name: 'Provence SARL', key: 'A', base: 300.5 },
    ];
    const { result } = renderHook(() => use349Pdf());

    await act(async () => {
      await result.current.generatePdf({ year: 2026, period: 'T1' }, operators);
    });

    const [, , , data] = renderPdf.mock.calls[0];
    expect(data.totalAmount).toBeCloseTo(800.5);
  });
});

describe('use349Pdf — clearPdf', () => {
  it('resets pdfUrl to null', async () => {
    const mockBlob = new Blob(['pdf'], { type: 'application/pdf' });
    renderPdf.mockResolvedValue(mockBlob);

    const { result } = renderHook(() => use349Pdf());

    await act(async () => {
      await result.current.generatePdf({ year: 2026, period: 'T1' }, []);
    });
    expect(result.current.pdfUrl).toBe('blob:mock-url');

    act(() => {
      result.current.clearPdf();
    });

    expect(result.current.pdfUrl).toBeNull();
  });

  it('revokes the object URL', async () => {
    const mockBlob = new Blob(['pdf'], { type: 'application/pdf' });
    renderPdf.mockResolvedValue(mockBlob);

    const { result } = renderHook(() => use349Pdf());

    await act(async () => {
      await result.current.generatePdf({ year: 2026, period: 'T1' }, []);
    });

    act(() => {
      result.current.clearPdf();
    });

    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
  });
});
