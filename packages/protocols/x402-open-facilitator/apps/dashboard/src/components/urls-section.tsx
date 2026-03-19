'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Link2,
  Plus,
  Copy,
  Check,
  ExternalLink,
  Loader2,
  MoreVertical,
  Trash2,
  Pencil,
  ToggleLeft,
  ToggleRight,
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
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { api, type ProxyUrl, type Facilitator } from '@/lib/api';
import { Badge } from '@/components/ui/badge';

interface UrlsSectionProps {
  facilitatorId: string;
  facilitator: Facilitator;
}

const NETWORK_OPTIONS = [
  { value: 'base', label: 'Base' },
  { value: 'solana', label: 'Solana' },
];

const TOKEN_OPTIONS: Record<string, { address: string; symbol: string; decimals: number }[]> = {
  base: [
    { address: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913', symbol: 'USDC', decimals: 6 },
  ],
  solana: [
    { address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', symbol: 'USDC', decimals: 6 },
  ],
};

const METHOD_OPTIONS = ['ANY', 'GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

function formatAmount(amount: string, decimals: number = 6): string {
  const num = parseFloat(amount) / Math.pow(10, decimals);
  return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function parseAmountToAtomic(amount: string, decimals: number = 6): string {
  const num = parseFloat(amount);
  if (isNaN(num)) return '0';
  return Math.floor(num * Math.pow(10, decimals)).toString();
}

export function UrlsSection({ facilitatorId, facilitator }: UrlsSectionProps) {
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingUrl, setEditingUrl] = useState<ProxyUrl | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [targetUrl, setTargetUrl] = useState('');
  const [method, setMethod] = useState('ANY');
  const [amount, setAmount] = useState('');
  const [network, setNetwork] = useState('solana');
  const [asset, setAsset] = useState(TOKEN_OPTIONS['solana'][0].address);
  const [payToAddress, setPayToAddress] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['proxy-urls', facilitatorId],
    queryFn: () => api.getProxyUrls(facilitatorId),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      api.createProxyUrl(facilitatorId, {
        name,
        slug,
        targetUrl,
        method,
        priceAmount: parseAmountToAtomic(amount),
        priceAsset: asset,
        priceNetwork: network,
        payToAddress,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proxy-urls', facilitatorId] });
      setIsCreateOpen(false);
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: { urlId: string; updates: Parameters<typeof api.updateProxyUrl>[2] }) =>
      api.updateProxyUrl(facilitatorId, data.urlId, data.updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proxy-urls', facilitatorId] });
      setIsEditOpen(false);
      setEditingUrl(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (urlId: string) => api.deleteProxyUrl(facilitatorId, urlId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proxy-urls', facilitatorId] });
    },
  });

  const resetForm = () => {
    setName('');
    setSlug('');
    setTargetUrl('');
    setMethod('ANY');
    setAmount('');
    setNetwork('solana');
    setAsset(TOKEN_OPTIONS['solana'][0].address);
    setPayToAddress('');
  };

  const handleCopy = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleEdit = (url: ProxyUrl) => {
    setEditingUrl(url);
    setName(url.name);
    setSlug(url.slug);
    setTargetUrl(url.targetUrl);
    setMethod(url.method);
    setAmount(formatAmount(url.priceAmount));
    setNetwork(url.priceNetwork);
    setAsset(url.priceAsset);
    setPayToAddress(url.payToAddress);
    setIsEditOpen(true);
  };

  const handleNetworkChange = (newNetwork: string) => {
    setNetwork(newNetwork);
    const tokens = TOKEN_OPTIONS[newNetwork];
    if (tokens && tokens.length > 0) {
      setAsset(tokens[0].address);
    }
  };

  const urls = data?.urls || [];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Link2 className="w-5 h-5" />
            URLs
          </CardTitle>
          <CardDescription>
            Turn any URL into a paid endpoint. Customers pay before accessing your content or API.
          </CardDescription>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <Button onClick={() => setIsCreateOpen(true)} size="sm">
            <Plus className="w-4 h-4 mr-2" />
            Create URL
          </Button>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Create URL</DialogTitle>
              <DialogDescription>
                Set up a paid proxy to your API endpoint.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    placeholder="My API"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="slug">Slug</Label>
                  <Input
                    id="slug"
                    placeholder="my-api"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  />
                  <p className="text-xs text-muted-foreground">/u/{slug || 'my-api'}</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="targetUrl">Target URL</Label>
                <Input
                  id="targetUrl"
                  placeholder="https://api.example.com/v1/endpoint"
                  value={targetUrl}
                  onChange={(e) => setTargetUrl(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">Requests will be forwarded here after payment</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="method">Method</Label>
                  <Select value={method} onValueChange={setMethod}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {METHOD_OPTIONS.map((m) => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="amount">Price (USDC)</Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    placeholder="0.05"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Network</Label>
                  <Select value={network} onValueChange={handleNetworkChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {NETWORK_OPTIONS.map((n) => (
                        <SelectItem key={n.value} value={n.value}>{n.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Token</Label>
                  <Select value={asset} onValueChange={setAsset}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(TOKEN_OPTIONS[network] || []).map((t) => (
                        <SelectItem key={t.address} value={t.address}>{t.symbol}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="payToAddress">Pay To Address</Label>
                <Input
                  id="payToAddress"
                  placeholder="Your wallet address"
                  value={payToAddress}
                  onChange={(e) => setPayToAddress(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => createMutation.mutate()}
                disabled={!name || !slug || !targetUrl || !amount || !payToAddress || createMutation.isPending}
              >
                {createMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create URL'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : urls.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Link2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No URLs yet</p>
            <p className="text-sm">Create your first paid API proxy</p>
          </div>
        ) : (
          <div className="space-y-3">
            {urls.map((url) => (
              <div
                key={url.id}
                className="flex items-center justify-between p-4 rounded-lg border bg-card"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{url.name}</span>
                    <Badge variant={url.active ? 'default' : 'secondary'}>
                      {url.active ? 'Active' : 'Inactive'}
                    </Badge>
                    <Badge variant="outline">{url.method}</Badge>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <code className="text-sm text-muted-foreground truncate max-w-md">
                      {url.url}
                    </code>
                    <button
                      onClick={() => handleCopy(url.url, url.id)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      {copiedId === url.id ? (
                        <Check className="w-4 h-4 text-green-500" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                    <a
                      href={url.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    ${formatAmount(url.priceAmount)} per request → {url.targetUrl.substring(0, 50)}...
                  </p>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreVertical className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleEdit(url)}>
                      <Pencil className="w-4 h-4 mr-2" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() =>
                        updateMutation.mutate({
                          urlId: url.id,
                          updates: { active: !url.active },
                        })
                      }
                    >
                      {url.active ? (
                        <>
                          <ToggleLeft className="w-4 h-4 mr-2" />
                          Deactivate
                        </>
                      ) : (
                        <>
                          <ToggleRight className="w-4 h-4 mr-2" />
                          Activate
                        </>
                      )}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => deleteMutation.mutate(url.id)}
                      className="text-destructive"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit URL</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Name</Label>
                <Input
                  id="edit-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-slug">Slug</Label>
                <Input
                  id="edit-slug"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-targetUrl">Target URL</Label>
              <Input
                id="edit-targetUrl"
                value={targetUrl}
                onChange={(e) => setTargetUrl(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Method</Label>
                <Select value={method} onValueChange={setMethod}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {METHOD_OPTIONS.map((m) => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Price (USDC)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Pay To Address</Label>
              <Input
                value={payToAddress}
                onChange={(e) => setPayToAddress(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!editingUrl) return;
                updateMutation.mutate({
                  urlId: editingUrl.id,
                  updates: {
                    name,
                    slug,
                    targetUrl,
                    method,
                    priceAmount: parseAmountToAtomic(amount),
                    payToAddress,
                  },
                });
              }}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
