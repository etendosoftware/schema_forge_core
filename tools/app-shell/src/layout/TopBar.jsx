import { useState } from 'react';
import { useAuth } from '@/auth/AuthContext.jsx';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button.jsx';
import { LogOut, ChevronDown } from 'lucide-react';

export default function TopBar() {
  const { username, logout, roleList, selectedRole, selectedOrg, switchContext } = useAuth();
  const navigate = useNavigate();
  const [switching, setSwitching] = useState(false);

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  async function handleRoleChange(e) {
    const roleId = e.target.value;
    const role = roleList.find(r => r.id === roleId);
    const orgId = role?.orgList?.[0]?.id;
    setSwitching(true);
    try {
      await switchContext(roleId, orgId);
      window.location.reload();
    } catch (err) {
      console.error('Failed to switch role:', err);
    } finally {
      setSwitching(false);
    }
  }

  async function handleOrgChange(e) {
    const orgId = e.target.value;
    setSwitching(true);
    try {
      await switchContext(selectedRole?.id, orgId);
      window.location.reload();
    } catch (err) {
      console.error('Failed to switch org:', err);
    } finally {
      setSwitching(false);
    }
  }

  const orgs = selectedRole?.orgList || [];

  return (
    <header className="h-14 border-b flex items-center justify-between px-6 gap-4 bg-white">
      <div className="flex items-center gap-4">
        {roleList.length > 0 && (
          <>
            <div className="flex items-center gap-1.5">
              <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Role</label>
              <select
                value={selectedRole?.id || ''}
                onChange={handleRoleChange}
                disabled={switching}
                className="h-8 px-2 pr-7 rounded-md border border-input bg-background text-sm font-medium focus:outline-none focus:ring-2 focus:ring-ring appearance-none cursor-pointer"
              >
                {roleList.map(r => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-1.5">
              <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Org</label>
              <select
                value={selectedOrg?.id || ''}
                onChange={handleOrgChange}
                disabled={switching}
                className="h-8 px-2 pr-7 rounded-md border border-input bg-background text-sm font-medium focus:outline-none focus:ring-2 focus:ring-ring appearance-none cursor-pointer"
              >
                {orgs.map(o => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
            </div>
            {switching && (
              <span className="text-xs text-muted-foreground animate-pulse">Switching...</span>
            )}
          </>
        )}
      </div>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
            <span className="text-xs font-semibold text-primary">{username?.charAt(0).toUpperCase()}</span>
          </div>
          <span className="text-sm font-medium text-foreground">{username}</span>
        </div>
        <Button variant="ghost" size="sm" onClick={handleLogout} className="text-muted-foreground hover:text-foreground">
          <LogOut className="h-4 w-4 mr-1" />
          Logout
        </Button>
      </div>
    </header>
  );
}
