import { useAuth } from '@/auth/AuthContext.jsx';

/**
 * Avatar button for the top-right header area.
 * Shows user initial and toggles the context switcher popover.
 */
export function UserAvatarButton({ isOpen, onClick }) {
  const { username, selectedRole } = useAuth();
  const initial = username?.charAt(0).toUpperCase() || '?';
  const roleInitial = selectedRole?.name?.charAt(0).toUpperCase() || '';

  return (
    <button
      onClick={onClick}
      className="relative h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground transition-colors"
      title={username}
    >
      <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
        isOpen
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
  );
}
