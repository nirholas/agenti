'use client';

import { useQuery } from '@tanstack/react-query';
import { Loader2, Clock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { ClaimHistory } from './claim-history';
import { CampaignHistory } from '@/components/campaigns/campaign-history';
import { api } from '@/lib/api';

export function HistoryTab() {
  // Fetch claim history
  const { data: claimHistoryData, isLoading: claimHistoryLoading } = useQuery({
    queryKey: ['claimHistory'],
    queryFn: () => api.getClaimHistory(),
  });

  // Fetch campaign history
  const { data: campaignHistoryData, isLoading: campaignHistoryLoading } = useQuery({
    queryKey: ['campaignHistory'],
    queryFn: () => api.getCampaignHistory(),
  });

  // Loading state (both must finish)
  if (claimHistoryLoading && campaignHistoryLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const claims = claimHistoryData?.claims ?? [];
  const campaigns = campaignHistoryData ?? [];
  const hasClaims = claims.length > 0;
  const hasCampaigns = campaigns.length > 0;

  // Empty state when no history at all
  if (!hasClaims && !hasCampaigns && !claimHistoryLoading && !campaignHistoryLoading) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="text-lg font-medium">No History Yet</p>
          <p className="text-sm">
            Your claim and campaign history will appear here.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-8">
      {/* Claims section - shown first per user decision */}
      {hasClaims && (
        <div>
          <ClaimHistory claims={claims} />
        </div>
      )}

      {/* Campaign History section */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Campaign History</h2>
        {campaignHistoryLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : hasCampaigns ? (
          <CampaignHistory history={campaigns} />
        ) : (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              <p>No campaigns yet</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
