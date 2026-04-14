import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/auth/AuthContext.jsx';
import { createApiFetch } from '@/auth/api.js';
import { listClients, deleteClient, regenerateSecret, revokeTokens } from '@/lib/oauth2Api.js';
import OAuth2ClientDialog, { SecretRevealDialog, ConfirmDialog } from '@/components/OAuth2ClientDialog.jsx';
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
import { Shield, Plus, RefreshCw, Trash2, Key, MoreHorizontal, Copy, Ban, Pencil } from 'lucide-react';
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

  // Create/Edit dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState(null);

  // Confirmation dialog state
  const [confirmState, setConfirmState] = useState({
    open: false,
    title: '',
    description: '',
    confirmLabel: 'Confirm',
    variant: 'default',
    onConfirm: null,
  });
  const [confirmLoading, setConfirmLoading] = useState(false);

  // Secret reveal after regenerate
  const [revealSecret, setRevealSecret] = useState(null);

  const handleCreate = () => {
    setEditingClient(null);
    setDialogOpen(true);
  };

  const handleEdit = (client) => {
    setEditingClient(client);
    setDialogOpen(true);
  };

  const handleDelete = (client) => {
    setConfirmState({
      open: true,
      title: `Delete "${client.name}"?`,
      description:
        'This will permanently delete the client and revoke all its tokens. This action cannot be undone.',
      confirmLabel: 'Delete',
      variant: 'destructive',
      onConfirm: async () => {
        setConfirmLoading(true);
        try {
          await deleteClient(apiFetch, client.id);
          toast.success('Client deleted');
          setConfirmState((s) => ({ ...s, open: false }));
          fetchClients();
        } catch (err) {
          toast.error('Failed to delete client', { description: err.message });
        } finally {
          setConfirmLoading(false);
        }
      },
    });
  };

  const handleRegenerateSecret = (client) => {
    setConfirmState({
      open: true,
      title: `Regenerate secret for "${client.name}"?`,
      description:
        'Are you sure? The current secret will be invalidated immediately. Any agents using the old secret will stop working.',
      confirmLabel: 'Regenerate',
      variant: 'destructive',
      onConfirm: async () => {
        setConfirmLoading(true);
        try {
          const result = await regenerateSecret(apiFetch, client.id);
          setConfirmState((s) => ({ ...s, open: false }));
          if (result.clientSecret) {
            setRevealSecret({
              clientId: result.clientId || client.clientId,
              clientSecret: result.clientSecret,
            });
          } else {
            toast.success('Secret regenerated');
          }
        } catch (err) {
          toast.error('Failed to regenerate secret', { description: err.message });
        } finally {
          setConfirmLoading(false);
        }
      },
    });
  };

  const handleRevokeTokens = (client) => {
    setConfirmState({
      open: true,
      title: `Revoke tokens for "${client.name}"?`,
      description:
        'This will invalidate all active tokens for this client. Agents will need to re-authenticate.',
      confirmLabel: 'Revoke All',
      variant: 'destructive',
      onConfirm: async () => {
        setConfirmLoading(true);
        try {
          await revokeTokens(apiFetch, client.id);
          toast.success('All tokens revoked', {
            description: `Tokens for "${client.name}" have been invalidated.`,
          });
          setConfirmState((s) => ({ ...s, open: false }));
        } catch (err) {
          toast.error('Failed to revoke tokens', { description: err.message });
        } finally {
          setConfirmLoading(false);
        }
      },
    });
  };

  const copyClientId = async (clientId) => {
    try {
      await navigator.clipboard.writeText(clientId);
      toast.success('Client ID copied');
    } catch {
      toast.error('Failed to copy');
    }
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
                          <span className="text-xs text-muted-foreground">{'\u2014'}</span>
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
                          <DropdownMenuItem onClick={() => handleEdit(client)}>
                            <Pencil className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
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

      {/* Create/Edit dialog */}
      <OAuth2ClientDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        client={editingClient}
        apiFetch={apiFetch}
        onSuccess={fetchClients}
      />

      {/* Confirmation dialog (delete, regenerate, revoke) */}
      <ConfirmDialog
        open={confirmState.open}
        onOpenChange={(v) => {
          if (!v) setConfirmState((s) => ({ ...s, open: false }));
        }}
        title={confirmState.title}
        description={confirmState.description}
        confirmLabel={confirmState.confirmLabel}
        variant={confirmState.variant}
        loading={confirmLoading}
        onConfirm={confirmState.onConfirm}
      />

      {/* Secret reveal after regenerate */}
      {revealSecret && (
        <SecretRevealDialog
          open={!!revealSecret}
          onClose={() => setRevealSecret(null)}
          clientId={revealSecret.clientId}
          clientSecret={revealSecret.clientSecret}
        />
      )}
    </div>
  );
}
