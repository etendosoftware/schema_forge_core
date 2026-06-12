import { renderHook, act } from '@testing-library/react';
import {
  useAppStoreUnlock,
  unlockAppStore,
  lockAppStore,
  isAppStoreUnlocked,
  attachKeySequenceWatcher,
} from '../useAppStoreUnlock';

describe('useAppStoreUnlock', () => {
  beforeEach(() => {
    localStorage.clear();
    lockAppStore(); // reset to locked
  });

  describe('unlockAppStore / lockAppStore', () => {
    it('unlockAppStore sets the store to unlocked', () => {
      unlockAppStore();
      expect(isAppStoreUnlocked()).toBe(true);
      expect(localStorage.getItem('etendo.appStoreUnlocked')).toBe('1');
    });

    it('lockAppStore removes the flag', () => {
      unlockAppStore();
      lockAppStore();
      expect(isAppStoreUnlocked()).toBe(false);
      expect(localStorage.getItem('etendo.appStoreUnlocked')).toBeNull();
    });
  });

  describe('useAppStoreUnlock hook', () => {
    it('returns false by default', () => {
      const { result } = renderHook(() => useAppStoreUnlock());
      expect(result.current).toBe(false);
    });

    it('reacts to unlockAppStore', () => {
      const { result } = renderHook(() => useAppStoreUnlock());
      act(() => {
        unlockAppStore();
      });
      expect(result.current).toBe(true);
    });

    it('reacts to lockAppStore after unlock', () => {
      const { result } = renderHook(() => useAppStoreUnlock());
      act(() => { unlockAppStore(); });
      act(() => { lockAppStore(); });
      expect(result.current).toBe(false);
    });
  });

  describe('attachKeySequenceWatcher', () => {
    it('returns a dispose function', () => {
      const dispose = attachKeySequenceWatcher();
      expect(typeof dispose).toBe('function');
      dispose();
    });

    it('unlocks on typing "playstoreon"', () => {
      const onUnlock = vi.fn();
      const dispose = attachKeySequenceWatcher({ onUnlock });

      for (const ch of 'playstoreon') {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: ch }));
      }

      expect(isAppStoreUnlocked()).toBe(true);
      expect(onUnlock).toHaveBeenCalledTimes(1);
      dispose();
    });

    it('locks on typing "playstoreoff" when unlocked', () => {
      unlockAppStore();
      const onLock = vi.fn();
      const dispose = attachKeySequenceWatcher({ onLock });

      for (const ch of 'playstoreoff') {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: ch }));
      }

      expect(isAppStoreUnlocked()).toBe(false);
      expect(onLock).toHaveBeenCalledTimes(1);
      dispose();
    });

    it('ignores keystrokes in INPUT elements', () => {
      const dispose = attachKeySequenceWatcher();
      const input = document.createElement('input');
      document.body.appendChild(input);

      for (const ch of 'playstoreon') {
        input.dispatchEvent(new KeyboardEvent('keydown', { key: ch, bubbles: true }));
      }

      expect(isAppStoreUnlocked()).toBe(false);
      document.body.removeChild(input);
      dispose();
    });

    it('ignores non-single-character keys', () => {
      const dispose = attachKeySequenceWatcher();
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Shift' }));
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
      expect(isAppStoreUnlocked()).toBe(false);
      dispose();
    });
  });
});
