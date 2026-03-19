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
  Code,
  Terminal,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { api, type Product, type Facilitator, type Webhook, type LinkType } from '@/lib/api';
import { formatAddress } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface ProductsSectionProps {
  facilitatorId: string;
  facilitator: Facilitator;
}

// Common token/network configs
const NETWORK_OPTIONS = [
  { value: 'base', label: 'Base', chainId: 8453 },
  { value: 'solana', label: 'Solana', chainId: 'solana' },
  { value: 'stacks', label: 'Stacks', chainId: 'stacks' },
];

const TOKEN_OPTIONS: Record<string, { address: string; symbol: string; decimals: number }[]> = {
  base: [
    { address: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913', symbol: 'USDC', decimals: 6 },
  ],
  solana: [
    { address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', symbol: 'USDC', decimals: 6 },
  ],
  stacks: [
    { address: 'STX', symbol: 'STX', decimals: 6 },
    { address: 'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token', symbol: 'sBTC', decimals: 8 },
    { address: 'SP120SBRBQJ00MCWS7TM5R8WJNTTKD5K0HFRC2CNE.usdcx', symbol: 'USDCx', decimals: 6 },
  ],
};

function formatAmount(amount: string, decimals: number = 6): string {
  const num = parseFloat(amount) / Math.pow(10, decimals);
  return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function parseAmountToAtomic(amount: string, decimals: number = 6): string {
  const num = parseFloat(amount);
  if (isNaN(num)) return '0';
  return Math.floor(num * Math.pow(10, decimals)).toString();
}

export function ProductsSection({ facilitatorId, facilitator }: ProductsSectionProps) {
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isApiOpen, setIsApiOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [apiProduct, setApiProduct] = useState<Product | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [slug, setSlug] = useState('');
  const [linkType, setLinkType] = useState<LinkType>('payment');
  const [amount, setAmount] = useState('');
  const [network, setNetwork] = useState('base');
  const [asset, setAsset] = useState(TOKEN_OPTIONS['base'][0].address);
  const [payToAddress, setPayToAddress] = useState('');
  const [successRedirectUrl, setSuccessRedirectUrl] = useState('');
  const [method, setMethod] = useState<'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'ANY'>('GET');
  const [headersForward, setHeadersForward] = useState('');
  const [accessTtl, setAccessTtl] = useState(0); // 0 = pay per visit
  const [groupName, setGroupName] = useState('');
  const [selectedWebhookId, setSelectedWebhookId] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['products', facilitatorId],
    queryFn: () => api.getProducts(facilitatorId),
  });

  const { data: webhooksData } = useQuery({
    queryKey: ['webhooks', facilitatorId],
    queryFn: () => api.getWebhooks(facilitatorId),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      api.createProduct(facilitatorId, {
        name,
        description: description || undefined,
        slug: slug || undefined,
        linkType,
        amount: parseAmountToAtomic(amount),
        asset,
        network,
        payToAddress,
        successRedirectUrl: successRedirectUrl || undefined,
        method: linkType === 'proxy' ? method : undefined,
        headersForward: linkType === 'proxy' && headersForward ? headersForward.split(',').map(h => h.trim()).filter(Boolean) : undefined,
        accessTtl,
        groupName: groupName || undefined,
        webhookId: selectedWebhookId || undefined,
        imageUrl: imageUrl || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products', facilitatorId] });
      setIsCreateOpen(false);
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: { productId: string; updates: Parameters<typeof api.updateProduct>[2] }) =>
      api.updateProduct(facilitatorId, data.productId, data.updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products', facilitatorId] });
      setIsEditOpen(false);
      setEditingProduct(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (productId: string) => api.deleteProduct(facilitatorId, productId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products', facilitatorId] });
    },
  });

  const resetForm = () => {
    setName('');
    setDescription('');
    setSlug('');
    setLinkType('payment');
    setAmount('');
    setNetwork('base');
    setAsset(TOKEN_OPTIONS['base'][0].address);
    setPayToAddress('');
    setSuccessRedirectUrl('');
    setMethod('GET');
    setHeadersForward('');
    setAccessTtl(0);
    setGroupName('');
    setSelectedWebhookId(null);
    setImageUrl('');
  };

  const handleNetworkChange = (newNetwork: string) => {
    setNetwork(newNetwork);
    const tokens = TOKEN_OPTIONS[newNetwork];
    if (tokens && tokens.length > 0) {
      setAsset(tokens[0].address);
    }
  };

  const copyUrl = (product: Product) => {
    navigator.clipboard.writeText(product.url);
    setCopiedId(product.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const openApiDialog = (product: Product) => {
    setApiProduct(product);
    setIsApiOpen(true);
  };

  const copyCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(id);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const openEditDialog = (product: Product) => {
    setEditingProduct(product);
    setName(product.name);
    setDescription(product.description || '');
    setSlug(product.slug || '');
    setLinkType(product.linkType || 'payment');
    setAmount(formatAmount(product.amount));
    setNetwork(product.network);
    setAsset(product.asset);
    setPayToAddress(product.payToAddress);
    setSuccessRedirectUrl(product.successRedirectUrl || '');
    setMethod(product.method as typeof method || 'GET');
    setHeadersForward(product.headersForward?.join(', ') || '');
    setAccessTtl(product.accessTtl || 0);
    setGroupName(product.groupName || '');
    setSelectedWebhookId(product.webhookId);
    setImageUrl(product.imageUrl || '');
    setIsEditOpen(true);
  };

  const handleUpdateProduct = () => {
    if (!editingProduct) return;
    updateMutation.mutate({
      productId: editingProduct.id,
      updates: {
        name,
        description: description || null,
        slug: slug || undefined,
        linkType,
        amount: parseAmountToAtomic(amount),
        asset,
        network,
        payToAddress,
        successRedirectUrl: successRedirectUrl || null,
        method: linkType === 'proxy' ? method : undefined,
        headersForward: linkType === 'proxy' && headersForward ? headersForward.split(',').map(h => h.trim()).filter(Boolean) : undefined,
        accessTtl,
        groupName: groupName || null,
        webhookId: selectedWebhookId,
        imageUrl: imageUrl || null,
      },
    });
  };

  const toggleActive = (product: Product) => {
    updateMutation.mutate({
      productId: product.id,
      updates: { active: !product.active },
    });
  };

  const getTokenSymbol = (network: string, asset: string): string => {
    const tokens = TOKEN_OPTIONS[network];
    if (!tokens) return 'USDC';
    const token = tokens.find((t) => t.address.toLowerCase() === asset.toLowerCase());
    return token?.symbol || 'USDC';
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link2 className="w-4 h-4" />
            Products
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Link2 className="w-4 h-4" />
              Products
            </CardTitle>
            <CardDescription>
              x402 products for anything. Turn any URL into a paid resource. Works for websites, APIs, files, anything with a URL.
            </CardDescription>
          </div>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="w-4 h-4 mr-2" />
                Create Product
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Create Product</DialogTitle>
                <DialogDescription>
                  Create a payment page, redirect, or API proxy.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Name</Label>
                    <Input
                      id="name"
                      placeholder="e.g., Product Purchase"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="linkType">Link Type</Label>
                    <Select value={linkType} onValueChange={(v) => setLinkType(v as LinkType)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="payment">Payment</SelectItem>
                        <SelectItem value="redirect">Redirect</SelectItem>
                        <SelectItem value="proxy">Proxy</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      {linkType === 'payment' && 'Show success page after payment'}
                      {linkType === 'redirect' && 'Redirect to URL after payment'}
                      {linkType === 'proxy' && 'Forward request to URL after payment'}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="slug">URL Slug (optional)</Label>
                    <Input
                      id="slug"
                      placeholder="my-product"
                      value={slug}
                      onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                    />
                    <p className="text-xs text-muted-foreground">
                      Custom URL path for your link
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Input
                      id="description"
                      placeholder="What is this payment for?"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Product Image (optional)</Label>
                    <div className="flex gap-2">
                      <Input
                        id="imageUrl"
                        type="url"
                        placeholder="https://... or upload"
                        value={imageUrl.startsWith('data:') ? '' : imageUrl}
                        onChange={(e) => setImageUrl(e.target.value)}
                        className="flex-1"
                      />
                      <label className="inline-flex items-center justify-center px-3 py-2 rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground cursor-pointer text-sm">
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file && file.size < 500000) {
                              const reader = new FileReader();
                              reader.onloadend = () => setImageUrl(reader.result as string);
                              reader.readAsDataURL(file);
                            } else if (file) {
                              alert('Image must be under 500KB');
                            }
                          }}
                        />
                        Upload
                      </label>
                    </div>
                    {imageUrl && (
                      <div className="relative w-16 h-16 rounded border overflow-hidden">
                        <img src={imageUrl} alt="Preview" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => setImageUrl('')}
                          className="absolute top-0 right-0 bg-black/50 text-white w-4 h-4 flex items-center justify-center text-xs rounded-bl"
                        >
                          ×
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="groupName">Group Name (optional)</Label>
                    <Input
                      id="groupName"
                      placeholder="mountain-art"
                      value={groupName}
                      onChange={(e) => setGroupName(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Group variants together (e.g., sizes)
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="amount">Amount (USDC)</Label>
                    <Input
                      id="amount"
                      type="number"
                      step="0.01"
                      min="0.01"
                      placeholder="10.00"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="network">Network</Label>
                    <Select value={network} onValueChange={handleNetworkChange}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {NETWORK_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="payToAddress">Payment Address</Label>
                  <Input
                    id="payToAddress"
                    placeholder={network === 'solana' ? 'Solana wallet address' : '0x...'}
                    value={payToAddress}
                    onChange={(e) => setPayToAddress(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Wallet address to receive payments (separate from facilitator wallet)
                  </p>
                </div>
                {/* Target URL - required for redirect/proxy, optional for payment */}
                <div className="space-y-2">
                  <Label htmlFor="redirectUrl">
                    {linkType === 'payment' ? 'Success Redirect URL (optional)' : 'Target URL'}
                  </Label>
                  <Input
                    id="redirectUrl"
                    type="url"
                    placeholder={linkType === 'proxy' ? 'https://api.example.com/endpoint' : 'https://yoursite.com/thank-you'}
                    value={successRedirectUrl}
                    onChange={(e) => setSuccessRedirectUrl(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    {linkType === 'payment' && 'Redirect users here after successful payment'}
                    {linkType === 'redirect' && 'URL to redirect to after payment (required)'}
                    {linkType === 'proxy' && 'URL to forward requests to after payment (required)'}
                  </p>
                </div>

                {/* Proxy-specific fields */}
                {linkType === 'proxy' && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="method">HTTP Method</Label>
                      <Select value={method} onValueChange={(v) => setMethod(v as typeof method)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="GET">GET</SelectItem>
                          <SelectItem value="POST">POST</SelectItem>
                          <SelectItem value="PUT">PUT</SelectItem>
                          <SelectItem value="DELETE">DELETE</SelectItem>
                          <SelectItem value="PATCH">PATCH</SelectItem>
                          <SelectItem value="ANY">ANY</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="headers">Forward Headers</Label>
                      <Input
                        id="headers"
                        placeholder="Authorization, X-Custom-Header"
                        value={headersForward}
                        onChange={(e) => setHeadersForward(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">
                        Comma-separated list of headers to forward
                      </p>
                    </div>
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="webhook">Webhook (optional)</Label>
                  <Select
                    value={selectedWebhookId || 'none'}
                    onValueChange={(v) => setSelectedWebhookId(v === 'none' ? null : v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select webhook..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {webhooksData?.webhooks
                        .filter((w) => w.active)
                        .map((webhook) => (
                          <SelectItem key={webhook.id} value={webhook.id}>
                            <div className="flex items-center gap-2">
                              <span>{webhook.name}</span>
                              {webhook.actionType && (
                                <Badge variant="secondary" className="text-xs py-0">
                                  {webhook.actionType}
                                </Badge>
                              )}
                            </div>
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Receive notifications when payments are made
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="accessTtl">Access Duration</Label>
                  <Select
                    value={accessTtl.toString()}
                    onValueChange={(v) => setAccessTtl(parseInt(v))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select duration..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">Pay per visit</SelectItem>
                      <SelectItem value="10">10 seconds (demo)</SelectItem>
                      <SelectItem value="3600">1 hour</SelectItem>
                      <SelectItem value="86400">24 hours</SelectItem>
                      <SelectItem value="604800">7 days</SelectItem>
                      <SelectItem value="2592000">30 days</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    How long users can access after payment (browser cookie)
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => createMutation.mutate()}
                  disabled={!name || !amount || !payToAddress || ((linkType === 'redirect' || linkType === 'proxy') && !successRedirectUrl) || createMutation.isPending}
                >
                  {createMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create Product'
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {data?.products.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Link2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No products yet</p>
            <p className="text-sm">Create your first product to start collecting payments</p>
          </div>
        ) : (
          <div className="space-y-3">
            {data?.products.map((product) => (
              <div
                key={product.id}
                className={`flex items-center justify-between p-4 rounded-lg border ${
                  product.active ? 'bg-background' : 'bg-muted/30 opacity-60'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">{product.name}</span>
                    <Badge variant={
                      product.linkType === 'payment' ? 'default' :
                      product.linkType === 'redirect' ? 'secondary' : 'outline'
                    } className="text-xs py-0">
                      {product.linkType || 'payment'}
                    </Badge>
                    {!product.active && (
                      <span className="text-xs bg-muted px-2 py-0.5 rounded">Inactive</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                    <span className="font-mono">
                      ${formatAmount(product.amount)} {getTokenSymbol(product.network, product.asset)}
                    </span>
                    <span className="capitalize">{product.network}</span>
                    {product.slug && <span className="font-mono text-xs">/{product.slug}</span>}
                    {product.groupName && (
                      <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">{product.groupName}</span>
                    )}
                    {product.stats && (
                      <span>
                        {product.stats.successfulPayments} payment{product.stats.successfulPayments !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyUrl(product)}
                    className="h-8 px-2"
                  >
                    {copiedId === product.id ? (
                      <Check className="w-4 h-4 text-green-500" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </Button>
                  <a
                    href={product.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center h-8 w-8 rounded-md hover:bg-accent"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openApiDialog(product)}>
                        <Code className="w-4 h-4 mr-2" />
                        API / x402
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => openEditDialog(product)}>
                        <Pencil className="w-4 h-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => toggleActive(product)}>
                        {product.active ? (
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
                        className="text-red-600"
                        onClick={() => {
                          if (confirm(`Delete "${product.name}"? This cannot be undone.`)) {
                            deleteMutation.mutate(product.id);
                          }
                        }}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Stats summary */}
        {data?.stats && data.stats.totalProducts > 0 && (
          <div className="mt-4 pt-4 border-t flex items-center gap-6 text-sm text-muted-foreground">
            <div>
              <span className="font-medium text-foreground">{data.stats.activeProducts}</span> active products
            </div>
            <div>
              <span className="font-medium text-foreground">{data.stats.totalPayments}</span> total payments
            </div>
            <div>
              <span className="font-medium text-foreground">${formatAmount(data.stats.totalAmountCollected)}</span> collected
            </div>
          </div>
        )}
      </CardContent>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={(open) => {
        setIsEditOpen(open);
        if (!open) setEditingProduct(null);
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Product</DialogTitle>
            <DialogDescription>
              Update your product settings.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Name</Label>
              <Input
                id="edit-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">Description (optional)</Label>
              <Textarea
                id="edit-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Product Image (optional)</Label>
                <div className="flex gap-2">
                  <Input
                    id="edit-imageUrl"
                    type="url"
                    placeholder="https://... or upload"
                    value={imageUrl.startsWith('data:') ? '' : imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    className="flex-1"
                  />
                  <label className="inline-flex items-center justify-center px-3 py-2 rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground cursor-pointer text-sm">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file && file.size < 500000) {
                          const reader = new FileReader();
                          reader.onloadend = () => setImageUrl(reader.result as string);
                          reader.readAsDataURL(file);
                        } else if (file) {
                          alert('Image must be under 500KB');
                        }
                      }}
                    />
                    Upload
                  </label>
                </div>
                {imageUrl && (
                  <div className="relative w-16 h-16 rounded border overflow-hidden">
                    <img src={imageUrl} alt="Preview" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setImageUrl('')}
                      className="absolute top-0 right-0 bg-black/50 text-white w-4 h-4 flex items-center justify-center text-xs rounded-bl"
                    >
                      ×
                    </button>
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-groupName">Group Name (optional)</Label>
                <Input
                  id="edit-groupName"
                  placeholder="mountain-art"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Group variants together (e.g., sizes)
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-amount">Amount (USDC)</Label>
                <Input
                  id="edit-amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-network">Network</Label>
                <Select value={network} onValueChange={handleNetworkChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {NETWORK_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-payToAddress">Payment Address</Label>
              <Input
                id="edit-payToAddress"
                placeholder={network === 'solana' ? 'Solana wallet address' : '0x...'}
                value={payToAddress}
                onChange={(e) => setPayToAddress(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Wallet address to receive payments
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-redirectUrl">Success Redirect URL (optional)</Label>
              <Input
                id="edit-redirectUrl"
                type="url"
                placeholder="https://yoursite.com/thank-you"
                value={successRedirectUrl}
                onChange={(e) => setSuccessRedirectUrl(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-webhook">Webhook (optional)</Label>
              <Select
                value={selectedWebhookId || 'none'}
                onValueChange={(v) => setSelectedWebhookId(v === 'none' ? null : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select webhook..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {webhooksData?.webhooks
                    .filter((w) => w.active)
                    .map((webhook) => (
                      <SelectItem key={webhook.id} value={webhook.id}>
                        <div className="flex items-center gap-2">
                          <span>{webhook.name}</span>
                          {webhook.actionType && (
                            <Badge variant="secondary" className="text-xs py-0">
                              {webhook.actionType}
                            </Badge>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Receive notifications when payments are made
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-accessTtl">Access Duration</Label>
              <Select
                value={accessTtl.toString()}
                onValueChange={(v) => setAccessTtl(parseInt(v))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select duration..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Pay per visit</SelectItem>
                  <SelectItem value="10">10 seconds (demo)</SelectItem>
                  <SelectItem value="3600">1 hour</SelectItem>
                  <SelectItem value="86400">24 hours</SelectItem>
                  <SelectItem value="604800">7 days</SelectItem>
                  <SelectItem value="2592000">30 days</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                How long users can access after payment (browser cookie)
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleUpdateProduct}
              disabled={!name || !amount || !payToAddress || ((linkType === 'redirect' || linkType === 'proxy') && !successRedirectUrl) || updateMutation.isPending}
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

      {/* API / x402 Dialog */}
      <Dialog open={isApiOpen} onOpenChange={(open) => {
        setIsApiOpen(open);
        if (!open) setApiProduct(null);
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Terminal className="w-5 h-5" />
              API Access
            </DialogTitle>
            <DialogDescription>
              Access this product programmatically via the x402 protocol.
            </DialogDescription>
          </DialogHeader>
          {apiProduct && (
            <div className="space-y-6 py-4">
              {/* Human-friendly URL */}
              <div className="space-y-2">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <ExternalLink className="w-4 h-4" />
                  Browser / Human URL
                </Label>
                <div className="flex gap-2">
                  <code className="flex-1 px-3 py-2 bg-muted rounded-md text-sm font-mono break-all">
                    {apiProduct.url}
                  </code>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyCode(apiProduct.url, 'human-url')}
                  >
                    {copiedCode === 'human-url' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Opens a payment page where users can connect their wallet and pay.
                </p>
              </div>

              {/* x402 API */}
              <div className="space-y-3">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <Code className="w-4 h-4" />
                  x402 Protocol (Agent-friendly)
                </Label>
                <p className="text-xs text-muted-foreground">
                  Same URL, but with <code className="px-1 py-0.5 bg-muted rounded">Accept: application/json</code> header.
                  Returns 402 with payment requirements, or processes payment if <code className="px-1 py-0.5 bg-muted rounded">X-Payment</code> header is provided.
                </p>

                {/* Get requirements curl */}
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground font-medium">Get payment requirements:</div>
                  <div className="relative">
                    <pre className="px-3 py-2 bg-zinc-900 text-zinc-100 rounded-md text-xs font-mono overflow-x-auto">
{`curl -X GET "${apiProduct.url}" \\
  -H "Accept: application/json"`}
                    </pre>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute top-1 right-1 h-6 w-6 p-0"
                      onClick={() => copyCode(`curl -X GET "${apiProduct.url}" -H "Accept: application/json"`, 'curl-get')}
                    >
                      {copiedCode === 'curl-get' ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3 text-zinc-400" />}
                    </Button>
                  </div>
                </div>

                {/* Response example */}
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground font-medium">Response (402 Payment Required):</div>
                  <pre className="px-3 py-2 bg-zinc-900 text-zinc-100 rounded-md text-xs font-mono overflow-x-auto max-h-40">
{`{
  "x402Version": 1,
  "accepts": [{
    "scheme": "exact",
    "network": "${apiProduct.network}",
    "maxAmountRequired": "${apiProduct.amount}",
    "asset": "${apiProduct.asset}",
    "payTo": "${apiProduct.payToAddress}",
    "description": "${apiProduct.description || apiProduct.name}"
  }],
  "error": "Payment Required"
}`}
                  </pre>
                </div>

                {/* Submit payment curl */}
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground font-medium">Submit payment (with signed payload):</div>
                  <div className="relative">
                    <pre className="px-3 py-2 bg-zinc-900 text-zinc-100 rounded-md text-xs font-mono overflow-x-auto">
{`curl -X GET "${apiProduct.url}" \\
  -H "Accept: application/json" \\
  -H "X-Payment: <base64-encoded-signed-payload>"`}
                    </pre>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute top-1 right-1 h-6 w-6 p-0"
                      onClick={() => copyCode(`curl -X GET "${apiProduct.url}" -H "Accept: application/json" -H "X-Payment: <base64-encoded-signed-payload>"`, 'curl-pay')}
                    >
                      {copiedCode === 'curl-pay' ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3 text-zinc-400" />}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Documentation link */}
              <div className="pt-2 border-t">
                <a
                  href="https://github.com/rawgroundbeef/openfacilitator"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline flex items-center gap-1"
                >
                  View source on GitHub
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
