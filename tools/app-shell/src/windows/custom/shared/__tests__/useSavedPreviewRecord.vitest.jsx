// Mocks must come before imports (Vitest hoisting)

const mockNavigate = vi.fn();
let mockLocation = { pathname: '/orders', state: null };

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => mockLocation,
}));

import { renderHook, act } from '@testing-library/react';
import { useSavedPreviewRecord } from '../useSavedPreviewRecord.js';

describe('useSavedPreviewRecord', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLocation = { pathname: '/orders', state: null };
  });

  it('effectiveRecord is null initially when location.state has no savedRecord', () => {
    mockLocation = { pathname: '/orders', state: null };
    const { result } = renderHook(() => useSavedPreviewRecord());
    expect(result.current.effectiveRecord).toBeNull();
  });

  it('effectiveRecord is null when location.state exists but has no savedRecord', () => {
    mockLocation = { pathname: '/orders', state: { someOtherKey: 'value' } };
    const { result } = renderHook(() => useSavedPreviewRecord());
    expect(result.current.effectiveRecord).toBeNull();
  });

  it('clearSavedRecord is a function', () => {
    const { result } = renderHook(() => useSavedPreviewRecord());
    expect(typeof result.current.clearSavedRecord).toBe('function');
  });

  it('effectiveRecord returns the savedRecord from location.state when present', () => {
    const record = { id: '1', documentNo: 'DOC-001' };
    mockLocation = { pathname: '/orders', state: { savedRecord: record } };
    const { result } = renderHook(() => useSavedPreviewRecord());
    expect(result.current.effectiveRecord).toEqual(record);
  });

  it('calling clearSavedRecord does not throw', () => {
    mockLocation = { pathname: '/orders', state: null };
    const { result } = renderHook(() => useSavedPreviewRecord());
    expect(() => {
      act(() => {
        result.current.clearSavedRecord();
      });
    }).not.toThrow();
  });

  it('calling clearSavedRecord calls navigate with empty state when savedRecord exists in location', () => {
    const record = { id: '1' };
    mockLocation = { pathname: '/orders', state: { savedRecord: record } };
    const { result } = renderHook(() => useSavedPreviewRecord());
    act(() => {
      result.current.clearSavedRecord();
    });
    expect(mockNavigate).toHaveBeenCalledWith('/orders', { replace: true, state: {} });
  });

  it('calling clearSavedRecord does not call navigate when no savedRecord in location', () => {
    mockLocation = { pathname: '/orders', state: null };
    const { result } = renderHook(() => useSavedPreviewRecord());
    act(() => {
      result.current.clearSavedRecord();
    });
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
