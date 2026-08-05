import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import { createMemoryAuthStorage } from '../session.js';
import { AuthProvider, useAuth } from '../AuthContext.jsx';
import { WindowAccessGuard } from '../WindowAccessGuard.jsx';

afterEach(cleanup);

// ETP-4576 cycle 4a — `restoreSession` is no longer opt-in: AuthProvider defaults
// it to the platform cookie fetcher (fetchCookieSession). Every provider mounted
// without the prop would therefore call `fetch` on mount, fail under jsdom, and
// take the fail-closed path — which runs logout(), wiping the very
// windowAccess/capabilities these tests just seeded via selectRole().
// This suite's subject is the guard's tier gating, NOT the session restore, so we
// neutralise the default with a never-settling override: the provider parks in
// 'booting', no purge/logout ever fires, the default fetcher is never invoked (so
// no `fetch` stub is needed either), and every assertion below keeps verifying
// exactly what it verified before the default existed. Do not remove.
const NEVER_SETTLES = () => new Promise(() => {});

function RoleSelector({ role }) {
  const { selectRole } = useAuth();
  return (
    <button type="button" data-testid="select-role" onClick={() => selectRole(role)}>
      select
    </button>
  );
}

function renderGuarded({ fetchWindowAccess, windowId = '147' } = {}) {
  return render(
    <AuthProvider
      storage={createMemoryAuthStorage()}
      fetchWindowAccess={fetchWindowAccess}
      restoreSession={NEVER_SETTLES}>
      <RoleSelector role={{ id: 'role-1' }} />
      <WindowAccessGuard windowId={windowId}>
        <div data-testid="protected-content">Protected</div>
      </WindowAccessGuard>
    </AuthProvider>,
  );
}

describe('WindowAccessGuard (ETP-4520)', () => {
  it('blocks rendering and shows the denied message for the "none" tier (map not yet loaded)', () => {
    renderGuarded();

    expect(screen.getByTestId('window-access-denied')).toBeInTheDocument();
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
  });

  it('blocks rendering when windowId is missing (fail closed)', () => {
    render(
      <AuthProvider storage={createMemoryAuthStorage()} restoreSession={NEVER_SETTLES}>
        <WindowAccessGuard>
          <div data-testid="protected-content">Protected</div>
        </WindowAccessGuard>
      </AuthProvider>,
    );

    expect(screen.getByTestId('window-access-denied')).toBeInTheDocument();
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
  });

  it('renders children unchanged once the map resolves to "full"', async () => {
    renderGuarded({
      fetchWindowAccess: async () => ({ windowAccess: { '147': 'full' }, capabilities: {} }),
    });
    expect(screen.getByTestId('window-access-denied')).toBeInTheDocument();

    await act(async () => {
      screen.getByTestId('select-role').click();
    });

    expect(await screen.findByTestId('protected-content')).toBeInTheDocument();
    expect(screen.queryByTestId('window-access-denied')).not.toBeInTheDocument();
  });

  it('renders children unchanged for the "read-only" tier (visibility gating only; field-level read-only is enforced downstream)', async () => {
    renderGuarded({
      fetchWindowAccess: async () => ({ windowAccess: { '147': 'read-only' }, capabilities: {} }),
    });

    await act(async () => {
      screen.getByTestId('select-role').click();
    });

    expect(await screen.findByTestId('protected-content')).toBeInTheDocument();
    expect(screen.queryByTestId('window-access-denied')).not.toBeInTheDocument();
  });

  it('stays blocked when the resolved map has no entry for this windowId', async () => {
    renderGuarded({
      fetchWindowAccess: async () => ({ windowAccess: { '999-other': 'full' }, capabilities: {} }),
    });

    await act(async () => {
      screen.getByTestId('select-role').click();
    });

    expect(screen.getByTestId('window-access-denied')).toBeInTheDocument();
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
  });
});
