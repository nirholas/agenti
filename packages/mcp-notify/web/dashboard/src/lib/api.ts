// API Types
export interface Subscription {
  id: string
  name: string
  description?: string
  filters: SubscriptionFilter
  channels: Channel[]
  status: 'active' | 'paused' | 'expired'
  created_at: string
  updated_at: string
  last_notified?: string
}

export interface SubscriptionFilter {
  namespaces?: string[]
  keywords?: string[]
  servers?: string[]
  change_types?: ('new' | 'updated' | 'removed')[]
  package_types?: string[]
}

export interface Channel {
  id: string
  type: 'discord' | 'slack' | 'email' | 'webhook' | 'telegram' | 'teams'
  config: ChannelConfig
  enabled: boolean
  success_count: number
  failure_count: number
  last_success?: string
  last_failure?: string
}

export interface ChannelConfig {
  webhook_url?: string
  username?: string
  avatar_url?: string
  email?: string
  digest?: 'immediate' | 'hourly' | 'daily' | 'weekly'
  url?: string
  method?: 'POST' | 'PUT'
  headers?: Record<string, string>
  secret?: string
}

export interface CreateSubscriptionRequest {
  name: string
  description?: string
  filters: SubscriptionFilter
  channels: ChannelRequest[]
}

export interface UpdateSubscriptionRequest {
  name?: string
  description?: string
  filters?: SubscriptionFilter
  channels?: ChannelRequest[]
}

export interface ChannelRequest {
  type: Channel['type']
  config: ChannelConfig
}

export interface Change {
  id: string
  server_name: string
  change_type: 'new' | 'updated' | 'removed'
  previous_version?: string
  new_version?: string
  field_changes?: FieldChange[]
  server?: Server
  detected_at: string
}

export interface FieldChange {
  field: string
  old_value: unknown
  new_value: unknown
}

export interface Server {
  name: string
  description?: string
  repository?: {
    url: string
    source: string
  }
  version_detail?: {
    version: string
    is_latest: boolean
  }
  packages?: {
    registry_type: string
    name: string
    version: string
    url: string
  }[]
  remotes?: {
    transport_type: string
    url: string
  }[]
}

export interface Stats {
  total_subscriptions: number
  active_subscriptions: number
  total_changes: number
  changes_last_24h: number
  total_notifications: number
  last_poll_time: string
  server_count: number
}

export interface ChangesParams {
  since?: string
  server?: string
  type?: 'new' | 'updated' | 'removed'
  limit?: number
}

export interface ListResponse<T> {
  items: T[]
  total: number
  next_cursor?: string
}

// API Client
const API_BASE = '/api/v1'

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(error.error || `HTTP error ${response.status}`)
  }
  return response.json()
}

function getHeaders(): HeadersInit {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  }
  
  const apiKey = localStorage.getItem('mcp-watch-api-key')
  if (apiKey) {
    headers['X-API-Key'] = apiKey
  }
  
  return headers
}

export const api = {
  subscriptions: {
    list: async (): Promise<{ subscriptions: Subscription[]; total: number }> => {
      const response = await fetch(`${API_BASE}/subscriptions`, {
        headers: getHeaders(),
      })
      return handleResponse(response)
    },

    get: async (id: string): Promise<Subscription> => {
      const response = await fetch(`${API_BASE}/subscriptions/${id}`, {
        headers: getHeaders(),
      })
      return handleResponse(response)
    },

    create: async (data: CreateSubscriptionRequest): Promise<Subscription & { api_key: string }> => {
      const response = await fetch(`${API_BASE}/subscriptions`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(data),
      })
      return handleResponse(response)
    },

    update: async (id: string, data: UpdateSubscriptionRequest): Promise<Subscription> => {
      const response = await fetch(`${API_BASE}/subscriptions/${id}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(data),
      })
      return handleResponse(response)
    },

    delete: async (id: string): Promise<void> => {
      const response = await fetch(`${API_BASE}/subscriptions/${id}`, {
        method: 'DELETE',
        headers: getHeaders(),
      })
      if (!response.ok) {
        throw new Error(`Failed to delete subscription: ${response.status}`)
      }
    },

    pause: async (id: string): Promise<Subscription> => {
      const response = await fetch(`${API_BASE}/subscriptions/${id}/pause`, {
        method: 'POST',
        headers: getHeaders(),
      })
      return handleResponse(response)
    },

    resume: async (id: string): Promise<Subscription> => {
      const response = await fetch(`${API_BASE}/subscriptions/${id}/resume`, {
        method: 'POST',
        headers: getHeaders(),
      })
      return handleResponse(response)
    },

    test: async (id: string): Promise<{ status: string }> => {
      const response = await fetch(`${API_BASE}/subscriptions/${id}/test`, {
        method: 'POST',
        headers: getHeaders(),
      })
      return handleResponse(response)
    },
  },

  changes: {
    list: async (params: ChangesParams = {}): Promise<{ changes: Change[]; total_count: number; next_cursor?: string }> => {
      const searchParams = new URLSearchParams()
      if (params.since) searchParams.set('since', params.since)
      if (params.server) searchParams.set('server', params.server)
      if (params.type) searchParams.set('type', params.type)
      if (params.limit) searchParams.set('limit', params.limit.toString())

      const response = await fetch(`${API_BASE}/changes?${searchParams}`, {
        headers: getHeaders(),
      })
      return handleResponse(response)
    },

    get: async (id: string): Promise<Change> => {
      const response = await fetch(`${API_BASE}/changes/${id}`, {
        headers: getHeaders(),
      })
      return handleResponse(response)
    },
  },

  servers: {
    list: async (): Promise<{ servers: Server[]; count: number }> => {
      const response = await fetch(`${API_BASE}/servers`, {
        headers: getHeaders(),
      })
      return handleResponse(response)
    },

    get: async (name: string): Promise<Server> => {
      const response = await fetch(`${API_BASE}/servers/${encodeURIComponent(name)}`, {
        headers: getHeaders(),
      })
      return handleResponse(response)
    },

    search: async (query: string): Promise<{ servers: Server[]; count: number }> => {
      const response = await fetch(`${API_BASE}/servers?search=${encodeURIComponent(query)}`, {
        headers: getHeaders(),
      })
      return handleResponse(response)
    },
  },

  stats: {
    get: async (): Promise<Stats> => {
      const response = await fetch(`${API_BASE}/stats`, {
        headers: getHeaders(),
      })
      return handleResponse(response)
    },
  },

  feeds: {
    getRssUrl: (params?: { namespace?: string; keywords?: string }): string => {
      const searchParams = new URLSearchParams()
      if (params?.namespace) searchParams.set('namespace', params.namespace)
      if (params?.keywords) searchParams.set('keywords', params.keywords)
      const queryString = searchParams.toString()
      return `${API_BASE}/feeds/rss${queryString ? `?${queryString}` : ''}`
    },

    getAtomUrl: (): string => {
      return `${API_BASE}/feeds/atom`
    },
  },
}
