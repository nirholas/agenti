'use client';

import { Server, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface EmptyStateProps {
  onCreateClick: () => void;
}

export function EmptyState({ onCreateClick }: EmptyStateProps) {
  return (
    <div className="text-center py-16">
      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
        <Server className="w-8 h-8 text-muted-foreground" />
      </div>
      <h2 className="text-xl font-semibold mb-2">No facilitators yet</h2>
      <p className="text-muted-foreground max-w-md mx-auto mb-6">
        Create your first x402 facilitator to start accepting payments on your own domain.
      </p>
      <Button onClick={onCreateClick}>
        <Plus className="w-4 h-4 mr-2" />
        Create Facilitator
      </Button>
      <p className="text-sm text-muted-foreground mt-3">$5/month per facilitator</p>
    </div>
  );
}
