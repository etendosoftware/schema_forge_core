import { renderHook, act } from '@testing-library/react';
import { toast } from 'sonner';
import { useBulkActionToast, persistBulkActionResult } from '../useBulkActionToast';

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/i18n', () => ({
  useUI: () => (key) => {
    const map = {
      processExecuted: '{ok} processed, {failed} failed',
    };
    return map[key] || key;
  },
}));

describe('useBulkActionToast', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  it('showResult calls toast.success when all ok and no failures', () => {
    const { result } = renderHook(() => useBulkActionToast());
    act(() => {
      result.current.showResult({ ok: 5, failed: [] });
    });
    expect(toast.success).toHaveBeenCalledWith('5 processed, 0 failed');
  });

  it('showResult calls toast.warning when some ok and some failures', () => {
    const { result } = renderHook(() => useBulkActionToast());
    act(() => {
      result.current.showResult({ ok: 3, failed: ['err1', 'err2'] });
    });
    expect(toast.warning).toHaveBeenCalledWith('3 processed, 2 failed');
  });

  it('showResult calls toast.error when all failed', () => {
    const { result } = renderHook(() => useBulkActionToast());
    act(() => {
      result.current.showResult({ ok: 0, failed: ['err1'] });
    });
    expect(toast.error).toHaveBeenCalledWith('0 processed, 1 failed');
  });

  it('showResult with persist=true stores in sessionStorage', () => {
    const { result } = renderHook(() => useBulkActionToast());
    act(() => {
      result.current.showResult({ ok: 2, failed: [] }, { persist: true });
    });
    const stored = JSON.parse(sessionStorage.getItem('bulkActionResult'));
    expect(stored.ok).toBe(2);
    expect(stored.failed).toEqual([]);
  });

  it('reads and clears persisted result on mount', () => {
    persistBulkActionResult({ ok: 4, failed: ['x'] });
    renderHook(() => useBulkActionToast());
    // Should have shown toast from persisted result
    expect(toast.warning).toHaveBeenCalledWith('4 processed, 1 failed');
    // Should have cleared storage
    expect(sessionStorage.getItem('bulkActionResult')).toBeNull();
  });

  it('handles null/undefined result gracefully', () => {
    const { result } = renderHook(() => useBulkActionToast());
    act(() => {
      result.current.showResult(null);
    });
    expect(toast.success).toHaveBeenCalledWith('0 processed, 0 failed');
  });
});
