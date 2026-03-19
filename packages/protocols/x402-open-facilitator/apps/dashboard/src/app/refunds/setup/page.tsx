'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Wallet,
  Loader2,
  Plus,
  Copy,
  Check,
  Server,
  MoreVertical,
  Trash2,
  RefreshCw,
  Eye,
  EyeOff,
  DollarSign,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ExternalLink,
  HelpCircle,
  Shield,
  Package,
  FileText,
  LogIn,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Navbar } from '@/components/navbar';
import { CodeBlock } from '@/components/ui/code-block';
import { formatAddress, cn } from '@/lib/utils';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5002';

interface User {
  id: string;
  email: string;
  name?: string;
}

interface ResourceOwner {
  id: string;
  facilitatorId: string;
  userId: string;
  refundAddress: string | null;
  name: string | null;
  createdAt: string;
}

interface RefundWallet {
  network: string;
  address: string;
  balance: string;
  createdAt: string;
}

interface RegisteredServer {
  id: string;
  url: string;
  name: string | null;
  active: boolean;
  createdAt: string;
}

interface Claim {
  id: string;
  serverId: string;
  originalTxHash: string;
  userWallet: string;
  amount: string;
  asset: string;
  network: string;
  reason: string | null;
  status: 'pending' | 'approved' | 'paid' | 'rejected' | 'expired';
  payoutTxHash: string | null;
  reportedAt: string;
  paidAt: string | null;
  expiresAt: string | null;
}

interface ClaimStats {
  totalClaims: number;
  pendingClaims: number;
  approvedClaims: number;
  paidClaims: number;
  rejectedClaims: number;
  expiredClaims: number;
  totalPaidAmount: string;
}

function ClaimsSetupContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const facilitatorParam = searchParams.get('facilitator') || '';

  const facilitator = facilitatorParam;
  const [user, setUser] = useState<User | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [resourceOwner, setResourceOwner] = useState<ResourceOwner | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);

  // Registration form
  const [regName, setRegName] = useState('');

  // Data states
  const [wallets, setWallets] = useState<RefundWallet[]>([]);
  const [servers, setServers] = useState<RegisteredServer[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [claimStats, setClaimStats] = useState<ClaimStats | null>(null);
  const [supportedNetworks, setSupportedNetworks] = useState<string[]>([]);

  // UI states
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [newApiKey, setNewApiKey] = useState<string | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);
  const [isAddServerOpen, setIsAddServerOpen] = useState(false);
  const [isEditServerOpen, setIsEditServerOpen] = useState(false);
  const [editingServer, setEditingServer] = useState<RegisteredServer | null>(null);
  const [serverUrl, setServerUrl] = useState('');
  const [serverName, setServerName] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(false);
  const [sdkFramework, setSdkFramework] = useState<'hono' | 'express' | 'sdk'>('hono');
  const [processingClaims, setProcessingClaims] = useState<Set<string>>(new Set());

  // Check auth on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/admin/me`, {
          credentials: 'include',
        });

        if (response.ok) {
          const data = await response.json();
          setUser(data);
        } else {
          setUser(null);
        }
      } catch {
        setUser(null);
      } finally {
        setIsCheckingAuth(false);
      }
    };

    checkAuth();
  }, []);

  // Check if already registered when user and facilitator are set
  useEffect(() => {
    const checkRegistration = async () => {
      if (!user || !facilitator) return;

      try {
        const response = await fetch(
          `${API_BASE}/api/resource-owners/me?facilitator=${facilitator}`,
          { credentials: 'include' }
        );

        if (response.ok) {
          const data = await response.json();
          setResourceOwner(data);
        }
      } catch {
        // Not registered yet
      }
    };

    checkRegistration();
  }, [user, facilitator]);

  // Make authenticated API call
  const apiCall = useCallback(async (path: string, options: RequestInit = {}) => {
    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Request failed');
    return data;
  }, []);

  // Load data when authenticated
  const loadData = useCallback(async () => {
    if (!resourceOwner) return;

    setIsLoading(true);
    try {
      const [walletsRes, serversRes, claimsRes] = await Promise.all([
        apiCall(`/api/resource-owners/${resourceOwner.id}/wallets`),
        apiCall(`/api/resource-owners/${resourceOwner.id}/servers`),
        apiCall(`/api/resource-owners/${resourceOwner.id}/claims${statusFilter !== 'all' ? `?status=${statusFilter}` : ''}`),
      ]);

      setWallets(walletsRes.wallets || []);
      setSupportedNetworks(walletsRes.supportedNetworks || []);
      setServers(serversRes.servers || []);
      setClaims(claimsRes.claims || []);
      setClaimStats(claimsRes.stats || null);
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [resourceOwner, apiCall, statusFilter]);

  useEffect(() => {
    if (resourceOwner) {
      loadData();
    }
  }, [resourceOwner, loadData]);

  // Register as resource owner
  const register = async () => {
    if (!user || !facilitator) return;

    setError(null);
    setIsRegistering(true);

    try {
      const response = await fetch(`${API_BASE}/api/resource-owners/register`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          facilitator,
          name: regName || undefined,
        }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Registration failed');

      setResourceOwner(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setIsRegistering(false);
    }
  };

  // Generate wallet
  const generateWallet = async (network: string) => {
    try {
      await apiCall(`/api/resource-owners/${resourceOwner!.id}/wallets`, {
        method: 'POST',
        body: JSON.stringify({ network }),
      });
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate wallet');
    }
  };

  // Delete wallet
  const deleteWallet = async (network: string) => {
    try {
      await apiCall(`/api/resource-owners/${resourceOwner!.id}/wallets/${network}`, {
        method: 'DELETE',
      });
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete wallet');
    }
  };

  // Register server
  const registerServer = async () => {
    try {
      const result = await apiCall(`/api/resource-owners/${resourceOwner!.id}/servers`, {
        method: 'POST',
        body: JSON.stringify({ url: serverUrl, name: serverName || undefined }),
      });

      setIsAddServerOpen(false);
      setServerUrl('');
      setServerName('');
      if (result.apiKey) {
        setNewApiKey(result.apiKey);
      }
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to register server');
    }
  };

  // Delete server
  const deleteServer = async (serverId: string) => {
    try {
      await apiCall(`/api/resource-owners/${resourceOwner!.id}/servers/${serverId}`, {
        method: 'DELETE',
      });
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete server');
    }
  };

  // Regenerate API key
  const regenerateApiKey = async (serverId: string) => {
    try {
      const result = await apiCall(`/api/resource-owners/${resourceOwner!.id}/servers/${serverId}/regenerate-key`, {
        method: 'POST',
      });
      setNewApiKey(result.apiKey);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to regenerate API key');
    }
  };

  // Update server
  const updateServer = async () => {
    if (!editingServer) return;
    try {
      await apiCall(`/api/resource-owners/${resourceOwner!.id}/servers/${editingServer.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: serverName || null, url: serverUrl }),
      });
      setIsEditServerOpen(false);
      setEditingServer(null);
      setServerName('');
      setServerUrl('');
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update API key');
    }
  };

  // Open edit dialog
  const openEditDialog = (server: RegisteredServer) => {
    setEditingServer(server);
    setServerName(server.name || '');
    setServerUrl(server.url || '');
    setIsEditServerOpen(true);
  };

  // Approve claim
  const approveClaim = async (claimId: string) => {
    setProcessingClaims((prev) => new Set(prev).add(claimId));
    try {
      await apiCall(`/api/resource-owners/${resourceOwner!.id}/claims/${claimId}/approve`, {
        method: 'POST',
      });
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve claim');
    } finally {
      setProcessingClaims((prev) => {
        const next = new Set(prev);
        next.delete(claimId);
        return next;
      });
    }
  };

  // Reject claim
  const rejectClaim = async (claimId: string) => {
    setProcessingClaims((prev) => new Set(prev).add(claimId));
    try {
      await apiCall(`/api/resource-owners/${resourceOwner!.id}/claims/${claimId}/reject`, {
        method: 'POST',
      });
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reject claim');
    } finally {
      setProcessingClaims((prev) => {
        const next = new Set(prev);
        next.delete(claimId);
        return next;
      });
    }
  };

  // Execute payout
  const executePayout = async (claimId: string) => {
    setProcessingClaims((prev) => new Set(prev).add(claimId));
    try {
      await apiCall(`/api/resource-owners/${resourceOwner!.id}/claims/${claimId}/payout`, {
        method: 'POST',
      });
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to execute payout');
    } finally {
      setProcessingClaims((prev) => {
        const next = new Set(prev);
        next.delete(claimId);
        return next;
      });
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const formatAmount = (amount: string) => {
    const value = Number(amount) / 1_000_000;
    return `$${value.toFixed(2)}`;
  };

  const getExplorerUrl = (network: string, txHash: string) => {
    const explorers: Record<string, string> = {
      base: 'https://basescan.org/tx/',
      'base-sepolia': 'https://sepolia.basescan.org/tx/',
      solana: 'https://solscan.io/tx/',
      'solana-devnet': 'https://solscan.io/tx/',
    };
    const baseUrl = explorers[network] || explorers['base'];
    const suffix = network === 'solana-devnet' ? '?cluster=devnet' : '';
    return `${baseUrl}${txHash}${suffix}`;
  };

  // Available networks (ones that don't have wallets yet)
  const existingWalletNetworks = new Set(wallets.map(w => w.network));
  const availableNetworks = supportedNetworks.filter(n => !existingWalletNetworks.has(n));

  // Determine current step
  const getCurrentStep = () => {
    if (!user) return 1;
    if (!resourceOwner) return 2;
    return 3;
  };
  const currentStep = getCurrentStep();

  // Loading state
  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/20">
        <Navbar />
        <main className="max-w-6xl mx-auto px-4 pt-24 pb-12 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/20">
      <Navbar />

      <main className="max-w-6xl mx-auto px-4 pt-24 pb-12">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold tracking-tight mb-4">Refund Protection Setup</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Automatically refund users when your API fails. Register your server, fund a wallet, and you&apos;re set.
          </p>
          <a
            href="/docs/sdk/refunds"
            className="inline-flex items-center gap-1 text-sm text-primary hover:underline mt-3"
          >
            <FileText className="h-4 w-4" />
            Read the documentation
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>

        {/* Step Indicator */}
        {currentStep < 3 && (
          <div className="flex items-center justify-center gap-2 mb-8">
            {[1, 2, 3].map((step) => (
              <div key={step} className="flex items-center">
                <div
                  className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors",
                    step === currentStep
                      ? "bg-primary text-primary-foreground"
                      : step < currentStep
                      ? "bg-primary/20 text-primary"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {step < currentStep ? <Check className="h-4 w-4" /> : step}
                </div>
                {step < 3 && (
                  <div
                    className={cn(
                      "w-12 h-0.5 mx-1",
                      step < currentStep ? "bg-primary/50" : "bg-muted"
                    )}
                  />
                )}
              </div>
            ))}
          </div>
        )}

        {/* Error Display */}
        {error && (
          <Card className="mb-6 border-destructive">
            <CardContent className="py-4">
              <div className="flex items-center gap-2 text-destructive">
                <AlertCircle className="h-5 w-5" />
                <p>{error}</p>
                <Button variant="ghost" size="sm" onClick={() => setError(null)} className="ml-auto">
                  Dismiss
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 1: Sign In */}
        {!user && (
          <Card className="max-w-md mx-auto">
            <CardHeader>
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                <Shield className="h-4 w-4" />
                Step 1 of 3
              </div>
              <CardTitle className="flex items-center gap-2">
                <LogIn className="h-5 w-5" />
                Sign In Required
              </CardTitle>
              <CardDescription>
                Sign in to your account to set up refund protection.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {facilitator ? (
                <div className="grid gap-2">
                  <div className="flex items-center gap-1">
                    <Label>Facilitator</Label>
                    <div className="relative group">
                      <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-popover text-popover-foreground text-xs rounded-md shadow-lg border opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none w-48 z-50">
                        A facilitator handles x402 payments on your behalf.
                      </div>
                    </div>
                  </div>
                  <div className="px-3 py-2 rounded-md bg-muted border text-sm font-medium">
                    {facilitator}
                  </div>
                </div>
              ) : (
                <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                  No facilitator specified. Please use a valid setup link from your facilitator.
                </div>
              )}

              <Button
                onClick={() => router.push(`/auth/signin?callbackUrl=${encodeURIComponent(`/refunds/setup?facilitator=${facilitator}`)}`)}
                disabled={!facilitator}
                className="w-full"
              >
                <LogIn className="h-4 w-4 mr-2" />
                Sign In to Continue
              </Button>

              <p className="text-xs text-center text-muted-foreground">
                Don&apos;t have an account?{' '}
                <a
                  href={`/auth/signup?callbackUrl=${encodeURIComponent(`/refunds/setup?facilitator=${facilitator}`)}`}
                  className="text-primary hover:underline"
                >
                  Sign up
                </a>
              </p>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Register */}
        {user && !resourceOwner && (
          <Card className="max-w-md mx-auto">
            <CardHeader>
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                <Shield className="h-4 w-4" />
                Step 2 of 3
              </div>
              <CardTitle>Register for Refund Protection</CardTitle>
              <CardDescription>
                Signed in as: <span className="font-medium">{user.email}</span>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Register with the <strong>{facilitator}</strong> facilitator to enable refund
                protection for your API.
              </p>

              <div className="grid gap-2">
                <Label htmlFor="regName">Display Name (optional)</Label>
                <Input
                  id="regName"
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  placeholder="My API Service"
                />
              </div>

              <div className="p-3 rounded-lg bg-muted/50 border text-xs text-muted-foreground">
                <p>After registering, you&apos;ll be able to:</p>
                <ul className="list-disc list-inside ml-2 mt-1 space-y-0.5">
                  <li>Generate refund wallets for each network</li>
                  <li>Create API keys for your servers</li>
                  <li>Manage and approve refund claims</li>
                </ul>
              </div>

              <Button
                onClick={register}
                disabled={isRegistering}
                className="w-full"
              >
                {isRegistering ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                )}
                Register
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Dashboard */}
        {resourceOwner && (
          <div className="space-y-6">
            {/* Profile Card */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Resource Owner Dashboard</CardTitle>
                    <CardDescription>
                      {resourceOwner.name || user?.email}
                      {' | '}Facilitator: <strong>{facilitator}</strong>
                      {resourceOwner.refundAddress && (
                        <> | Refund Address: <code className="font-mono">{formatAddress(resourceOwner.refundAddress)}</code></>
                      )}
                    </CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={loadData} disabled={isLoading}>
                    <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
                  </Button>
                </div>
              </CardHeader>
            </Card>

            {/* Stats */}
            {claimStats && (
              <div className="grid gap-4 md:grid-cols-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <p className="text-2xl font-bold">{claimStats.totalClaims}</p>
                      <p className="text-sm text-muted-foreground">Total Claims</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-yellow-600">{claimStats.pendingClaims}</p>
                      <p className="text-sm text-muted-foreground">Pending</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-green-600">{claimStats.paidClaims}</p>
                      <p className="text-sm text-muted-foreground">Paid</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-green-600">${claimStats.totalPaidAmount}</p>
                      <p className="text-sm text-muted-foreground">Total Paid</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Refund Wallets */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wallet className="h-5 w-5" />
                  Refund Wallets
                </CardTitle>
                <CardDescription>
                  Fund these wallets with USDC to pay out refunds to your users.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2">
                  {wallets.map((wallet) => (
                    <div key={wallet.network} className="p-4 rounded-lg border bg-card">
                      <div className="flex items-center justify-between mb-2">
                        <Badge variant="outline" className="capitalize">{wallet.network}</Badge>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => deleteWallet(wallet.network)}
                              className="text-red-600"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete Wallet
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      <div className="space-y-2">
                        <div>
                          <Label className="text-xs text-muted-foreground">Address</Label>
                          <div className="flex items-center gap-2">
                            <code className="text-xs font-mono truncate flex-1">
                              {formatAddress(wallet.address)}
                            </code>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleCopy(wallet.address, `wallet-${wallet.network}`)}
                            >
                              {copiedId === `wallet-${wallet.network}` ? (
                                <Check className="h-3 w-3 text-green-500" />
                              ) : (
                                <Copy className="h-3 w-3" />
                              )}
                            </Button>
                          </div>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Balance</Label>
                          <p className="text-lg font-semibold">${wallet.balance} USDC</p>
                        </div>
                      </div>
                    </div>
                  ))}

                  {availableNetworks.map((network) => (
                    <button
                      key={network}
                      onClick={() => generateWallet(network)}
                      className="p-4 rounded-lg border border-dashed border-muted-foreground/30 hover:border-primary/50 hover:bg-accent transition-colors flex flex-col items-center justify-center gap-2 min-h-[120px]"
                    >
                      <Plus className="h-6 w-6 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground capitalize">
                        Generate {network} Wallet
                      </span>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* API Keys */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Shield className="h-5 w-5" />
                      API Keys
                    </CardTitle>
                    <CardDescription>
                      API keys authenticate your servers to report failures. One key works for all your resources.
                    </CardDescription>
                  </div>
                  <Button onClick={() => setIsAddServerOpen(true)} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Create API Key
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {servers.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No API keys created</p>
                    <p className="text-sm">Create an API key to enable failure reporting from your servers.</p>
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
                            <Shield className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium truncate">{server.name || server.url || 'API Key'}</span>
                            <Badge variant={server.active ? "default" : "secondary"}>
                              {server.active ? 'Active' : 'Revoked'}
                            </Badge>
                          </div>
                          {server.url && server.url.length > 0 && (
                            <p className="text-sm text-muted-foreground truncate mt-1 ml-6">
                              {server.url}
                            </p>
                          )}
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEditDialog(server)}>
                              <FileText className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => regenerateApiKey(server.id)}>
                              <RefreshCw className="h-4 w-4 mr-2" />
                              Regenerate Key
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => deleteServer(server.id)}
                              className="text-red-600"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Revoke Key
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* SDK Integration - only show when servers exist */}
            {servers.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="h-5 w-5" />
                    Integrate Refund Protection
                  </CardTitle>
                  <CardDescription>
                    Add the SDK to your server to enable automatic failure reporting.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Install command */}
                  <div>
                    <Label className="text-sm text-muted-foreground mb-2 block">
                      Install the SDK
                    </Label>
                    <CodeBlock code="npm install @openfacilitator/sdk" language="bash" />
                  </div>

                  {/* Code snippet with framework tabs */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Label className="text-sm text-muted-foreground">
                        Add to your API handler
                      </Label>
                      <div className="flex gap-1 bg-muted/50 rounded-lg p-1">
                        <button
                          onClick={() => setSdkFramework('hono')}
                          className={cn(
                            'px-3 py-1 text-xs font-medium rounded-md transition-colors',
                            sdkFramework === 'hono'
                              ? 'bg-background text-foreground shadow-sm'
                              : 'text-muted-foreground hover:text-foreground'
                          )}
                        >
                          Hono
                        </button>
                        <button
                          onClick={() => setSdkFramework('express')}
                          className={cn(
                            'px-3 py-1 text-xs font-medium rounded-md transition-colors',
                            sdkFramework === 'express'
                              ? 'bg-background text-foreground shadow-sm'
                              : 'text-muted-foreground hover:text-foreground'
                          )}
                        >
                          Express
                        </button>
                        <button
                          onClick={() => setSdkFramework('sdk')}
                          className={cn(
                            'px-3 py-1 text-xs font-medium rounded-md transition-colors',
                            sdkFramework === 'sdk'
                              ? 'bg-background text-foreground shadow-sm'
                              : 'text-muted-foreground hover:text-foreground'
                          )}
                        >
                          SDK
                        </button>
                      </div>
                    </div>
                    <CodeBlock
                      code={sdkFramework === 'hono'
                        ? `import { honoPaymentMiddleware } from '@openfacilitator/sdk';

app.post('/api/resource', honoPaymentMiddleware({
  facilitator: '${facilitator}',
  getRequirements: (c) => ({
    scheme: 'exact',
    network: 'base',
    maxAmountRequired: '1000000',
    asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    payTo: '0xYourAddress',
  }),
  refundProtection: {
    apiKey: process.env.REFUND_API_KEY,
  },
}), async (c) => {
  // Your handler - failures auto-reported
  return c.json({ success: true });
});`
                        : sdkFramework === 'express'
                        ? `import { createPaymentMiddleware } from '@openfacilitator/sdk';

const paymentMiddleware = createPaymentMiddleware({
  facilitator: '${facilitator}',
  getRequirements: (req) => ({
    scheme: 'exact',
    network: 'base',
    maxAmountRequired: '1000000',
    asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    payTo: '0xYourAddress',
  }),
  refundProtection: {
    apiKey: process.env.REFUND_API_KEY,
  },
});

app.post('/api/resource', paymentMiddleware, async (req, res) => {
  // Your handler - failures auto-reported
  res.json({ success: true });
});`
                        : `import { OpenFacilitator, reportFailure } from '@openfacilitator/sdk';

const facilitator = new OpenFacilitator({
  url: 'https://${facilitator}'
});

// In your handler after payment settles:
async function handleRequest(paymentPayload, requirements) {
  // Verify and settle payment
  const result = await facilitator.settle(paymentPayload, requirements);

  if (!result.success) {
    throw new Error(result.errorReason);
  }

  try {
    // Your business logic here
    await doSomethingThatMightFail();
    return { success: true };
  } catch (error) {
    // Report failure for refund
    await reportFailure({
      facilitatorUrl: 'https://api.openfacilitator.io',
      apiKey: process.env.REFUND_API_KEY,
      originalTxHash: result.transaction,
      userWallet: result.payer,
      amount: requirements.maxAmountRequired,
      asset: requirements.asset,
      network: requirements.network,
      reason: error.message,
    });

    throw error;
  }
}`}
                      language="typescript"
                    />
                  </div>

                  {/* Docs links */}
                  <div className="flex flex-wrap gap-4">
                    <a
                      href="/docs/sdk/refunds"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                    >
                      <FileText className="h-4 w-4" />
                      Refund Protection Guide
                      <ExternalLink className="h-3 w-3" />
                    </a>
                    <a
                      href="/docs/sdk"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                    >
                      <FileText className="h-4 w-4" />
                      SDK Documentation
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Claims */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <DollarSign className="h-5 w-5" />
                      Claims
                    </CardTitle>
                    <CardDescription>
                      Review and manage refund claims from your servers.
                    </CardDescription>
                  </div>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[150px]">
                      <SelectValue placeholder="Filter status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="approved">Approved</SelectItem>
                      <SelectItem value="paid">Paid</SelectItem>
                      <SelectItem value="rejected">Rejected</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                {claims.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No claims yet</p>
                    <p className="text-sm">Claims will appear here when servers report failures.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {claims.map((claim) => (
                      <div key={claim.id} className="p-4 rounded-lg border">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0 space-y-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge
                                variant={
                                  claim.status === 'paid' ? 'default' :
                                  claim.status === 'approved' ? 'default' :
                                  claim.status === 'pending' ? 'secondary' :
                                  'destructive'
                                }
                                className={cn(
                                  claim.status === 'paid' && 'bg-green-500',
                                  claim.status === 'approved' && 'bg-blue-500',
                                )}
                              >
                                {claim.status === 'pending' && <Clock className="h-3 w-3 mr-1" />}
                                {claim.status === 'approved' && <CheckCircle2 className="h-3 w-3 mr-1" />}
                                {claim.status === 'paid' && <DollarSign className="h-3 w-3 mr-1" />}
                                {claim.status === 'rejected' && <XCircle className="h-3 w-3 mr-1" />}
                                {claim.status.charAt(0).toUpperCase() + claim.status.slice(1)}
                              </Badge>
                              <Badge variant="outline" className="capitalize">{claim.network}</Badge>
                              <span className="text-lg font-semibold">{formatAmount(claim.amount)}</span>
                            </div>
                            <div className="space-y-1 text-sm">
                              <div>
                                <span className="text-muted-foreground">User:</span>{' '}
                                <code className="font-mono text-xs">{formatAddress(claim.userWallet)}</code>
                              </div>
                              {claim.reason && (
                                <div>
                                  <span className="text-muted-foreground">Reason:</span> {claim.reason}
                                </div>
                              )}
                              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs pt-1">
                                <a
                                  href={getExplorerUrl(claim.network, claim.originalTxHash)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                                >
                                  Original: <code className="font-mono">{formatAddress(claim.originalTxHash)}</code>
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                                {claim.status === 'paid' && claim.payoutTxHash && (
                                  <a
                                    href={getExplorerUrl(claim.network, claim.payoutTxHash)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-green-600 hover:text-green-700 inline-flex items-center gap-1"
                                  >
                                    Refund: <code className="font-mono">{formatAddress(claim.payoutTxHash)}</code>
                                    <ExternalLink className="h-3 w-3" />
                                  </a>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-2 flex-shrink-0">
                            {claim.status === 'pending' && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => rejectClaim(claim.id)}
                                  disabled={processingClaims.has(claim.id)}
                                >
                                  {processingClaims.has(claim.id) ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    'Reject'
                                  )}
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={() => approveClaim(claim.id)}
                                  disabled={processingClaims.has(claim.id)}
                                >
                                  {processingClaims.has(claim.id) ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    'Approve'
                                  )}
                                </Button>
                              </>
                            )}
                            {claim.status === 'approved' && (
                              <Button
                                size="sm"
                                onClick={() => executePayout(claim.id)}
                                disabled={processingClaims.has(claim.id)}
                              >
                                {processingClaims.has(claim.id) ? (
                                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                ) : null}
                                Execute Payout
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Create API Key Dialog */}
        <Dialog open={isAddServerOpen} onOpenChange={setIsAddServerOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Create API Key</DialogTitle>
              <DialogDescription>
                Create an API key to authenticate failure reports from your servers. One key works for all your resources.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="serverName">Label</Label>
                <Input
                  id="serverName"
                  value={serverName}
                  onChange={(e) => setServerName(e.target.value)}
                  placeholder="Production API"
                />
                <p className="text-xs text-muted-foreground">
                  A name to help you identify this key (e.g., &ldquo;Production&rdquo;, &ldquo;Staging&rdquo;)
                </p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="serverUrl">Server URL (optional)</Label>
                <Input
                  id="serverUrl"
                  value={serverUrl}
                  onChange={(e) => setServerUrl(e.target.value)}
                  placeholder="https://api.example.com"
                />
                <p className="text-xs text-muted-foreground">
                  For your reference only. The key works for any endpoint.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddServerOpen(false)}>
                Cancel
              </Button>
              <Button onClick={registerServer} disabled={!serverName && !serverUrl}>
                Create API Key
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit API Key Dialog */}
        <Dialog open={isEditServerOpen} onOpenChange={(open) => {
          setIsEditServerOpen(open);
          if (!open) {
            setEditingServer(null);
            setServerName('');
            setServerUrl('');
          }
        }}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Edit API Key</DialogTitle>
              <DialogDescription>
                Update the label or URL for this API key.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="editServerName">Label</Label>
                <Input
                  id="editServerName"
                  value={serverName}
                  onChange={(e) => setServerName(e.target.value)}
                  placeholder="Production API"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="editServerUrl">Server URL (optional)</Label>
                <Input
                  id="editServerUrl"
                  value={serverUrl}
                  onChange={(e) => setServerUrl(e.target.value)}
                  placeholder="https://api.example.com"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setIsEditServerOpen(false);
                setEditingServer(null);
                setServerName('');
                setServerUrl('');
              }}>
                Cancel
              </Button>
              <Button onClick={updateServer}>
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* API Key Dialog */}
        <Dialog open={!!newApiKey} onOpenChange={() => setNewApiKey(null)}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Server API Key</DialogTitle>
              <DialogDescription>
                Save this API key securely. It will not be shown again.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  value={showApiKey ? newApiKey || '' : '***********************************'}
                  className="font-mono text-sm"
                />
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
                  onClick={() => newApiKey && handleCopy(newApiKey, 'apiKey')}
                >
                  {copiedId === 'apiKey' ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Use this API key in the <code>X-Server-Api-Key</code> header when calling the{' '}
                <code>/claims/report-failure</code> endpoint.
              </p>
            </div>
            <DialogFooter>
              <Button onClick={() => { setNewApiKey(null); setShowApiKey(false); }}>Done</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}

export default function ClaimsSetupPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    }>
      <ClaimsSetupContent />
    </Suspense>
  );
}
