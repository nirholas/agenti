'use client';

import { format } from 'date-fns';
import { Award, CheckCircle, Clock, Gift, TrendingUp, XCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { CampaignHistoryItem } from '@/lib/api';

interface CampaignHistoryProps {
  history: CampaignHistoryItem[];
}

function formatUSDC(amount: string): string {
  const value = Number(amount) / 1_000_000;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatNumber(amount: string | null): string {
  if (!amount) return '0';
  const value = Number(amount) / 1_000_000;
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

export function CampaignHistory({ history }: CampaignHistoryProps) {
  // Calculate lifetime stats
  const lifetimeStats = history.reduce(
    (acc, item) => {
      const volume = Number(item.userVolume) / 1_000_000;
      acc.totalVolume += volume;
      if (item.metThreshold) {
        acc.campaignsParticipated += 1;
        if (item.claimed && item.estimatedReward) {
          acc.totalRewards += Number(item.estimatedReward) / 1_000_000;
        }
      }
      return acc;
    },
    { totalRewards: 0, totalVolume: 0, campaignsParticipated: 0 }
  );

  const participated = history.filter((h) => Number(h.userVolume) > 0);
  const notParticipated = history.filter((h) => Number(h.userVolume) === 0);

  return (
    <div className="space-y-6">
      {/* Lifetime Stats */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Lifetime Stats</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="flex items-center justify-center mb-2">
                <Gift className="h-5 w-5 text-primary" />
              </div>
              <p className="text-2xl font-bold">
                {lifetimeStats.totalRewards.toLocaleString('en-US', {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                })}
              </p>
              <p className="text-xs text-muted-foreground">$OPEN Earned</p>
            </div>
            <div>
              <div className="flex items-center justify-center mb-2">
                <TrendingUp className="h-5 w-5 text-primary" />
              </div>
              <p className="text-2xl font-bold">
                ${lifetimeStats.totalVolume.toLocaleString('en-US', {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                })}
              </p>
              <p className="text-xs text-muted-foreground">Total Volume</p>
            </div>
            <div>
              <div className="flex items-center justify-center mb-2">
                <Award className="h-5 w-5 text-primary" />
              </div>
              <p className="text-2xl font-bold">{lifetimeStats.campaignsParticipated}</p>
              <p className="text-xs text-muted-foreground">Campaigns Qualified</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Campaign History */}
      <div>
        <h3 className="font-semibold mb-4">Past Campaigns</h3>
        {history.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">No campaign history</p>
              <p className="text-sm">Your past campaign participation will appear here.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {/* Participated Campaigns */}
            {participated.map((item) => (
              <Card key={item.campaign.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-semibold">{item.campaign.name}</h4>
                        {item.metThreshold ? (
                          <Badge className="bg-green-500">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Qualified
                          </Badge>
                        ) : (
                          <Badge variant="secondary">
                            <XCircle className="h-3 w-3 mr-1" />
                            Did not qualify
                          </Badge>
                        )}
                        {item.multiplierApplied > 1 && (
                          <Badge variant="outline" className="text-primary border-primary">
                            {item.multiplierApplied}x multiplier
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(item.campaign.starts_at), 'MMM d, yyyy')} -{' '}
                        {format(new Date(item.campaign.ends_at), 'MMM d, yyyy')}
                      </p>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm pt-2">
                        <div>
                          <p className="text-muted-foreground">Your Volume</p>
                          <p className="font-semibold">{formatUSDC(item.userVolume)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Rank</p>
                          <p className="font-semibold">
                            {item.userRank ? `#${item.userRank}` : 'N/A'}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Reward</p>
                          <p className="font-semibold text-primary">
                            {item.metThreshold && item.estimatedReward
                              ? `${formatNumber(item.estimatedReward)} $OPEN`
                              : '-'}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Status</p>
                          <p className="font-semibold">
                            {item.claimed ? (
                              <span className="text-green-600">Claimed</span>
                            ) : item.metThreshold ? (
                              <span className="text-amber-600">Pending</span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            {/* Not Participated Campaigns (dimmed) */}
            {notParticipated.map((item) => (
              <Card key={item.campaign.id} className="opacity-60">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-semibold">{item.campaign.name}</h4>
                        <Badge variant="outline">Did not participate</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(item.campaign.starts_at), 'MMM d, yyyy')} -{' '}
                        {format(new Date(item.campaign.ends_at), 'MMM d, yyyy')}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Pool: {formatNumber(item.campaign.pool_amount)} $OPEN
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
