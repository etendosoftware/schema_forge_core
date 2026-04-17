import { useAuth } from '@/auth/AuthContext.jsx';
import { Building2, Shield } from 'lucide-react';

// TODO ETP-3690: switchContext removed — revisit if Settings UI is resurrected
export default function SettingsPage() {
  const { username, selectedRole, selectedOrg } = useAuth();

  return (
    <div className="max-w-2xl mx-auto py-10 px-6">
      <h1 className="text-2xl font-bold text-foreground mb-1">Settings</h1>
      <p className="text-sm text-muted-foreground mb-8">
        Manage your session context. Changing role or organization will re-authenticate your session.
      </p>

      {/* Current context card */}
      <div className="rounded-lg border bg-card p-5 mb-6">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Current Session
        </h2>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">User</span>
            <p className="font-medium text-foreground mt-0.5">{username || '\u2014'}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Role</span>
            <p className="font-medium text-foreground mt-0.5">{selectedRole?.name || selectedRole?.id || '\u2014'}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Organization</span>
            <p className="font-medium text-foreground mt-0.5">{selectedOrg?.name || selectedOrg?.id || '\u2014'}</p>
          </div>
        </div>
      </div>

      {/* Role & Org display (read-only — context switching removed in ETP-3690) */}
      <div className="rounded-lg border bg-card p-5">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">
          Active Context
        </h2>
        <div className="space-y-3 text-sm">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Role:</span>
            <span className="font-medium">{selectedRole?.name || selectedRole?.id || '\u2014'}</span>
          </div>
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Organization:</span>
            <span className="font-medium">{selectedOrg?.name || selectedOrg?.id || '\u2014'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
