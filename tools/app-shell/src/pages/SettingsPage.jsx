import { useState } from 'react';
import { useAuth } from '@/auth/AuthContext.jsx';
import { Building2, Shield, RefreshCw, Check, KeyRound } from 'lucide-react';

export default function SettingsPage() {
  const { username, roleList, selectedRole, selectedOrg, switchContext } = useAuth();

  const [pendingRoleId, setPendingRoleId] = useState(selectedRole?.id || '');
  const [pendingOrgId, setPendingOrgId] = useState(selectedOrg?.id || '');
  const [password, setPassword] = useState('');
  const [needsPassword, setNeedsPassword] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const pendingRole = roleList.find(r => r.id === pendingRoleId);
  const orgOptions = pendingRole?.orgList || [];

  const handleRoleChange = (e) => {
    const roleId = e.target.value;
    setPendingRoleId(roleId);
    const role = roleList.find(r => r.id === roleId);
    setPendingOrgId(role?.orgList?.[0]?.id || '');
    setSuccess(false);
    setError(null);
  };

  const handleOrgChange = (e) => {
    setPendingOrgId(e.target.value);
    setSuccess(false);
    setError(null);
  };

  const hasChanges = pendingRoleId !== (selectedRole?.id || '') ||
                     pendingOrgId !== (selectedOrg?.id || '');

  const handleApply = async () => {
    if (!pendingRoleId || !pendingOrgId) return;
    setSwitching(true);
    setError(null);
    setSuccess(false);
    try {
      await switchContext(pendingRoleId, pendingOrgId, needsPassword ? password : undefined);
      setSuccess(true);
      setNeedsPassword(false);
      setPassword('');
    } catch (e) {
      if (e.message === 'SESSION_EXPIRED') {
        setNeedsPassword(true);
        setError('Session expired. Please enter your password to switch context.');
      } else {
        setError(e.message || 'Failed to switch context.');
      }
    } finally {
      setSwitching(false);
    }
  };

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

      {/* Role & Org picker */}
      <div className="rounded-lg border bg-card p-5">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">
          Switch Context
        </h2>

        <div className="space-y-4">
          {/* Role selector */}
          <div>
            <label htmlFor="role-select" className="flex items-center gap-2 text-sm font-medium text-foreground mb-1.5">
              <Shield className="h-4 w-4 text-muted-foreground" />
              Role
            </label>
            <select
              id="role-select"
              value={pendingRoleId}
              onChange={handleRoleChange}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              <option value="" disabled>Select a role...</option>
              {roleList.map(r => (
                <option key={r.id} value={r.id}>{r.name || r.id}</option>
              ))}
            </select>
          </div>

          {/* Org selector */}
          <div>
            <label htmlFor="org-select" className="flex items-center gap-2 text-sm font-medium text-foreground mb-1.5">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              Organization
            </label>
            <select
              id="org-select"
              value={pendingOrgId}
              onChange={handleOrgChange}
              disabled={orgOptions.length === 0}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:opacity-50"
            >
              <option value="" disabled>Select an organization...</option>
              {orgOptions.map(o => (
                <option key={o.id} value={o.id}>{o.name || o.id}</option>
              ))}
            </select>
          </div>

          {/* Password field (shown when session expired) */}
          {needsPassword && (
            <div>
              <label htmlFor="password-input" className="flex items-center gap-2 text-sm font-medium text-foreground mb-1.5">
                <KeyRound className="h-4 w-4 text-muted-foreground" />
                Password
              </label>
              <input
                id="password-input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleApply()}
                placeholder="Enter your password..."
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              />
            </div>
          )}
        </div>

        {/* Apply button */}
        <div className="mt-5 flex items-center gap-3">
          <button
            onClick={handleApply}
            disabled={!hasChanges || switching || !pendingRoleId || !pendingOrgId || (needsPassword && !password)}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:pointer-events-none"
          >
            {switching ? (
              <><RefreshCw className="h-4 w-4 animate-spin" /> Switching...</>
            ) : (
              'Apply'
            )}
          </button>
          {success && (
            <span className="flex items-center gap-1 text-sm text-green-600">
              <Check className="h-4 w-4" /> Context updated
            </span>
          )}
          {error && (
            <span className="text-sm text-destructive">{error}</span>
          )}
        </div>
      </div>
    </div>
  );
}
