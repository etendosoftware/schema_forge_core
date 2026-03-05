import { useAuth } from '@/auth/AuthContext.jsx';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button.jsx';
import { LogOut } from 'lucide-react';

export default function TopBar() {
  const { username, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <header className="h-12 border-b flex items-center justify-end px-4 gap-4 bg-background">
      <span className="text-sm text-muted-foreground">{username}</span>
      <Button variant="ghost" size="sm" onClick={handleLogout}>
        <LogOut className="h-4 w-4 mr-1" />
        Logout
      </Button>
    </header>
  );
}
