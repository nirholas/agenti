'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notFound } from 'next/navigation';
import { ChevronDown, Loader2, Plus, Trophy } from 'lucide-react';
import { Navbar } from '@/components/navbar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { CampaignCard } from '@/components/campaigns/campaign-card';
import { CampaignForm } from '@/components/campaigns/campaign-form';
import { api, type Campaign } from '@/lib/api';
import { useAuth } from '@/components/auth/auth-provider';
import { useToast } from '@/hooks/use-toast';

type ConfirmAction = {
  type: 'publish' | 'end' | 'delete';
  campaign: Campaign;
};

export default function CampaignAdminPage() {
  const { isAdmin, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [formOpen, setFormOpen] = useState(false);
  const [editCampaign, setEditCampaign] = useState<Campaign | undefined>();
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [endedExpanded, setEndedExpanded] = useState(false);

  // Return 404 for non-admin users (security: don't reveal admin page exists)
  if (!authLoading && !isAdmin) {
    notFound();
  }

  const { data: campaigns, isLoading } = useQuery({
    queryKey: ['campaigns'],
    queryFn: () => api.getCampaigns(),
    enabled: isAdmin,
  });

  const publishMutation = useMutation({
    mutationFn: (id: string) => api.publishCampaign(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      toast({ title: 'Campaign published successfully' });
      setConfirmAction(null);
    },
    onError: (error) => {
      toast({
        title: 'Failed to publish campaign',
        description: error instanceof Error ? error.message : 'Something went wrong',
        variant: 'destructive',
      });
    },
  });

  const endMutation = useMutation({
    mutationFn: (id: string) => api.endCampaign(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      toast({ title: 'Campaign ended successfully' });
      setConfirmAction(null);
    },
    onError: (error) => {
      toast({
        title: 'Failed to end campaign',
        description: error instanceof Error ? error.message : 'Something went wrong',
        variant: 'destructive',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteCampaign(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      toast({ title: 'Campaign deleted successfully' });
      setConfirmAction(null);
    },
    onError: (error) => {
      toast({
        title: 'Failed to delete campaign',
        description: error instanceof Error ? error.message : 'Something went wrong',
        variant: 'destructive',
      });
    },
  });

  const handleEdit = (campaign: Campaign) => {
    setEditCampaign(campaign);
    setFormOpen(true);
  };

  const handleFormClose = (open: boolean) => {
    setFormOpen(open);
    if (!open) {
      setEditCampaign(undefined);
    }
  };

  const handleConfirmAction = () => {
    if (!confirmAction) return;

    switch (confirmAction.type) {
      case 'publish':
        publishMutation.mutate(confirmAction.campaign.id);
        break;
      case 'end':
        endMutation.mutate(confirmAction.campaign.id);
        break;
      case 'delete':
        deleteMutation.mutate(confirmAction.campaign.id);
        break;
    }
  };

  const isPending = publishMutation.isPending || endMutation.isPending || deleteMutation.isPending;

  // Categorize campaigns
  const activeCampaigns = campaigns?.filter((c) => c.status === 'active') ?? [];
  const publishedCampaigns = campaigns?.filter((c) => c.status === 'published') ?? [];
  const draftCampaigns = campaigns?.filter((c) => c.status === 'draft') ?? [];
  const endedCampaigns = campaigns?.filter((c) => c.status === 'ended') ?? [];

  const confirmMessages: Record<ConfirmAction['type'], { title: string; description: string; action: string }> = {
    publish: {
      title: 'Publish Campaign',
      description: 'This will make the campaign visible to users. It will become active when the start date is reached.',
      action: 'Publish',
    },
    end: {
      title: 'End Campaign Early',
      description: 'This will immediately end the campaign. Users will keep any rewards they have already earned. This action cannot be undone.',
      action: 'End Campaign',
    },
    delete: {
      title: 'Delete Campaign',
      description: 'This will permanently delete the campaign. This action cannot be undone.',
      action: 'Delete',
    },
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="max-w-4xl mx-auto px-4 pt-24 pb-12">
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
              <Trophy className="h-8 w-8 text-primary" />
              Campaign Management
            </h1>
            <p className="text-muted-foreground mt-2">
              Create and manage rewards campaigns.
            </p>
          </div>
          <Button onClick={() => setFormOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Campaign
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-8">
            {/* Active Campaigns */}
            {activeCampaigns.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold mb-4">Active Campaign</h2>
                <div className="space-y-4">
                  {activeCampaigns.map((campaign) => (
                    <CampaignCard
                      key={campaign.id}
                      campaign={campaign}
                      isAdmin
                      onEdit={() => handleEdit(campaign)}
                      onEnd={() => setConfirmAction({ type: 'end', campaign })}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Published Campaigns */}
            {publishedCampaigns.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold mb-4">Published Campaigns</h2>
                <p className="text-sm text-muted-foreground mb-4">
                  These campaigns are visible to users and will become active when their start date is reached.
                </p>
                <div className="space-y-4">
                  {publishedCampaigns.map((campaign) => (
                    <CampaignCard
                      key={campaign.id}
                      campaign={campaign}
                      isAdmin
                      onEdit={() => handleEdit(campaign)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Draft Campaigns */}
            <div>
              <h2 className="text-lg font-semibold mb-4">Draft Campaigns</h2>
              {draftCampaigns.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    <p>No draft campaigns. Create one to get started.</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {draftCampaigns.map((campaign) => (
                    <CampaignCard
                      key={campaign.id}
                      campaign={campaign}
                      isAdmin
                      onEdit={() => handleEdit(campaign)}
                      onPublish={() => setConfirmAction({ type: 'publish', campaign })}
                      onDelete={() => setConfirmAction({ type: 'delete', campaign })}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Ended Campaigns (Collapsible) */}
            {endedCampaigns.length > 0 && (
              <Collapsible open={endedExpanded} onOpenChange={setEndedExpanded}>
                <CollapsibleTrigger asChild>
                  <button className="flex items-center gap-2 text-lg font-semibold hover:text-primary transition-colors">
                    <ChevronDown
                      className={`h-5 w-5 transition-transform ${
                        endedExpanded ? 'rotate-180' : ''
                      }`}
                    />
                    Ended Campaigns ({endedCampaigns.length})
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-4">
                  <div className="space-y-4">
                    {endedCampaigns.map((campaign) => (
                      <CampaignCard
                        key={campaign.id}
                        campaign={campaign}
                        isAdmin={false}
                      />
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}
          </div>
        )}

        {/* Campaign Form Modal */}
        <CampaignForm
          open={formOpen}
          onOpenChange={handleFormClose}
          campaign={editCampaign}
        />

        {/* Confirmation Dialog */}
        <Dialog open={!!confirmAction} onOpenChange={() => setConfirmAction(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{confirmAction && confirmMessages[confirmAction.type].title}</DialogTitle>
              <DialogDescription>
                {confirmAction && confirmMessages[confirmAction.type].description}
              </DialogDescription>
            </DialogHeader>
            {confirmAction && (
              <div className="py-4">
                <p className="text-sm">
                  <span className="font-semibold">Campaign:</span> {confirmAction.campaign.name}
                </p>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmAction(null)} disabled={isPending}>
                Cancel
              </Button>
              <Button
                variant={confirmAction?.type === 'delete' ? 'destructive' : 'default'}
                onClick={handleConfirmAction}
                disabled={isPending}
              >
                {isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  confirmAction && confirmMessages[confirmAction.type].action
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
