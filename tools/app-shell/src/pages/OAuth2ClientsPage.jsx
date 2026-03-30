import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/auth/AuthContext.jsx';
import { createApiFetch } from '@/auth/api.js';
import { listClients, deleteClient, regenerateSecret, revokeTokens } from '@/lib/oauth2Api.js';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Shield, Plus, RefreshCw, Trash2, Key, MoreHorizontal, Copy, Ban } from 'lucide-react';
import { toast } from 'sonner';

function detectBaseUrl() {
  const path = window.location.pathname;
  const webIdx = path.indexOf('/web/');
  if (webIdx !== -1) return path.substring(0, webIdx);
  return import.meta.env.VITE_API_BASE || '';
}

export default function OAuth2ClientsPage() {
  const { token, logout } = useAuth();
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);

  const apiFetch = useMemo(
    () => createApiFetch(detectBaseUrl(), () => token, logout),
    [token, logout]
  );

  const fetchClients = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listClients(apiFetch);
      setClients(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to fetch OAuth2 clients:', err);
      toast.error('Failed to load clients', { description: err.message });
      setClients([]);
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  const handleDelete = async (client) => {
    if (!window.confirm(`Delete client "${client.name}"? This cannot be undone.`)) return;
    try {
      await deleteClient(apiFetch, client.id);
      toast.success('Client deleted');
      fetchClients();
    } catch (err) {
      toast.error('Failed to delete client', { description: err.message });
    }
  };

  const handleRegenerateSecret = async (client) => {
    if (!window.confirm(`Regenerate secret for "${client.name}"? The current secret will stop working immediately.`)) return;
    try {
      const result = await regenerateSecret(apiFetch, client.id);
      if (result.clientSecret) {
        await navigator.clipboard.writeText(result.clientSecret).catch(() => {});
        toast.success('Secret regenerated and copied to clipboard', {
          description: 'Store it securely — it will not be shown again.',
          duration: 10000,
        });
      } else {
        toast.success('Secret regenerated');
      }
    } catch (err) {
      toast.error('Failed to regenerate secret', { description: err.message });
    }
  };

  const handleRevokeTokens = async (client) => {
    try {
      await revokeTokens(apiFetch, client.id);
      toast.success('All tokens revoked', { description: `Tokens for "${client.name}" have been invalidated.` });
    } catch (err) {
      toast.error('Failed to revoke tokens', { description: err.message });
    }
  };

  const copyClientId = async (clientId) => {
    try {
      await navigator.clipboard.writeText(clientId);
      toast.success('Client ID copied');
    } catch {
      toast.error('Failed to copy');
    }
  };

  const handleCreate = () => {
    // D3 will add the create/edit dialog — for now show a placeholder toast
    toast.info('Create client dialog coming soon');
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">OAuth2 Clients</h2>
          <p className="text-muted-foreground">Manage MCP agent credentials</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={fetchClients} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button onClick={handleCreate}>
            <Plus className="h-4 w-4 mr-2" />
            New Client
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <RefreshCw className="h-5 w-5 animate-spin mr-2" />
              Loading clients...
            </div>
          ) : clients.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Shield className="h-12 w-12 text-muted-foreground/40 mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-1">No OAuth2 clients</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Create a client to allow MCP agents to authenticate with Etendo.
              </p>
              <Button onClick={handleCreate}>
                <Plus className="h-4 w-4 mr-2" />
                Create First Client
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Client ID</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Scopes</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead className="w-[60px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {clients.map((client) => (
                  <TableRow key={client.id}>
                    <TableCell className="font-medium">{client.name}</TableCell>
                    <TableCell>
                      <button
                        onClick={() => copyClientId(client.clientId)}
                        className="inline-flex items-center gap-1.5 font-mono text-xs text-muted-foreground hover:text-foreground transition-colors"
                        title="Click to copy"
                      >
                        {client.clientId?.slice(0, 12)}...
                        <Copy className="h-3 w-3" />
                      </button>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {client.adUserIdentifier || client.adUserId || '\u2014'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {client.adRoleIdentifier || client.adRoleId || '\u2014'}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {(client.scopes || []).map((scope) => (
                          <Badge key={scope} variant="secondary" className="text-xs">
                            {scope}
                          </Badge>
                        ))}
                        {(!client.scopes || client.scopes.length === 0) && (
                          <span className="text-xs text-muted-foreground">\u2014</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={client.isActive ? 'default' : 'outline'}>
                        {client.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleRegenerateSecret(client)}>
                            <Key className="h-4 w-4 mr-2" />
                            Regenerate Secret
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleRevokeTokens(client)}>
                            <Ban className="h-4 w-4 mr-2" />
                            Revoke Tokens
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => handleDelete(client)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
