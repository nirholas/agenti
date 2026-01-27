import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { 
  api, 
  type Subscription,
  type CreateSubscriptionRequest, 
  type UpdateSubscriptionRequest,
  type ChangesParams,
} from './api'

// Query keys
export const queryKeys = {
  subscriptions: ['subscriptions'] as const,
  subscription: (id: string) => ['subscriptions', id] as const,
  changes: (params: ChangesParams) => ['changes', params] as const,
  change: (id: string) => ['changes', 'detail', id] as const,
  servers: ['servers'] as const,
  server: (name: string) => ['servers', name] as const,
  stats: ['stats'] as const,
}

// Subscriptions hooks
export function useSubscriptions() {
  return useQuery({
    queryKey: queryKeys.subscriptions,
    queryFn: api.subscriptions.list,
  })
}

export function useSubscription(id: string) {
  return useQuery({
    queryKey: queryKeys.subscription(id),
    queryFn: () => api.subscriptions.get(id),
    enabled: !!id,
  })
}

export function useCreateSubscription() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: (data: CreateSubscriptionRequest) => api.subscriptions.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.subscriptions })
      queryClient.invalidateQueries({ queryKey: queryKeys.stats })
    },
  })
}

export function useUpdateSubscription() {
  const queryClient = useQueryClient()
  type Variables = { id: string; data: UpdateSubscriptionRequest }
  
  return useMutation({
    mutationFn: ({ id, data }: Variables) => api.subscriptions.update(id, data),
    onSuccess: (_: Subscription, { id }: Variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.subscriptions })
      queryClient.invalidateQueries({ queryKey: queryKeys.subscription(id) })
    },
  })
}

export function useDeleteSubscription() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: (id: string) => api.subscriptions.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.subscriptions })
      queryClient.invalidateQueries({ queryKey: queryKeys.stats })
    },
  })
}

export function usePauseSubscription() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: (id: string) => api.subscriptions.pause(id),
    onSuccess: (_: Subscription, id: string) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.subscriptions })
      queryClient.invalidateQueries({ queryKey: queryKeys.subscription(id) })
    },
  })
}

export function useResumeSubscription() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: (id: string) => api.subscriptions.resume(id),
    onSuccess: (_: Subscription, id: string) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.subscriptions })
      queryClient.invalidateQueries({ queryKey: queryKeys.subscription(id) })
    },
  })
}

export function useTestSubscription() {
  return useMutation({
    mutationFn: (id: string) => api.subscriptions.test(id),
  })
}

// Changes hooks
export function useChanges(params: ChangesParams = {}) {
  return useQuery({
    queryKey: queryKeys.changes(params),
    queryFn: () => api.changes.list(params),
    refetchInterval: 30000, // Refetch every 30 seconds
  })
}

export function useChange(id: string) {
  return useQuery({
    queryKey: queryKeys.change(id),
    queryFn: () => api.changes.get(id),
    enabled: !!id,
  })
}

export function useLiveChanges() {
  return useQuery({
    queryKey: ['live-changes'],
    queryFn: async () => {
      const result = await api.changes.list({ limit: 10 })
      return result.changes
    },
    refetchInterval: 10000, // Poll every 10 seconds for live updates
    staleTime: 5000,
  })
}

// Servers hooks
export function useServers() {
  return useQuery({
    queryKey: queryKeys.servers,
    queryFn: api.servers.list,
    staleTime: 1000 * 60 * 5, // 5 minutes
  })
}

export function useServer(name: string) {
  return useQuery({
    queryKey: queryKeys.server(name),
    queryFn: () => api.servers.get(name),
    enabled: !!name,
  })
}

export function useSearchServers(query: string) {
  return useQuery({
    queryKey: ['servers', 'search', query],
    queryFn: () => api.servers.search(query),
    enabled: query.length >= 2,
  })
}

// Stats hooks
export function useStats() {
  return useQuery({
    queryKey: queryKeys.stats,
    queryFn: api.stats.get,
    refetchInterval: 60000, // Refetch every minute
  })
}
