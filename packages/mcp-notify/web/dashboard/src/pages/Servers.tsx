import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useServers, useSearchServers } from "@/lib/hooks"
import { ServerCard } from "@/components/ServerCard"
import { FilterBar } from "@/components/FilterBar"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { SubscriptionForm } from "@/components/SubscriptionForm"
import { useCreateSubscription } from "@/lib/hooks"
import { useToast } from "@/components/ui/use-toast"
import type { Server, CreateSubscriptionRequest } from "@/lib/api"
import { Server as ServerIcon } from "lucide-react"

export function Servers() {
  const [search, setSearch] = useState("")
  const [watchServer, setWatchServer] = useState<Server | null>(null)
  const navigate = useNavigate()

  const { data: allServers, isLoading, error } = useServers()
  const { data: searchResults } = useSearchServers(search)
  const createMutation = useCreateSubscription()
  const { toast } = useToast()

  const displayedServers = search.length >= 2
    ? searchResults?.servers ?? []
    : allServers?.servers ?? []

  const handleWatch = async (data: CreateSubscriptionRequest) => {
    try {
      await createMutation.mutateAsync(data)
      setWatchServer(null)
      toast({
        title: "Subscription created",
        description: `You will now receive notifications for ${watchServer?.name}`,
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create subscription",
        variant: "destructive",
      })
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Servers</h1>
          <p className="text-muted-foreground">
            Browse all MCP servers in the registry
          </p>
        </div>
      </div>

      {/* Search */}
      <FilterBar
        searchPlaceholder="Search servers by name or description..."
        onSearchChange={setSearch}
      />

      {/* Results count */}
      {allServers && (
        <p className="text-sm text-muted-foreground">
          {search.length >= 2
            ? `Found ${searchResults?.count ?? 0} servers`
            : `${allServers.count} servers in registry`}
        </p>
      )}

      {/* Servers Grid */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-5 w-3/4 mb-3" />
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-2/3 mb-4" />
                <div className="flex gap-2">
                  <Skeleton className="h-8 w-20" />
                  <Skeleton className="h-8 w-16" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : error ? (
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            Failed to load servers
          </CardContent>
        </Card>
      ) : displayedServers.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <ServerIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No servers found</h3>
            <p className="text-muted-foreground">
              {search ? "Try a different search term" : "No servers in registry"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {displayedServers.map((server) => (
            <ServerCard
              key={server.name}
              server={server}
              onWatch={() => setWatchServer(server)}
              onViewHistory={() => navigate(`/changes?server=${encodeURIComponent(server.name)}`)}
            />
          ))}
        </div>
      )}

      {/* Watch Server Dialog */}
      <Dialog open={!!watchServer} onOpenChange={() => setWatchServer(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Watch {watchServer?.name}</DialogTitle>
            <DialogDescription>
              Create a subscription to receive notifications for this server
            </DialogDescription>
          </DialogHeader>
          {watchServer && (
            <SubscriptionForm
              onSubmit={handleWatch}
              onCancel={() => setWatchServer(null)}
              isLoading={createMutation.isPending}
              defaultValues={{
                name: `Watch ${watchServer.name}`,
                description: `Notifications for ${watchServer.name}`,
                filters: {
                  servers: [watchServer.name],
                },
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
