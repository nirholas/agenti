'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Copy,
  Check,
  ExternalLink,
  Activity,
  Globe,
  Key,
  Settings,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Trash2,
  Pencil,
  Upload,
  Store,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { api } from '@/lib/api';
import { formatDate, formatAddress, cn } from '@/lib/utils';
import { Navbar } from '@/components/navbar';
import { NetworksSection, useNetworkStats } from '@/components/networks-section';
import { TransactionsTable } from '@/components/transactions-table';
import { SettlementActivityChart } from '@/components/settlement-activity-chart';
import { WebhooksSection } from '@/components/webhooks-section';
import { ProductsSection } from '@/components/products-section';
import { StorefrontsSection } from '@/components/storefronts-section';
import { RefundsSection } from '@/components/refunds-section';
import { FacilitatorRewardsSection } from '@/components/facilitator-rewards-section';

function formatCurrency(value: string | number): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num || 0);
}

type Tab = 'transactions' | 'products' | 'storefronts' | 'webhooks' | 'refunds' | 'rewards' | 'settings';

function FaviconImage({ url, favicon, size = 'md' }: { url: string; favicon?: string | null; size?: 'md' | 'lg' }) {
  const [hasError, setHasError] = useState(false);
  const sizeClass = size === 'lg' ? 'w-10 h-10' : 'w-8 h-8';

  // If we have a stored favicon, use it
  if (favicon) {
    return (
      <img
        src={favicon}
        alt=""
        className={`${sizeClass} rounded shrink-0`}
      />
    );
  }

  if (hasError) {
    return (
      <img
        src="/icon.svg"
        alt=""
        className={`${sizeClass} rounded shrink-0`}
      />
    );
  }

  return (
    <img
      src={`${url}/favicon.ico`}
      alt=""
      className={`${sizeClass} rounded shrink-0`}
      onError={() => setHasError(true)}
    />
  );
}

export default function FacilitatorDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = (searchParams.get('tab') as Tab) || 'transactions';

  const setActiveTab = (tab: Tab) => {
    const params = new URLSearchParams(searchParams.toString());
    if (tab === 'transactions') {
      params.delete('tab');
    } else {
      params.set('tab', tab);
    }
    router.push(`?${params.toString()}`, { scroll: false });
  };

  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedDns, setCopiedDns] = useState(false);
  const [isChangeDomainOpen, setIsChangeDomainOpen] = useState(false);
  const [isEditInfoOpen, setIsEditInfoOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState('');
  const [newDomain, setNewDomain] = useState('');
  const [editName, setEditName] = useState('');
  const [faviconPreview, setFaviconPreview] = useState<string | null>(null);
  const faviconInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const { data: facilitator, isLoading } = useQuery({
    queryKey: ['facilitator', id],
    queryFn: () => api.getFacilitator(id),
  });

  const { data: domainStatus, refetch: refetchDomainStatus } = useQuery({
    queryKey: ['domainStatus', id],
    queryFn: () => api.getDomainStatus(id),
    enabled: !!facilitator?.customDomain,
    refetchInterval: (query) => (query.state.data?.status === 'pending' ? 10000 : false),
  });

  const setupDomainMutation = useMutation({
    mutationFn: () => api.setupDomain(id),
    onSuccess: () => {
      refetchDomainStatus();
    },
  });

  const updateDomainMutation = useMutation({
    mutationFn: (domain: string | null) => api.updateFacilitator(id, { customDomain: domain }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['facilitator', id] });
      queryClient.invalidateQueries({ queryKey: ['domainStatus', id] });
      setIsChangeDomainOpen(false);
      setNewDomain('');
    },
  });

  const updateNameMutation = useMutation({
    mutationFn: (name: string) => api.updateFacilitator(id, { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['facilitator', id] });
      queryClient.invalidateQueries({ queryKey: ['facilitators'] });
      setIsEditInfoOpen(false);
      setEditName('');
    },
  });

  const { data: faviconData } = useQuery({
    queryKey: ['favicon', id],
    queryFn: () => api.getFavicon(id),
  });

  const uploadFaviconMutation = useMutation({
    mutationFn: (base64: string) => api.uploadFavicon(id, base64),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['favicon', id] });
      setFaviconPreview(null);
    },
  });

  const removeFaviconMutation = useMutation({
    mutationFn: () => api.removeFavicon(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['favicon', id] });
      setFaviconPreview(null);
    },
  });

  const handleFaviconSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ['image/x-icon', 'image/vnd.microsoft.icon', 'image/png', 'image/svg+xml', 'image/jpeg'];
    if (!validTypes.includes(file.type)) return;
    if (file.size > 100 * 1024) return;

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      setFaviconPreview(base64);
      uploadFaviconMutation.mutate(base64);
    };
    reader.readAsDataURL(file);
  };

  const { data: transactionsData } = useQuery({
    queryKey: ['transactions', id],
    queryFn: () => api.getTransactions(id, 500),
    enabled: !!id,
  });

  const networkStats = useNetworkStats(id);

  const deleteFacilitatorMutation = useMutation({
    mutationFn: () => api.deleteFacilitator(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['facilitators'] });
      router.push('/dashboard');
    },
  });

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!facilitator) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Facilitator not found</h1>
          <Link href="/dashboard" className="text-primary hover:underline">
            Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="max-w-7xl mx-auto px-6 pt-24 pb-10 min-h-screen">
        {/* Back link */}
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to dashboard
        </Link>

        {/* DNS Warning Banner - only shown after status is loaded and confirmed not active */}
        {facilitator.customDomain && domainStatus && domainStatus.status !== 'active' && (
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0" />
                <div>
                  <p className="font-medium">DNS not configured</p>
                  <p className="text-sm text-muted-foreground">
                    Your custom domain <span className="font-mono">{facilitator.customDomain}</span> won&apos;t work until DNS is set up.
                  </p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => setActiveTab('settings')}>
                Configure DNS
              </Button>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <FaviconImage url={facilitator.url} favicon={faviconData?.favicon} size="lg" />
              <h1 className="text-3xl font-bold">{facilitator.name}</h1>
              <Dialog open={isEditInfoOpen} onOpenChange={(open) => {
                setIsEditInfoOpen(open);
                if (open) setEditName(facilitator.name);
              }}>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                    <Pencil className="w-4 h-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Edit Facilitator</DialogTitle>
                    <DialogDescription>
                      Update your facilitator's name and icon.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-6 py-4">
                    {/* Favicon */}
                    <div className="space-y-3">
                      <Label>Icon</Label>
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 border-2 border-dashed border-border rounded-lg flex items-center justify-center bg-muted/50">
                          {faviconPreview || faviconData?.favicon ? (
                            <img
                              src={faviconPreview ?? faviconData?.favicon ?? undefined}
                              alt=""
                              className="w-8 h-8 object-contain"
                            />
                          ) : (
                            <img src="/icon.svg" alt="" className="w-8 h-8 opacity-50" />
                          )}
                        </div>
                        <div className="flex flex-col gap-2">
                          <input
                            type="file"
                            ref={faviconInputRef}
                            onChange={handleFaviconSelect}
                            accept=".ico,.png,.svg,.jpg,.jpeg"
                            className="hidden"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => faviconInputRef.current?.click()}
                            disabled={uploadFaviconMutation.isPending}
                          >
                            {uploadFaviconMutation.isPending ? (
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                              <Upload className="w-4 h-4 mr-2" />
                            )}
                            {faviconData?.favicon ? 'Change' : 'Upload'}
                          </Button>
                          {faviconData?.favicon && !uploadFaviconMutation.isPending && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeFaviconMutation.mutate()}
                              disabled={removeFaviconMutation.isPending}
                              className="text-red-500 hover:text-red-600 hover:bg-red-500/10"
                            >
                              {removeFaviconMutation.isPending ? (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              ) : (
                                <Trash2 className="w-4 h-4 mr-2" />
                              )}
                              Remove
                            </Button>
                          )}
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        32×32px ICO or PNG recommended · Max 100KB
                      </p>
                    </div>

                    {/* Name */}
                    <div className="space-y-2">
                      <Label htmlFor="editName">Name</Label>
                      <Input
                        id="editName"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        placeholder="My Facilitator"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setIsEditInfoOpen(false)}>
                      Cancel
                    </Button>
                    {editName && editName !== facilitator.name ? (
                      <Button
                        onClick={() => updateNameMutation.mutate(editName)}
                        disabled={updateNameMutation.isPending}
                      >
                        {updateNameMutation.isPending ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          'Save'
                        )}
                      </Button>
                    ) : (
                      <Button onClick={() => setIsEditInfoOpen(false)}>
                        Done
                      </Button>
                    )}
                  </div>
                </DialogContent>
              </Dialog>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-muted-foreground">{facilitator.url}</span>
              <button
                onClick={() => copyToClipboard(facilitator.url)}
                className="text-muted-foreground hover:text-foreground"
              >
                {copiedUrl ? <Check className="w-4 h-4 text-primary" /> : <Copy className="w-4 h-4" />}
              </button>
              <a
                href={facilitator.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-border mb-6">
          <nav className="flex gap-8">
            <button
              onClick={() => setActiveTab('transactions')}
              className={cn(
                'pb-3 text-sm font-medium border-b-2 -mb-px transition-colors',
                activeTab === 'transactions'
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              Transactions
            </button>
            <button
              onClick={() => setActiveTab('products')}
              className={cn(
                'pb-3 text-sm font-medium border-b-2 -mb-px transition-colors',
                activeTab === 'products'
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              Products
            </button>
            <button
              onClick={() => setActiveTab('storefronts')}
              className={cn(
                'pb-3 text-sm font-medium border-b-2 -mb-px transition-colors',
                activeTab === 'storefronts'
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              Storefronts
            </button>
            <button
              onClick={() => setActiveTab('webhooks')}
              className={cn(
                'pb-3 text-sm font-medium border-b-2 -mb-px transition-colors',
                activeTab === 'webhooks'
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              Webhooks
            </button>
            <button
              onClick={() => setActiveTab('refunds')}
              className={cn(
                'pb-3 text-sm font-medium border-b-2 -mb-px transition-colors',
                activeTab === 'refunds'
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              Refunds
            </button>
            <button
              onClick={() => setActiveTab('rewards')}
              className={cn(
                'pb-3 text-sm font-medium border-b-2 -mb-px transition-colors',
                activeTab === 'rewards'
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              Rewards
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={cn(
                'pb-3 text-sm font-medium border-b-2 -mb-px transition-colors',
                activeTab === 'settings'
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              Settings
            </button>
          </nav>
        </div>

        {/* Tab Content */}
        {activeTab === 'products' ? (
          <ProductsSection facilitatorId={id} facilitator={facilitator} />
        ) : activeTab === 'storefronts' ? (
          <StorefrontsSection facilitatorId={id} facilitator={facilitator} />
        ) : activeTab === 'webhooks' ? (
          <WebhooksSection facilitatorId={id} facilitator={facilitator} />
        ) : activeTab === 'refunds' ? (
          <RefundsSection facilitatorId={id} facilitator={facilitator} />
        ) : activeTab === 'rewards' ? (
          <FacilitatorRewardsSection facilitatorId={id} />
        ) : activeTab === 'transactions' ? (
          <div className="space-y-6">
            {/* Stats Row */}
            <div className="grid sm:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Total Settled</CardDescription>
                </CardHeader>
                <CardContent>
                  <span className="text-2xl font-bold text-primary">
                    {formatCurrency(transactionsData?.stats?.totalAmountSettled ?? 0)}
                  </span>
                  <p className="text-xs text-muted-foreground mt-1">USDC</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Total Verifications</CardDescription>
                </CardHeader>
                <CardContent>
                  <span className="text-2xl font-bold">
                    {(transactionsData?.stats?.totalVerifications ?? 0).toLocaleString()}
                  </span>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Total Settlements</CardDescription>
                </CardHeader>
                <CardContent>
                  <span className="text-2xl font-bold">
                    {(transactionsData?.stats?.totalSettlements ?? 0).toLocaleString()}
                  </span>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Wallets</CardDescription>
                </CardHeader>
                <CardContent>
                  <span className="text-2xl font-bold">
                    {networkStats.walletsConfigured}/{networkStats.totalWallets}
                  </span>
                  <p className="text-xs text-muted-foreground mt-1">
                    {networkStats.networksEnabled} networks enabled
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Chart */}
            <SettlementActivityChart facilitatorId={id} />

            {/* Transactions Table */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="w-4 h-4" />
                  Recent Transactions
                </CardTitle>
                <CardDescription>Payment verifications and settlements</CardDescription>
              </CardHeader>
              <CardContent>
                <TransactionsTable transactions={transactionsData?.transactions || []} />
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Row 1: Configuration + Domain Setup */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Configuration Card */}
              <Card className="h-full">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="w-4 h-4" />
                    Configuration
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-muted-foreground">Domain</Label>
                      {facilitator.customDomain ? (
                        <div className="flex items-center gap-2">
                          <p className="font-mono">{facilitator.customDomain}</p>
                          {domainStatus?.status === 'active' && (
                            <span className="w-2 h-2 rounded-full bg-green-500" />
                          )}
                          {domainStatus?.status === 'pending' && (
                            <span className="w-2 h-2 rounded-full bg-yellow-500" />
                          )}
                        </div>
                      ) : (
                        <p className="text-muted-foreground text-sm">Not configured</p>
                      )}
                    </div>
                    <Dialog open={isChangeDomainOpen} onOpenChange={setIsChangeDomainOpen}>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm">
                          {facilitator.customDomain ? 'Change' : 'Add'}
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>{facilitator.customDomain ? 'Change Custom Domain' : 'Add Custom Domain'}</DialogTitle>
                          <DialogDescription>
                            {facilitator.customDomain
                              ? `Current domain: ${facilitator.customDomain}. Enter a new domain to replace it.`
                              : 'Enter your custom domain to use instead of the default subdomain.'
                            }
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                          <div className="space-y-2">
                            <Label htmlFor="newDomain">Domain</Label>
                            <Input
                              id="newDomain"
                              placeholder="pay.yourdomain.com"
                              value={newDomain}
                              onChange={(e) => setNewDomain(e.target.value.toLowerCase().replace(/[^a-z0-9.-]/g, ''))}
                            />
                          </div>
                          <div className="rounded-lg bg-muted/50 p-4 text-sm">
                            <div className="font-medium mb-2">DNS Setup Required</div>
                            <div className="text-muted-foreground space-y-1">
                              <p>After saving, Railway will provide the DNS target value for your CNAME record.</p>
                            </div>
                          </div>
                        </div>
                        <div className="flex justify-between">
                          {facilitator.customDomain && (
                            <Button
                              variant="destructive"
                              onClick={() => {
                                if (confirm('Remove custom domain? The subdomain will still work.')) {
                                  updateDomainMutation.mutate(null);
                                }
                              }}
                              disabled={updateDomainMutation.isPending}
                            >
                              Remove Domain
                            </Button>
                          )}
                          <div className="flex gap-2 ml-auto">
                            <Button variant="outline" onClick={() => setIsChangeDomainOpen(false)}>
                              Cancel
                            </Button>
                            <Button
                              onClick={() => updateDomainMutation.mutate(newDomain)}
                              disabled={!newDomain || updateDomainMutation.isPending}
                            >
                              {updateDomainMutation.isPending ? (
                                <>
                                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                  Saving...
                                </>
                              ) : (
                                'Save Domain'
                              )}
                            </Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Owner Address</Label>
                    <p className="font-mono text-sm">{formatAddress(facilitator.ownerAddress)}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Created</Label>
                    <p>{formatDate(facilitator.createdAt)}</p>
                  </div>
                </CardContent>
              </Card>

              {/* Domain Setup Card */}
              <Card className={cn(
                'h-full',
                domainStatus?.status === 'active' ? 'border-green-500/50' : domainStatus?.status === 'pending' ? 'border-yellow-500/50' : ''
              )}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Globe className="w-4 h-4" />
                      Domain Setup
                    </CardTitle>
                    {domainStatus?.status === 'active' && (
                      <span className="text-xs bg-green-500/20 text-green-500 px-2 py-0.5 rounded-full">Active</span>
                    )}
                    {domainStatus?.status === 'pending' && (
                      <span className="text-xs bg-yellow-500/20 text-yellow-500 px-2 py-0.5 rounded-full">Pending</span>
                    )}
                    {!facilitator.customDomain && (
                      <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">Not Set</span>
                    )}
                  </div>
                  <CardDescription>Configure DNS for your custom domain</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {!facilitator.customDomain ? (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <AlertCircle className="w-5 h-5" />
                      <span>Add a domain in Configuration to get started</span>
                    </div>
                  ) : domainStatus?.status === 'active' ? (
                    <div className="flex items-center gap-2 text-green-500">
                      <CheckCircle2 className="w-5 h-5" />
                      <span>Domain is active and SSL is provisioned!</span>
                    </div>
                  ) : (
                    <>
                      <div className="bg-muted p-4 rounded-lg space-y-3">
                        <p className="text-sm font-medium">Add this DNS record:</p>
                        {domainStatus?.dnsRecords && domainStatus.dnsRecords.length > 0 ? (
                          domainStatus.dnsRecords.map((record, i) => (
                            <div key={i} className="font-mono text-xs space-y-1">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Type:</span>
                                <span>{record.type}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Name:</span>
                                <span>{record.name.split('.')[0] || '@'}</span>
                              </div>
                              <div className="flex justify-between items-center gap-2">
                                <span className="text-muted-foreground">Value:</span>
                                <div className="flex items-center gap-1">
                                  <span className="truncate max-w-[150px]">{record.value}</span>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 p-0"
                                    onClick={() => {
                                      navigator.clipboard.writeText(record.value);
                                      setCopiedDns(true);
                                      setTimeout(() => setCopiedDns(false), 2000);
                                    }}
                                  >
                                    {copiedDns ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                                  </Button>
                                </div>
                              </div>
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            Click &quot;Setup Domain&quot; to get DNS configuration from Railway.
                          </p>
                        )}
                      </div>

                      <div className="flex gap-2">
                        {domainStatus?.status === 'not_added' && domainStatus.railwayConfigured && (
                          <Button
                            onClick={() => setupDomainMutation.mutate()}
                            disabled={setupDomainMutation.isPending}
                            className="flex-1"
                          >
                            {setupDomainMutation.isPending ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Setting up...
                              </>
                            ) : (
                              'Setup Domain'
                            )}
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          onClick={() => refetchDomainStatus()}
                          className="flex-1"
                        >
                          Verify DNS
                        </Button>
                      </div>

                      {domainStatus?.status === 'pending' && (
                        <p className="text-xs text-muted-foreground">
                          DNS changes can take up to 48 hours to propagate.
                        </p>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Networks Section (with grid wallet cards) */}
            <NetworksSection facilitatorId={id} />

            {/* API Endpoints */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Key className="w-4 h-4" />
                  API Endpoints
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label className="text-muted-foreground text-xs">Verify</Label>
                  <p className="font-mono text-xs bg-muted p-2 rounded">POST {facilitator.url}/verify</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Settle</Label>
                  <p className="font-mono text-xs bg-muted p-2 rounded">POST {facilitator.url}/settle</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Supported</Label>
                  <p className="font-mono text-xs bg-muted p-2 rounded">GET {facilitator.url}/supported</p>
                </div>
              </CardContent>
            </Card>

            {/* Danger Zone */}
            <Card className="border-red-500/50 dark:border-red-900/50 bg-red-500/5 dark:bg-red-950/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
                  <AlertTriangle className="w-4 h-4" />
                  Danger Zone
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <p className="font-medium">Delete this facilitator</p>
                    <p className="text-sm text-muted-foreground">
                      Permanently delete this facilitator, all transaction history, and custom domains.
                    </p>
                  </div>
                  <Dialog open={isDeleteOpen} onOpenChange={(open) => {
                    setIsDeleteOpen(open);
                    if (!open) setDeleteConfirmName('');
                  }}>
                    <DialogTrigger asChild>
                      <Button variant="destructive" className="shrink-0">
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete Facilitator
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Delete {facilitator.name}?</DialogTitle>
                        <DialogDescription>
                          This action cannot be undone. Type the facilitator name to confirm.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="py-4 space-y-4">
                        <div className="p-4 rounded-lg bg-red-500/10 dark:bg-red-950/30 border border-red-500/20 dark:border-red-900/30">
                          <p className="text-sm text-red-600 dark:text-red-400">
                            This will permanently delete:
                          </p>
                          <ul className="mt-2 text-sm text-red-600/80 dark:text-red-400/80 list-disc list-inside space-y-1">
                            <li>The facilitator configuration</li>
                            <li>All transaction history</li>
                            <li>Associated wallets and keys</li>
                            <li>Custom domain settings</li>
                          </ul>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="confirmName">
                            Type <span className="font-mono font-semibold">{facilitator.name}</span> to confirm
                          </Label>
                          <Input
                            id="confirmName"
                            value={deleteConfirmName}
                            onChange={(e) => setDeleteConfirmName(e.target.value)}
                            placeholder={facilitator.name}
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>
                          Cancel
                        </Button>
                        <Button
                          variant="destructive"
                          onClick={() => deleteFacilitatorMutation.mutate()}
                          disabled={deleteConfirmName !== facilitator.name || deleteFacilitatorMutation.isPending}
                        >
                          {deleteFacilitatorMutation.isPending ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Deleting...
                            </>
                          ) : (
                            <>
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete Facilitator
                            </>
                          )}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
