import { renderHook, act } from '@testing-library/react';
import { useBarcodeScanner } from '../useBarcodeScanner';

describe('useBarcodeScanner', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns lastScan=null and scanCount=0 initially', () => {
    const onScan = vi.fn();
    const { result } = renderHook(() => useBarcodeScanner({ onScan }));
    expect(result.current.lastScan).toBeNull();
    expect(result.current.scanCount).toBe(0);
  });

  it('detects a barcode from rapid keystrokes followed by Enter', () => {
    const onScan = vi.fn();
    const { result } = renderHook(() => useBarcodeScanner({ onScan }));

    act(() => {
      for (const ch of 'ABC123') {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: ch, bubbles: true }));
      }
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });

    expect(onScan).toHaveBeenCalledWith('ABC123');
    expect(result.current.lastScan).toBe('ABC123');
    expect(result.current.scanCount).toBe(1);
  });

  it('ignores short sequences (< 3 chars)', () => {
    const onScan = vi.fn();
    renderHook(() => useBarcodeScanner({ onScan }));

    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'A', bubbles: true }));
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'B', bubbles: true }));
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });

    expect(onScan).not.toHaveBeenCalled();
  });

  it('does not scan when enabled=false', () => {
    const onScan = vi.fn();
    renderHook(() => useBarcodeScanner({ onScan, enabled: false }));

    act(() => {
      for (const ch of 'BARCODE') {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: ch, bubbles: true }));
      }
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });

    expect(onScan).not.toHaveBeenCalled();
  });

  it('fires on idle timeout for rapid chars without Enter', () => {
    const onScan = vi.fn();
    renderHook(() => useBarcodeScanner({ onScan }));

    act(() => {
      for (const ch of 'SCAN1') {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: ch, bubbles: true }));
      }
    });

    // Idle timeout triggers after 100ms
    act(() => {
      vi.advanceTimersByTime(150);
    });

    expect(onScan).toHaveBeenCalledWith('SCAN1');
  });
});
