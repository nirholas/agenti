'use client';

import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
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
import { api, type Campaign, type CreateCampaignRequest } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

interface CampaignFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaign?: Campaign;
  onSuccess?: () => void;
}

function toDateTimeLocal(isoString: string): string {
  const date = new Date(isoString);
  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - offset * 60 * 1000);
  return localDate.toISOString().slice(0, 16);
}

function fromDateTimeLocal(localString: string): string {
  return new Date(localString).toISOString();
}

export function CampaignForm({ open, onOpenChange, campaign, onSuccess }: CampaignFormProps) {
  const [name, setName] = useState('');
  const [poolAmount, setPoolAmount] = useState('');
  const [thresholdAmount, setThresholdAmount] = useState('');
  const [multiplier, setMultiplier] = useState('2');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isEditing = !!campaign;

  useEffect(() => {
    if (campaign) {
      setName(campaign.name);
      setPoolAmount((Number(campaign.pool_amount) / 1_000_000).toString());
      setThresholdAmount((Number(campaign.threshold_amount) / 1_000_000).toString());
      setMultiplier(campaign.multiplier_facilitator.toString());
      setStartsAt(toDateTimeLocal(campaign.starts_at));
      setEndsAt(toDateTimeLocal(campaign.ends_at));
    } else {
      setName('');
      setPoolAmount('');
      setThresholdAmount('');
      setMultiplier('2');
      setStartsAt('');
      setEndsAt('');
    }
    setErrors({});
  }, [campaign, open]);

  const createMutation = useMutation({
    mutationFn: (data: CreateCampaignRequest) => api.createCampaign(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      toast({ title: 'Campaign created successfully' });
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (error) => {
      toast({
        title: 'Failed to create campaign',
        description: error instanceof Error ? error.message : 'Something went wrong',
        variant: 'destructive',
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: Partial<CreateCampaignRequest>) => api.updateCampaign(campaign!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      toast({ title: 'Campaign updated successfully' });
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (error) => {
      toast({
        title: 'Failed to update campaign',
        description: error instanceof Error ? error.message : 'Something went wrong',
        variant: 'destructive',
      });
    },
  });

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = 'Name is required';
    }

    const poolNum = Number(poolAmount);
    if (!poolAmount || isNaN(poolNum) || poolNum <= 0) {
      newErrors.poolAmount = 'Pool amount must be a positive number';
    }

    const thresholdNum = Number(thresholdAmount);
    if (!thresholdAmount || isNaN(thresholdNum) || thresholdNum <= 0) {
      newErrors.thresholdAmount = 'Threshold must be a positive number';
    }

    const multiplierNum = Number(multiplier);
    if (!multiplier || isNaN(multiplierNum) || multiplierNum < 1) {
      newErrors.multiplier = 'Multiplier must be at least 1';
    }

    if (!startsAt) {
      newErrors.startsAt = 'Start date is required';
    }

    if (!endsAt) {
      newErrors.endsAt = 'End date is required';
    }

    if (startsAt && endsAt && new Date(startsAt) >= new Date(endsAt)) {
      newErrors.endsAt = 'End date must be after start date';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;

    const data: CreateCampaignRequest = {
      name: name.trim(),
      pool_amount: (Number(poolAmount) * 1_000_000).toString(),
      threshold_amount: (Number(thresholdAmount) * 1_000_000).toString(),
      multiplier_facilitator: Number(multiplier),
      starts_at: fromDateTimeLocal(startsAt),
      ends_at: fromDateTimeLocal(endsAt),
    };

    if (isEditing) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Campaign' : 'Create Campaign'}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Update the campaign details.'
              : 'Set up a new rewards campaign for your users.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Campaign Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Q1 2026 Rewards"
            />
            {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="poolAmount">Pool Amount ($OPEN)</Label>
              <Input
                id="poolAmount"
                type="number"
                value={poolAmount}
                onChange={(e) => setPoolAmount(e.target.value)}
                placeholder="100000"
                min="0"
                step="1000"
              />
              {errors.poolAmount && <p className="text-xs text-destructive">{errors.poolAmount}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="thresholdAmount">Threshold (USD volume)</Label>
              <Input
                id="thresholdAmount"
                type="number"
                value={thresholdAmount}
                onChange={(e) => setThresholdAmount(e.target.value)}
                placeholder="1000"
                min="0"
                step="100"
              />
              {errors.thresholdAmount && (
                <p className="text-xs text-destructive">{errors.thresholdAmount}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="multiplier">Facilitator Owner Multiplier</Label>
            <Input
              id="multiplier"
              type="number"
              value={multiplier}
              onChange={(e) => setMultiplier(e.target.value)}
              min="1"
              step="0.5"
            />
            <p className="text-xs text-muted-foreground">
              Multiplier applied to volume from facilitator owners (default: 2x)
            </p>
            {errors.multiplier && <p className="text-xs text-destructive">{errors.multiplier}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startsAt">Start Date</Label>
              <Input
                id="startsAt"
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
              />
              {errors.startsAt && <p className="text-xs text-destructive">{errors.startsAt}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="endsAt">End Date</Label>
              <Input
                id="endsAt"
                type="datetime-local"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
              />
              {errors.endsAt && <p className="text-xs text-destructive">{errors.endsAt}</p>}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {isEditing ? 'Saving...' : 'Creating...'}
              </>
            ) : isEditing ? (
              'Save Changes'
            ) : (
              'Create Campaign'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
