'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Webhook, Copy, Check, RefreshCw, Send, Loader2, Eye, EyeOff } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api } from '@/lib/api';

interface WebhookSettingsProps {
  facilitatorId: string;
}

export function WebhookSettings({ facilitatorId }: WebhookSettingsProps) {
  const queryClient = useQueryClient();
  const [webhookUrl, setWebhookUrl] = useState('');
  const [newSecret, setNewSecret] = useState<string | null>(null);
  const [showSecret, setShowSecret] = useState(false);
  const [copied, setCopied] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const { data: webhook, isLoading } = useQuery({
    queryKey: ['webhook', facilitatorId],
    queryFn: () => api.getWebhook(facilitatorId),
    staleTime: 30000,
  });

  const setWebhookMutation = useMutation({
    mutationFn: (url: string | null) => api.setWebhook(facilitatorId, url),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['webhook', facilitatorId] });
      if (data.webhookSecret) {
        setNewSecret(data.webhookSecret);
        setShowSecret(true);
      }
      setWebhookUrl('');
    },
  });

  const regenerateSecretMutation = useMutation({
    mutationFn: () => api.regenerateWebhookSecret(facilitatorId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['webhook', facilitatorId] });
      setNewSecret(data.webhookSecret);
      setShowSecret(true);
    },
  });

  const testWebhookMutation = useMutation({
    mutationFn: () => api.testWebhook(facilitatorId),
    onSuccess: (data) => {
      setTestResult({ success: data.success, message: data.message });
      setTimeout(() => setTestResult(null), 5000);
    },
    onError: () => {
      setTestResult({ success: false, message: 'Failed to send test webhook' });
      setTimeout(() => setTestResult(null), 5000);
    },
  });

  const copySecret = () => {
    if (newSecret) {
      navigator.clipboard.writeText(newSecret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSaveWebhook = () => {
    if (webhookUrl) {
      setWebhookMutation.mutate(webhookUrl);
    }
  };

  const handleRemoveWebhook = () => {
    setWebhookMutation.mutate(null);
    setNewSecret(null);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Webhook className="w-4 h-4" />
            Webhooks
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-4">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Webhook className="w-4 h-4" />
          Webhooks
        </CardTitle>
        <CardDescription>
          Receive HTTP notifications when payments are settled
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {webhook?.webhookUrl ? (
          <>
            {/* Current webhook URL */}
            <div className="space-y-2">
              <Label className="text-muted-foreground text-xs">Webhook URL</Label>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-sm bg-muted p-2 rounded truncate">
                  {webhook.webhookUrl}
                </code>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRemoveWebhook}
                  disabled={setWebhookMutation.isPending}
                >
                  Remove
                </Button>
              </div>
            </div>

            {/* Secret display (only shown after setup/regenerate) */}
            {newSecret && (
              <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/30 space-y-2">
                <div className="flex items-center gap-2 text-yellow-600 dark:text-yellow-400">
                  <Label className="text-sm font-medium">Webhook Secret</Label>
                  <span className="text-xs">(save this - won't be shown again)</span>
                </div>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-sm bg-background p-2 rounded font-mono break-all">
                    {showSecret ? newSecret : '••••••••••••••••••••••••••••••••'}
                  </code>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowSecret(!showSecret)}
                  >
                    {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={copySecret}
                  >
                    {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => regenerateSecretMutation.mutate()}
                disabled={regenerateSecretMutation.isPending}
              >
                {regenerateSecretMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4 mr-2" />
                )}
                Regenerate Secret
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => testWebhookMutation.mutate()}
                disabled={testWebhookMutation.isPending}
              >
                {testWebhookMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Send className="w-4 h-4 mr-2" />
                )}
                Send Test
              </Button>
            </div>

            {/* Test result */}
            {testResult && (
              <div className={`p-3 rounded-lg text-sm ${
                testResult.success
                  ? 'bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/30'
                  : 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/30'
              }`}>
                {testResult.message}
              </div>
            )}

            {/* Payload info */}
            <div className="pt-2 text-xs text-muted-foreground">
              <p className="font-medium mb-1">Webhook payload includes:</p>
              <ul className="list-disc list-inside space-y-0.5">
                <li>event: &quot;payment.settled&quot;</li>
                <li>transaction details (id, from, to, amount, asset, network, hash)</li>
                <li>X-Webhook-Signature header for HMAC verification</li>
              </ul>
            </div>
          </>
        ) : (
          <>
            {/* Setup form */}
            <div className="space-y-2">
              <Label htmlFor="webhookUrl">Webhook URL</Label>
              <Input
                id="webhookUrl"
                placeholder="https://your-server.com/webhook"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                We'll POST to this URL when payments are settled. A signing secret will be generated automatically.
              </p>
            </div>
            <Button
              onClick={handleSaveWebhook}
              disabled={!webhookUrl || setWebhookMutation.isPending}
            >
              {setWebhookMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Enable Webhook'
              )}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
