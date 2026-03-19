'use client';

import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Loader2,
  Users,
  Wallet,
  Server,
  ReceiptText,
  DollarSign,
  Clock,
  ExternalLink,
  Info,
  Shield,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { api, type Facilitator, type ResourceOwner, type ResourceOwnerDetail, type MyResourceOwner } from '@/lib/api';
import { cn, formatAddress } from '@/lib/utils';
import {
  RefundWallets,
  RegisteredServers,
  SDKIntegration,
  ClaimsList,
  type RefundWallet,
  type RegisteredServer,
  type Claim,
  type ClaimStats,
} from '@/components/resource-owner';

interface RefundsSectionProps {
  facilitatorId: string;
  facilitator: Facilitator;
}

export function RefundsSection({ facilitatorId, facilitator }: RefundsSectionProps) {
  const queryClient = useQueryClient();
  const [selectedOwner, setSelectedOwner] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showThirdPartyOwners, setShowThirdPartyOwners] = useState(false);

  // Registration form state
  const [regName, setRegName] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [registrationError, setRegistrationError] = useState<string | null>(null);

  // Use domain for API calls and URLs (prefer customDomain over subdomain)
  const facilitatorIdentifier = facilitator.customDomain || facilitator.subdomain;

  // Queries
  const { data: configData, isLoading: configLoading } = useQuery({
    queryKey: ['refundConfig', facilitatorId],
    queryFn: () => api.getRefundConfig(facilitatorId),
  });

  const { data: overviewData, isLoading: overviewLoading } = useQuery({
    queryKey: ['refundsOverview', facilitatorId],
    queryFn: () => api.getRefundsOverview(facilitatorId),
  });

  const { data: resourceOwnersData, isLoading: ownersLoading } = useQuery({
    queryKey: ['resourceOwners', facilitatorId],
    queryFn: () => api.getResourceOwners(facilitatorId),
    enabled: configData?.enabled,
  });

  const { data: ownerDetail, isLoading: detailLoading } = useQuery({
    queryKey: ['resourceOwner', facilitatorId, selectedOwner],
    queryFn: () => selectedOwner ? api.getResourceOwner(facilitatorId, selectedOwner) : null,
    enabled: !!selectedOwner,
  });

  // Current user's resource owner status
  const { data: myResourceOwner, isLoading: myResourceOwnerLoading } = useQuery({
    queryKey: ['myResourceOwner', facilitatorIdentifier],
    queryFn: () => api.getMyResourceOwner(facilitatorIdentifier),
    enabled: configData?.enabled,
  });

  // My wallets, servers, and claims
  const { data: myWalletsData, isLoading: myWalletsLoading } = useQuery({
    queryKey: ['myWallets', myResourceOwner?.id],
    queryFn: () => myResourceOwner ? api.getMyWallets(myResourceOwner.id) : null,
    enabled: !!myResourceOwner,
  });

  const { data: myServersData, isLoading: myServersLoading } = useQuery({
    queryKey: ['myServers', myResourceOwner?.id],
    queryFn: () => myResourceOwner ? api.getMyServers(myResourceOwner.id) : null,
    enabled: !!myResourceOwner,
  });

  const { data: myClaimsData, isLoading: myClaimsLoading } = useQuery({
    queryKey: ['myClaims', myResourceOwner?.id, statusFilter],
    queryFn: () => myResourceOwner ? api.getMyClaims(myResourceOwner.id, statusFilter) : null,
    enabled: !!myResourceOwner,
  });

  // Mutations
  const updateConfigMutation = useMutation({
    mutationFn: (enabled: boolean) => api.updateRefundConfig(facilitatorId, { enabled }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['refundConfig', facilitatorId] });
    },
  });

  const setupUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/refunds/setup?facilitator=${facilitatorIdentifier}`;

  // Registration handler
  const handleRegister = async () => {
    setRegistrationError(null);
    setIsRegistering(true);
    try {
      await api.registerAsResourceOwner(facilitatorIdentifier, {
        name: regName || undefined,
      });
      queryClient.invalidateQueries({ queryKey: ['myResourceOwner', facilitatorIdentifier] });
      setRegName('');
    } catch (err) {
      setRegistrationError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setIsRegistering(false);
    }
  };

  // Wallet handlers
  const handleGenerateWallet = useCallback(async (network: string) => {
    if (!myResourceOwner) return;
    await api.generateMyWallet(myResourceOwner.id, network);
    queryClient.invalidateQueries({ queryKey: ['myWallets', myResourceOwner.id] });
  }, [myResourceOwner, queryClient]);

  const handleDeleteWallet = useCallback(async (network: string) => {
    if (!myResourceOwner) return;
    await api.deleteMyWallet(myResourceOwner.id, network);
    queryClient.invalidateQueries({ queryKey: ['myWallets', myResourceOwner.id] });
  }, [myResourceOwner, queryClient]);

  // Server handlers
  const handleRegisterServer = useCallback(async (name: string) => {
    if (!myResourceOwner) return { apiKey: undefined };
    const result = await api.registerMyServer(myResourceOwner.id, { name });
    queryClient.invalidateQueries({ queryKey: ['myServers', myResourceOwner.id] });
    return { apiKey: result.apiKey };
  }, [myResourceOwner, queryClient]);

  const handleDeleteServer = useCallback(async (serverId: string) => {
    if (!myResourceOwner) return;
    await api.deleteMyServer(myResourceOwner.id, serverId);
    queryClient.invalidateQueries({ queryKey: ['myServers', myResourceOwner.id] });
  }, [myResourceOwner, queryClient]);

  const handleRegenerateApiKey = useCallback(async (serverId: string) => {
    if (!myResourceOwner) return { apiKey: undefined };
    const result = await api.regenerateMyServerApiKey(myResourceOwner.id, serverId);
    return { apiKey: result.apiKey };
  }, [myResourceOwner]);

  const handleRenameServer = useCallback(async (serverId: string, name: string) => {
    if (!myResourceOwner) return;
    await api.renameMyServer(myResourceOwner.id, serverId, name);
    queryClient.invalidateQueries({ queryKey: ['myServers', myResourceOwner.id] });
  }, [myResourceOwner, queryClient]);

  // Claim handlers
  const handleApproveClaim = useCallback(async (claimId: string) => {
    if (!myResourceOwner) return;
    await api.approveMyClaim(myResourceOwner.id, claimId);
    queryClient.invalidateQueries({ queryKey: ['myClaims', myResourceOwner.id] });
  }, [myResourceOwner, queryClient]);

  const handleRejectClaim = useCallback(async (claimId: string) => {
    if (!myResourceOwner) return;
    await api.rejectMyClaim(myResourceOwner.id, claimId);
    queryClient.invalidateQueries({ queryKey: ['myClaims', myResourceOwner.id] });
  }, [myResourceOwner, queryClient]);

  const handleExecutePayout = useCallback(async (claimId: string) => {
    if (!myResourceOwner) return;
    await api.executeMyClaimPayout(myResourceOwner.id, claimId);
    queryClient.invalidateQueries({ queryKey: ['myClaims', myResourceOwner.id] });
  }, [myResourceOwner, queryClient]);

  // Count third-party resource owners (excluding current user)
  const thirdPartyOwners = resourceOwnersData?.resourceOwners.filter(
    (owner) => owner.id !== myResourceOwner?.id
  ) || [];

  return (
    <div className="space-y-6">
      {/* Enable/Disable Toggle */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Refund Protection</CardTitle>
              <CardDescription>
                Enable automatic refund protection for your facilitator.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {configData?.enabled ? 'Enabled' : 'Disabled'}
              </span>
              <Switch
                checked={configData?.enabled || false}
                onCheckedChange={(checked) => updateConfigMutation.mutate(checked)}
                disabled={configLoading || updateConfigMutation.isPending}
              />
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Only show content if refunds are enabled */}
      {configData?.enabled && (
        <>
          {/* My Refund Protection Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                My Refund Protection
              </CardTitle>
              <CardDescription>
                Configure refund wallets and servers for your own resources on this facilitator.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {myResourceOwnerLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : !myResourceOwner ? (
                /* Inline Registration Form */
                <div className="max-w-md space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Register to set up refund wallets and servers for your own resources.
                  </p>

                  {registrationError && (
                    <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                      {registrationError}
                    </div>
                  )}

                  <div className="grid gap-2">
                    <Label htmlFor="regName">Display Name (optional)</Label>
                    <Input
                      id="regName"
                      value={regName}
                      onChange={(e) => setRegName(e.target.value)}
                      placeholder="My API Service"
                    />
                  </div>

                  <Button onClick={handleRegister} disabled={isRegistering}>
                    {isRegistering ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                    )}
                    Set Up My Refund Protection
                  </Button>
                </div>
              ) : (
                /* Inline Resource Owner Dashboard */
                <div className="space-y-6">
                  {/* Wallets */}
                  {myWalletsLoading ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <RefundWallets
                      wallets={myWalletsData?.wallets || []}
                      supportedNetworks={myWalletsData?.supportedNetworks || []}
                      onGenerateWallet={handleGenerateWallet}
                      onDeleteWallet={handleDeleteWallet}
                    />
                  )}

                  {/* Servers */}
                  {myServersLoading ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <RegisteredServers
                      servers={myServersData?.servers || []}
                      onRegisterServer={handleRegisterServer}
                      onDeleteServer={handleDeleteServer}
                      onRegenerateApiKey={handleRegenerateApiKey}
                      onRenameServer={handleRenameServer}
                    />
                  )}

                  {/* SDK Integration - only show if servers exist */}
                  {(myServersData?.servers?.length || 0) > 0 && (
                    <SDKIntegration
                      facilitator={facilitatorIdentifier}
                      serverUrl={myServersData?.servers[0]?.url}
                    />
                  )}

                  {/* Claims */}
                  {myClaimsLoading ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <ClaimsList
                      claims={myClaimsData?.claims || []}
                      claimStats={myClaimsData?.stats || null}
                      statusFilter={statusFilter}
                      onStatusFilterChange={setStatusFilter}
                      onApproveClaim={handleApproveClaim}
                      onRejectClaim={handleRejectClaim}
                      onExecutePayout={handleExecutePayout}
                    />
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Third-party Resource Owners Section */}
          <Collapsible open={showThirdPartyOwners} onOpenChange={setShowThirdPartyOwners}>
            <Card>
              <CardHeader>
                <CollapsibleTrigger asChild>
                  <div className="flex items-center justify-between cursor-pointer">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Users className="h-5 w-5" />
                        Third-Party Resource Owners
                        <Badge variant="secondary" className="ml-2">
                          {thirdPartyOwners.length}
                        </Badge>
                      </CardTitle>
                      <CardDescription>
                        Other developers using your facilitator for refund protection.
                      </CardDescription>
                    </div>
                    <Button variant="ghost" size="sm">
                      {showThirdPartyOwners ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </CollapsibleTrigger>
              </CardHeader>
              <CollapsibleContent>
                <CardContent className="pt-0 space-y-4">
                  {/* Share link */}
                  <div className="p-4 rounded-lg bg-muted/50 border">
                    <div className="flex items-start gap-3">
                      <Info className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                      <div className="space-y-2">
                        <p className="text-sm font-medium">Share with Resource Owners</p>
                        <p className="text-xs text-muted-foreground">
                          Third-party API owners can set up their own refund protection using this link:
                        </p>
                        <code className="text-xs bg-background px-2 py-1 rounded border block overflow-x-auto">
                          {setupUrl}
                        </code>
                      </div>
                    </div>
                  </div>

                  {/* Overview Stats */}
                  {overviewData && (
                    <div className="grid gap-4 md:grid-cols-4">
                      <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                        <div className="p-2 rounded-lg bg-blue-500/10">
                          <Users className="h-4 w-4 text-blue-500" />
                        </div>
                        <div>
                          <p className="text-lg font-bold">{overviewData.resourceOwners}</p>
                          <p className="text-xs text-muted-foreground">Resource Owners</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                        <div className="p-2 rounded-lg bg-green-500/10">
                          <Wallet className="h-4 w-4 text-green-500" />
                        </div>
                        <div>
                          <p className="text-lg font-bold">${overviewData.totalWalletBalance}</p>
                          <p className="text-xs text-muted-foreground">Total Balance</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                        <div className="p-2 rounded-lg bg-purple-500/10">
                          <Server className="h-4 w-4 text-purple-500" />
                        </div>
                        <div>
                          <p className="text-lg font-bold">{overviewData.totalServers}</p>
                          <p className="text-xs text-muted-foreground">Active Servers</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                        <div className="p-2 rounded-lg bg-orange-500/10">
                          <ReceiptText className="h-4 w-4 text-orange-500" />
                        </div>
                        <div>
                          <p className="text-lg font-bold">{overviewData.claims?.pending || 0}</p>
                          <p className="text-xs text-muted-foreground">Pending Claims</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Resource Owners List */}
                  {ownersLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : thirdPartyOwners.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No third-party resource owners registered yet</p>
                      <p className="text-sm">Share the setup URL with API owners who want refund protection.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {thirdPartyOwners.map((owner) => (
                        <div
                          key={owner.id}
                          className="flex items-center justify-between p-4 rounded-lg border hover:bg-accent/50 cursor-pointer transition-colors"
                          onClick={() => setSelectedOwner(owner.id)}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{owner.name || 'Unnamed'}</span>
                              {owner.refundAddress && (
                                <code className="text-xs text-muted-foreground font-mono">
                                  {formatAddress(owner.refundAddress)}
                                </code>
                              )}
                            </div>
                            <div className="flex gap-4 mt-2 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Wallet className="h-3 w-3" /> {owner.stats.wallets} wallets
                              </span>
                              <span className="flex items-center gap-1">
                                <Server className="h-3 w-3" /> {owner.stats.servers} servers
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" /> {owner.stats.pendingClaims} pending
                              </span>
                              <span className="flex items-center gap-1">
                                <DollarSign className="h-3 w-3" /> ${owner.stats.totalPaidAmount} paid
                              </span>
                            </div>
                          </div>
                          <ExternalLink className="h-4 w-4 text-muted-foreground" />
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        </>
      )}

      {/* Resource Owner Detail Dialog */}
      <Dialog open={!!selectedOwner} onOpenChange={() => setSelectedOwner(null)}>
        <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Resource Owner Details</DialogTitle>
            <DialogDescription>
              {ownerDetail?.name || 'Unnamed'}
              {ownerDetail?.refundAddress && (
                <> · Refund Address: <code className="font-mono">{formatAddress(ownerDetail.refundAddress)}</code></>
              )}
            </DialogDescription>
          </DialogHeader>
          {detailLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : ownerDetail ? (
            <div className="space-y-6">
              {/* Stats */}
              <div className="grid grid-cols-4 gap-4">
                <div className="text-center p-3 rounded-lg bg-muted/50">
                  <p className="text-xl font-bold">{ownerDetail.claimStats.totalClaims}</p>
                  <p className="text-xs text-muted-foreground">Total Claims</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-yellow-500/10">
                  <p className="text-xl font-bold text-yellow-600">{ownerDetail.claimStats.pendingClaims}</p>
                  <p className="text-xs text-muted-foreground">Pending</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-green-500/10">
                  <p className="text-xl font-bold text-green-600">{ownerDetail.claimStats.paidClaims}</p>
                  <p className="text-xs text-muted-foreground">Paid</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-green-500/10">
                  <p className="text-xl font-bold text-green-600">${ownerDetail.claimStats.totalPaidAmount}</p>
                  <p className="text-xs text-muted-foreground">Total Paid</p>
                </div>
              </div>

              {/* Wallets */}
              <div>
                <h4 className="text-sm font-medium mb-2">Refund Wallets</h4>
                {ownerDetail.wallets.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No wallets configured</p>
                ) : (
                  <div className="space-y-2">
                    {ownerDetail.wallets.map((wallet) => (
                      <div key={wallet.network} className="flex items-center justify-between p-3 rounded-lg border">
                        <div>
                          <Badge variant="outline" className="capitalize">{wallet.network}</Badge>
                          <code className="text-xs ml-2 font-mono">{formatAddress(wallet.address)}</code>
                        </div>
                        <span className="font-medium">${wallet.balance}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Servers */}
              <div>
                <h4 className="text-sm font-medium mb-2">Registered Servers</h4>
                {ownerDetail.servers.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No servers registered</p>
                ) : (
                  <div className="space-y-2">
                    {ownerDetail.servers.map((server) => (
                      <div key={server.id} className="flex items-center justify-between p-3 rounded-lg border">
                        <div>
                          <span className="font-medium">{server.name || 'Unnamed'}</span>
                          <p className="text-xs text-muted-foreground truncate">{server.url}</p>
                        </div>
                        <Badge variant={server.active ? 'default' : 'secondary'}>
                          {server.active ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Recent Claims */}
              <div>
                <h4 className="text-sm font-medium mb-2">Recent Claims</h4>
                {ownerDetail.recentClaims.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No claims yet</p>
                ) : (
                  <div className="space-y-2">
                    {ownerDetail.recentClaims.slice(0, 5).map((claim) => (
                      <div key={claim.id} className="flex items-center justify-between p-3 rounded-lg border">
                        <div>
                          <div className="flex items-center gap-2">
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
                              {claim.status}
                            </Badge>
                            <span className="font-medium">${(Number(claim.amount) / 1_000_000).toFixed(2)}</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            To: {formatAddress(claim.userWallet)}
                          </p>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {new Date(claim.reportedAt).toLocaleDateString()}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
