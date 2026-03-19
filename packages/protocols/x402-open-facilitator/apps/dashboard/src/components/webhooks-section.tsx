'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Webhook,
  Plus,
  Copy,
  Check,
  Loader2,
  MoreVertical,
  Trash2,
  Pencil,
  ToggleLeft,
  ToggleRight,
  Play,
  RefreshCw,
  Eye,
  EyeOff,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
import { Badge } from '@/components/ui/badge';
import { api, type Webhook as WebhookType, type Facilitator } from '@/lib/api';
import { cn } from '@/lib/utils';

interface WebhooksSectionProps {
  facilitatorId: string;
  facilitator: Facilitator;
}

const EVENT_OPTIONS = [
  { value: 'payment_link.payment', label: 'Payment Link Payment' },
  { value: 'payment.settled', label: 'Payment Settled' },
];

export function WebhooksSection({ facilitatorId, facilitator }: WebhooksSectionProps) {
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingWebhook, setEditingWebhook] = useState<WebhookType | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [newSecret, setNewSecret] = useState<string | null>(null);
  const [showSecret, setShowSecret] = useState(false);
  const [testResult, setTestResult] = useState<{ webhookId: string; success: boolean; message: string } | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [events, setEvents] = useState<string[]>(['payment_link.payment']);

  const { data, isLoading } = useQuery({
    queryKey: ['webhooks', facilitatorId],
    queryFn: () => api.getWebhooks(facilitatorId),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      api.createWebhook(facilitatorId, {
        name,
        url,
        events,
      }),
    onSuccess: (webhook) => {
      queryClient.invalidateQueries({ queryKey: ['webhooks', facilitatorId] });
      setIsCreateOpen(false);
      if (webhook.secret) {
        setNewSecret(webhook.secret);
      }
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: { webhookId: string; updates: Parameters<typeof api.updateWebhookEntity>[2] }) =>
      api.updateWebhookEntity(facilitatorId, data.webhookId, data.updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks', facilitatorId] });
      setIsEditOpen(false);
      setEditingWebhook(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (webhookId: string) => api.deleteWebhookEntity(facilitatorId, webhookId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks', facilitatorId] });
    },
  });

  const regenerateSecretMutation = useMutation({
    mutationFn: (webhookId: string) => api.regenerateWebhookEntitySecret(facilitatorId, webhookId),
    onSuccess: (result) => {
      setNewSecret(result.secret);
    },
  });

  const testMutation = useMutation({
    mutationFn: (webhookId: string) => api.testWebhookEntity(facilitatorId, webhookId),
    onSuccess: (result, webhookId) => {
      setTestResult({ webhookId, success: result.success, message: result.message });
      setTimeout(() => setTestResult(null), 5000);
    },
  });

  const resetForm = () => {
    setName('');
    setUrl('');
    setEvents(['payment_link.payment']);
  };

  const openEdit = (webhook: WebhookType) => {
    setEditingWebhook(webhook);
    setName(webhook.name);
    setUrl(webhook.url);
    setEvents(webhook.events);
    setIsEditOpen(true);
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const toggleEvent = (event: string) => {
    if (events.includes(event)) {
      setEvents(events.filter(e => e !== event));
    } else {
      setEvents([...events, event]);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Webhook className="h-5 w-5" />
                Webhooks
              </CardTitle>
              <CardDescription>
                Create webhooks to receive notifications and trigger actions when payments are made.
              </CardDescription>
            </div>
            <Button onClick={() => setIsCreateOpen(true)} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Create Webhook
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !data?.webhooks.length ? (
            <div className="text-center py-8 text-muted-foreground">
              <Webhook className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No webhooks yet</p>
              <p className="text-sm">Create a webhook to receive real-time notifications.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {data.webhooks.map((webhook) => (
                <div
                  key={webhook.id}
                  className={cn(
                    "flex items-center justify-between p-4 rounded-lg border",
                    !webhook.active && "opacity-60"
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{webhook.name}</span>
                      <Badge variant={webhook.active ? "default" : "secondary"}>
                        {webhook.active ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground truncate mt-1">
                      {webhook.url}
                    </p>
                    <div className="flex gap-1 mt-2">
                      {webhook.events.map((event) => (
                        <Badge key={event} variant="secondary" className="text-xs">
                          {event}
                        </Badge>
                      ))}
                    </div>
                    {testResult?.webhookId === webhook.id && (
                      <p className={cn(
                        "text-sm mt-2",
                        testResult.success ? "text-green-600" : "text-red-600"
                      )}>
                        {testResult.message}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => testMutation.mutate(webhook.id)}
                      disabled={testMutation.isPending}
                    >
                      {testMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Play className="h-4 w-4" />
                      )}
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(webhook)}>
                          <Pencil className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() =>
                            updateMutation.mutate({
                              webhookId: webhook.id,
                              updates: { active: !webhook.active },
                            })
                          }
                        >
                          {webhook.active ? (
                            <>
                              <ToggleLeft className="h-4 w-4 mr-2" />
                              Deactivate
                            </>
                          ) : (
                            <>
                              <ToggleRight className="h-4 w-4 mr-2" />
                              Activate
                            </>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => regenerateSecretMutation.mutate(webhook.id)}>
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Regenerate Secret
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => deleteMutation.mutate(webhook.id)}
                          className="text-red-600"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Webhook Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Create Webhook</DialogTitle>
            <DialogDescription>
              Configure a webhook to receive notifications when events occur.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Payment Notifications"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="url">URL</Label>
              <Input
                id="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://your-server.com/webhooks"
              />
            </div>
            <div className="grid gap-2">
              <Label>Events</Label>
              <div className="flex flex-wrap gap-2">
                {EVENT_OPTIONS.map((event) => (
                  <Badge
                    key={event.value}
                    variant={events.includes(event.value) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => toggleEvent(event.value)}
                  >
                    {event.label}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={!name || !url || events.length === 0 || createMutation.isPending}
            >
              {createMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Create Webhook
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Webhook Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Webhook</DialogTitle>
            <DialogDescription>Update webhook settings.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-name">Name</Label>
              <Input
                id="edit-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-url">URL</Label>
              <Input
                id="edit-url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label>Events</Label>
              <div className="flex flex-wrap gap-2">
                {EVENT_OPTIONS.map((event) => (
                  <Badge
                    key={event.value}
                    variant={events.includes(event.value) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => toggleEvent(event.value)}
                  >
                    {event.label}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() =>
                editingWebhook &&
                updateMutation.mutate({
                  webhookId: editingWebhook.id,
                  updates: {
                    name,
                    url,
                    events,
                  },
                })
              }
              disabled={!name || !url || events.length === 0 || updateMutation.isPending}
            >
              {updateMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Secret Dialog */}
      <Dialog open={!!newSecret} onOpenChange={() => setNewSecret(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Webhook Secret</DialogTitle>
            <DialogDescription>
              Save this secret securely. It will not be shown again.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="flex items-center gap-2">
              <Input
                readOnly
                value={showSecret ? newSecret || '' : '***********************************'}
                className="font-mono text-sm"
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowSecret(!showSecret)}
              >
                {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => newSecret && handleCopy(newSecret, 'secret')}
              >
                {copiedId === 'secret' ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Use this secret to verify webhook signatures using HMAC-SHA256.
            </p>
          </div>
          <DialogFooter>
            <Button onClick={() => setNewSecret(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
