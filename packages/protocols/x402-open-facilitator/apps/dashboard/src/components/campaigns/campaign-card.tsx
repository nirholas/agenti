'use client';

import { format } from 'date-fns';
import { Calendar, DollarSign, Edit2, Play, Square, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { Campaign } from '@/lib/api';

interface CampaignCardProps {
  campaign: Campaign;
  isAdmin?: boolean;
  onEdit?: () => void;
  onPublish?: () => void;
  onEnd?: () => void;
  onDelete?: () => void;
}

const statusConfig: Record<Campaign['status'], { label: string; className: string }> = {
  draft: { label: 'Draft', className: 'bg-gray-500' },
  published: { label: 'Published', className: 'bg-blue-500' },
  active: { label: 'Active', className: 'bg-green-500' },
  ended: { label: 'Ended', className: 'bg-gray-400' },
};

function formatUSDC(amount: string): string {
  const value = Number(amount) / 1_000_000;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

export function CampaignCard({
  campaign,
  isAdmin = false,
  onEdit,
  onPublish,
  onEnd,
  onDelete,
}: CampaignCardProps) {
  const status = statusConfig[campaign.status];
  const canEdit = campaign.status === 'draft' || campaign.status === 'published';
  const canPublish = campaign.status === 'draft';
  const canEnd = campaign.status === 'active';
  const canDelete = campaign.status === 'draft';

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <div>
          <CardTitle className="text-lg">{campaign.name}</CardTitle>
          <Badge className={status.className}>{status.label}</Badge>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            {canEdit && onEdit && (
              <Button variant="ghost" size="sm" onClick={onEdit}>
                <Edit2 className="h-4 w-4" />
              </Button>
            )}
            {canDelete && onDelete && (
              <Button variant="ghost" size="sm" onClick={onDelete}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            )}
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Pool Amount</p>
            <p className="font-semibold flex items-center gap-1">
              <DollarSign className="h-4 w-4" />
              {formatUSDC(campaign.pool_amount)} OPEN
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Threshold</p>
            <p className="font-semibold">{formatUSDC(campaign.threshold_amount)} volume</p>
          </div>
          <div>
            <p className="text-muted-foreground">Start Date</p>
            <p className="flex items-center gap-1">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              {format(new Date(campaign.starts_at), 'MMM d, yyyy')}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">End Date</p>
            <p className="flex items-center gap-1">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              {format(new Date(campaign.ends_at), 'MMM d, yyyy')}
            </p>
          </div>
        </div>

        {campaign.multiplier_facilitator > 1 && (
          <div className="rounded-md bg-primary/10 p-2 text-center">
            <span className="text-sm font-medium text-primary">
              {campaign.multiplier_facilitator}x multiplier for facilitator owners
            </span>
          </div>
        )}

        {isAdmin && (canPublish || canEnd) && (
          <div className="flex gap-2 pt-2">
            {canPublish && onPublish && (
              <Button onClick={onPublish} className="flex-1">
                <Play className="h-4 w-4 mr-2" />
                Publish Campaign
              </Button>
            )}
            {canEnd && onEnd && (
              <Button variant="destructive" onClick={onEnd} className="flex-1">
                <Square className="h-4 w-4 mr-2" />
                End Campaign
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
