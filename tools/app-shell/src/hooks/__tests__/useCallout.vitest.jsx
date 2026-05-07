import { renderHook, act, waitFor } from '@testing-library/react';
import { useCallout } from '../useCallout';

// Mock sonner toast so it does not throw
vi.mock('sonner', () => ({
  toast: {
    info: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}));

describe('useCallout', () => {
  const opts = { token: 'test-token', apiBaseUrl: 'http://localhost/api' };

  beforeEach(() => {
    vi.useFakeTimers();
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('starts with calloutResult=null and calloutLoading=false', () => {
    const { result } = renderHook(() => useCallout('header', opts));

    expect(result.current.calloutResult).toBeNull();
    expect(result.current.calloutLoading).toBe(false);
  });

  it('does not call fetch until debounce period elapses (300ms)', () => {
    globalThis.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ updates: {}, combos: {}, messages: [] }),
    });

    const { result } = renderHook(() => useCallout('header', opts));

    act(() => {
      result.current.executeCallout('businessPartner', 'BP001', { id: '1' });
    });

    // Before debounce
    expect(globalThis.fetch).not.toHaveBeenCalled();

    // After debounce
    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it('fetches the correct callout endpoint', async () => {
    globalThis.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ updates: {}, combos: {}, messages: [] }),
    });

    const { result } = renderHook(() => useCallout('header', opts));

    act(() => {
      result.current.executeCallout('businessPartner', 'BP001', { id: '1' });
    });

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'http://localhost/api/header/callout',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-token',
        }),
      }),
    );
  });

  it('sends field, value, and formState in the request body', async () => {
    globalThis.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ updates: {}, combos: {}, messages: [] }),
    });

    const formState = { id: '1', businessPartner: 'BP001', amount: 100 };
    const { result } = renderHook(() => useCallout('header', opts));

    act(() => {
      result.current.executeCallout('businessPartner', 'BP001', formState);
    });

    act(() => {
      vi.advanceTimersByTime(300);
    });

    const body = JSON.parse(globalThis.fetch.mock.calls[0][1].body);
    expect(body.field).toBe('businessPartner');
    expect(body.value).toBe('BP001');
    expect(body.formState).toEqual(formState);
  });

  it('extracts auxiliary values from formState', async () => {
    globalThis.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ updates: {}, combos: {}, messages: [] }),
    });

    const formState = { id: '1', businessPartner_LOC: 'ES', warehouse_WH: 'WH1' };
    const { result } = renderHook(() => useCallout('header', opts));

    act(() => {
      result.current.executeCallout('field1', 'val', formState);
    });

    act(() => {
      vi.advanceTimersByTime(300);
    });

    const body = JSON.parse(globalThis.fetch.mock.calls[0][1].body);
    expect(body.auxiliaryValues).toEqual({
      businessPartner_LOC: 'ES',
      warehouse_WH: 'WH1',
    });
  });

  it('sets calloutResult when updates are returned', async () => {
    vi.useRealTimers();

    globalThis.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        updates: { priceList: 150 },
        combos: {},
        messages: [],
      }),
    });

    const { result } = renderHook(() => useCallout('header', opts));

    act(() => {
      result.current.executeCallout('businessPartner', 'BP001', { id: '1' });
    });

    await waitFor(() => {
      expect(result.current.calloutResult).toEqual({
        updates: { priceList: 150 },
        combos: {},
        triggerField: 'businessPartner',
      });
    });

    vi.useFakeTimers();
  });

  it('sets calloutResult to null when no updates or combos', async () => {
    vi.useRealTimers();

    globalThis.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ updates: {}, combos: {}, messages: [] }),
    });

    const { result } = renderHook(() => useCallout('header', opts));

    act(() => {
      result.current.executeCallout('field1', 'val', { id: '1' });
    });

    await waitFor(() => {
      expect(result.current.calloutLoading).toBe(false);
    });

    expect(result.current.calloutResult).toBeNull();
    vi.useFakeTimers();
  });

  it('debounces multiple rapid calls for the same field', () => {
    globalThis.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ updates: {}, combos: {}, messages: [] }),
    });

    const { result } = renderHook(() => useCallout('header', opts));

    act(() => {
      result.current.executeCallout('field1', 'a', { id: '1' });
      result.current.executeCallout('field1', 'ab', { id: '1' });
      result.current.executeCallout('field1', 'abc', { id: '1' });
    });

    act(() => {
      vi.advanceTimersByTime(300);
    });

    // Only one fetch for the last value
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    const body = JSON.parse(globalThis.fetch.mock.calls[0][1].body);
    expect(body.value).toBe('abc');
  });

  it('does not call fetch when field is empty', () => {
    const { result } = renderHook(() => useCallout('header', opts));

    act(() => {
      result.current.executeCallout('', 'value', {});
    });

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('does not call fetch when token is missing', () => {
    const { result } = renderHook(() =>
      useCallout('header', { token: '', apiBaseUrl: 'http://localhost' })
    );

    act(() => {
      result.current.executeCallout('field1', 'val', {});
    });

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('handles non-ok response without crashing', async () => {
    vi.useRealTimers();

    globalThis.fetch.mockResolvedValue({ ok: false, status: 500 });

    const { result } = renderHook(() => useCallout('header', opts));

    act(() => {
      result.current.executeCallout('field1', 'val', { id: '1' });
    });

    await waitFor(() => {
      expect(result.current.calloutLoading).toBe(false);
    });

    // Should not crash, result stays null
    expect(result.current.calloutResult).toBeNull();
    vi.useFakeTimers();
  });
});
