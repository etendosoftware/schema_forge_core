import { useState, useEffect, useRef } from 'react';
import { LogOut } from 'lucide-react';
import { useAuth } from '@/auth/AuthContext.jsx';
import { useUI } from '@/i18n';

/**
 * Avatar button that opens a small user menu with identity details and logout.
 * Fully autonomous — no props needed.
 */
export function UserAvatarButton() {
  const { username, selectedRole, selectedOrg, logout } = useAuth();
  const ui = useUI();
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  const initial = username?.charAt(0).toUpperCase() || '?';
  const roleInitial = selectedRole?.name?.charAt(0).toUpperCase() || '';

  useEffect(() => {
    if (!open) return undefined;

    function handleMouseDown(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    }

    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-label={username || ui('account')}
        className="relative h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground transition-colors"
        title={username}
      >
        <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
          open
            ? 'bg-primary text-primary-foreground ring-2 ring-primary/30'
            : 'bg-primary/10 text-foreground hover:bg-primary/20'
        }`}>
          {initial}
        </div>
        {roleInitial && (
          <span className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-muted text-[8px] font-bold text-muted-foreground ring-1 ring-background">
            {roleInitial}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-20 mt-2 w-56 rounded-lg border bg-popover text-popover-foreground shadow-xl">
          <div className="border-b px-4 py-3">
            <p className="truncate text-sm font-semibold">{username || '—'}</p>
            {(selectedRole?.name || selectedOrg?.name) && (
              <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                {selectedRole?.name && (
                  <p className="truncate">{ui('role')}: {selectedRole.name}</p>
                )}
                {selectedOrg?.name && (
                  <p className="truncate">{ui('organization')}: {selectedOrg.name}</p>
                )}
              </div>
            )}
          </div>

          <div className="px-2 py-2">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                logout();
              }}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-red-500 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/20"
            >
              <LogOut className="h-3.5 w-3.5" />
              {ui('logout')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
