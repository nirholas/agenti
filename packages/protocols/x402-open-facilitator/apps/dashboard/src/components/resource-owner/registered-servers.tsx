'use client';

import { useState } from 'react';
import {
  Server,
  Plus,
  Copy,
  Check,
  MoreVertical,
  Trash2,
  RefreshCw,
  Eye,
  EyeOff,
  Pencil,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import type { RegisteredServer } from './types';

interface RegisteredServersProps {
  servers: RegisteredServer[];
  onRegisterServer: (name: string) => Promise<{ apiKey?: string }>;
  onDeleteServer: (serverId: string) => Promise<void>;
  onRegenerateApiKey: (serverId: string) => Promise<{ apiKey?: string }>;
  onRenameServer?: (serverId: string, name: string) => Promise<void>;
}

export function RegisteredServers({
  servers,
  onRegisterServer,
  onDeleteServer,
  onRegenerateApiKey,
  onRenameServer,
}: RegisteredServersProps) {
  const [isAddServerOpen, setIsAddServerOpen] = useState(false);
  const [serverName, setServerName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newApiKey, setNewApiKey] = useState<string | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Rename state
  const [renameServer, setRenameServer] = useState<RegisteredServer | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleRegister = async () => {
    setIsSubmitting(true);
    try {
      const result = await onRegisterServer(serverName);
      setIsAddServerOpen(false);
      setServerName('');
      if (result.apiKey) {
        setNewApiKey(result.apiKey);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegenerate = async (serverId: string) => {
    const result = await onRegenerateApiKey(serverId);
    if (result.apiKey) {
      setNewApiKey(result.apiKey);
    }
  };

  const handleRenameClick = (server: RegisteredServer) => {
    setRenameServer(server);
    setRenameValue(server.name || '');
  };

  const handleRename = async () => {
    if (!renameServer || !onRenameServer) return;
    setIsRenaming(true);
    try {
      await onRenameServer(renameServer.id, renameValue);
      setRenameServer(null);
      setRenameValue('');
    } finally {
      setIsRenaming(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Server className="h-5 w-5" />
                API Keys
              </CardTitle>
              <CardDescription>
                Keys for reporting failures and creating refund claims.
              </CardDescription>
            </div>
            <Button onClick={() => setIsAddServerOpen(true)} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Key
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {servers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Server className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No API keys</p>
              <p className="text-sm">Add an API key to enable failure reporting.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {servers.map((server) => (
                <div
                  key={server.id}
                  className={cn(
                    "flex items-center justify-between p-4 rounded-lg border",
                    !server.active && "opacity-60"
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{server.name || 'Unnamed'}</span>
                      <Badge variant={server.active ? "default" : "secondary"}>
                        {server.active ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {onRenameServer && (
                        <DropdownMenuItem onClick={() => handleRenameClick(server)}>
                          <Pencil className="h-4 w-4 mr-2" />
                          Rename
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onClick={() => handleRegenerate(server.id)}>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Regenerate API Key
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => onDeleteServer(server.id)}
                        className="text-red-600"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add API Key Dialog */}
      <Dialog open={isAddServerOpen} onOpenChange={setIsAddServerOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create API Key</DialogTitle>
            <DialogDescription>
              Create an API key for reporting payment failures.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="serverName">Name</Label>
            <Input
              id="serverName"
              value={serverName}
              onChange={(e) => setServerName(e.target.value)}
              placeholder="Production Server"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddServerOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleRegister} disabled={!serverName || isSubmitting}>
              {isSubmitting ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New API Key Dialog */}
      <Dialog open={!!newApiKey} onOpenChange={() => setNewApiKey(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Server API Key</DialogTitle>
            <DialogDescription>
              Copy this API key now. You won&apos;t be able to see it again.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="flex-1 relative">
                <Input
                  type={showApiKey ? 'text' : 'password'}
                  value={newApiKey || ''}
                  readOnly
                  className="font-mono pr-20"
                />
                <div className="absolute right-1 top-1/2 -translate-y-1/2 flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowApiKey(!showApiKey)}
                  >
                    {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCopy(newApiKey || '', 'api-key')}
                  >
                    {copiedId === 'api-key' ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Store this key securely. Use it as the <code className="bg-muted px-1 rounded">REFUND_API_KEY</code> environment variable in your server.
            </p>
          </div>
          <DialogFooter>
            <Button onClick={() => setNewApiKey(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Server Dialog */}
      <Dialog open={!!renameServer} onOpenChange={() => setRenameServer(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename API Key</DialogTitle>
            <DialogDescription>
              Give this API key a descriptive name.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="renameName">Name</Label>
            <Input
              id="renameName"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              placeholder="Production Server"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameServer(null)}>
              Cancel
            </Button>
            <Button onClick={handleRename} disabled={isRenaming}>
              {isRenaming ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
