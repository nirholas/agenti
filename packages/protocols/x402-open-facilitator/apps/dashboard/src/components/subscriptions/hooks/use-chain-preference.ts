import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, type ChainPreference } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

export function useChainPreference() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch current preference
  const { data, isLoading } = useQuery({
    queryKey: ['chainPreference'],
    queryFn: () => api.getChainPreference(),
  });

  // Update preference with optimistic update
  const mutation = useMutation({
    mutationFn: (chain: 'base' | 'solana' | 'stacks') => api.updateChainPreference(chain),

    // Optimistic update - runs immediately before API call
    onMutate: async (newChain) => {
      // Cancel any outgoing refetches to avoid overwriting optimistic update
      await queryClient.cancelQueries({ queryKey: ['chainPreference'] });

      // Snapshot previous value for rollback
      const previousData = queryClient.getQueryData<ChainPreference>(['chainPreference']);

      // Optimistically update to new value
      queryClient.setQueryData<ChainPreference>(['chainPreference'], {
        preferredChain: newChain,
      });

      // Return context with previous data for rollback
      return { previousData };
    },

    // Rollback on error
    onError: (error, _newChain, context) => {
      // Restore previous value
      if (context?.previousData) {
        queryClient.setQueryData(['chainPreference'], context.previousData);
      }

      toast({
        title: 'Failed to update preference',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    },

    // Refetch on success to ensure consistency
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chainPreference'] });
    },
  });

  return {
    preference: data?.preferredChain ?? 'solana',
    isLoading,
    updatePreference: mutation.mutate,
    isUpdating: mutation.isPending,
  };
}
