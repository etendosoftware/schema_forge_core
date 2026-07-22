import { describe, test, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthProvider, useAuth, createMemoryAuthStorage } from '../../auth/index.js';
import { DataProvider, useDataCache } from '../DataProvider.jsx';
import { useQuery } from '../useQuery.jsx';

function renderWithProviders(ui, { session = { token: 'tok', selectedRole: { id: 'r1' }, selectedOrg: { id: 'o1' } } } = {}) {
  return render(
    <AuthProvider storage={createMemoryAuthStorage(session)} initialSession={session}>
      <DataProvider>{ui}</DataProvider>
    </AuthProvider>,
  );
}

// Probe that exposes the cache and a control to change the selected role.
let capturedCache = null;
function CacheProbe() {
  const { cache } = useDataCache();
  const { selectRole, selectOrg } = useAuth();
  capturedCache = cache;
  return (
    <div>
      <button onClick={() => selectRole({ id: 'r2' })}>change-role</button>
      <button onClick={() => selectOrg({ id: 'o2' })}>change-org</button>
    </div>
  );
}

describe('DataProvider', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    capturedCache = null;
  });

  test('clears cached data when the selected role changes', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CacheProbe />);

    await act(async () => {
      await capturedCache.fetchQuery({
        key: { entity: 'Contact', recordId: '1' },
        fetcher: () => Promise.resolve('cached'),
      });
    });
    expect(capturedCache.size).toBe(1);

    await user.click(screen.getByText('change-role'));

    await waitFor(() => expect(capturedCache.size).toBe(0));
  });

  test('clears cached data when the selected organization changes', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CacheProbe />);

    await act(async () => {
      await capturedCache.fetchQuery({
        key: { entity: 'Contact', recordId: '1' },
        fetcher: () => Promise.resolve('cached'),
      });
    });
    expect(capturedCache.size).toBe(1);

    await user.click(screen.getByText('change-org'));

    await waitFor(() => expect(capturedCache.size).toBe(0));
  });

  test('two consumers of the same key trigger a single request', async () => {
    const fetcher = vi.fn(() => Promise.resolve('shared'));
    function Consumer({ label }) {
      const { data } = useQuery({ entity: 'Contact', recordId: '1', fetcher });
      return <span>{label}:{data ?? '...'}</span>;
    }

    renderWithProviders(
      <>
        <Consumer label="A" />
        <Consumer label="B" />
      </>,
    );

    await waitFor(() => {
      expect(screen.getByText('A:shared')).toBeInTheDocument();
      expect(screen.getByText('B:shared')).toBeInTheDocument();
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  test('cached application data is memory-only (no persistent storage writes)', async () => {
    renderWithProviders(<CacheProbe />);

    await act(async () => {
      await capturedCache.fetchQuery({
        key: { entity: 'Contact', recordId: '1' },
        fetcher: () => Promise.resolve({ secret: 'payload' }),
      });
    });

    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });
});
