import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { useLiveChanges } from "@/lib/hooks"
import { formatRelativeTime, getChangeTypeColor, getChangeTypeLabel, cn } from "@/lib/utils"
import { Activity, Loader2 } from "lucide-react"
import type { Change } from "@/lib/api"
import { Link } from "react-router-dom"

interface LiveFeedProps {
  maxItems?: number
  className?: string
}

export function LiveFeed({ maxItems = 10, className }: LiveFeedProps) {
  const { data: changes, isLoading, error } = useLiveChanges()

  const displayedChanges = changes?.slice(0, maxItems) ?? []

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Live Feed
          </CardTitle>
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-success"></span>
            </span>
            <span className="text-xs text-muted-foreground">Live</span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="text-center py-8 text-sm text-muted-foreground">
            Failed to load changes
          </div>
        ) : displayedChanges.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground">
            No recent changes
          </div>
        ) : (
          <ScrollArea className="h-[300px]">
            <div className="divide-y">
              {displayedChanges.map((change) => (
                <LiveFeedItem key={change.id} change={change} />
              ))}
            </div>
          </ScrollArea>
        )}

        <div className="p-3 border-t">
          <Link
            to="/changes"
            className="text-xs text-primary hover:underline"
          >
            View all changes →
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}

function LiveFeedItem({ change }: { change: Change }) {
  const typeColorClass = getChangeTypeColor(change.change_type)

  return (
    <div className="px-4 py-3 hover:bg-muted/50 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate">{change.server_name}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {formatRelativeTime(change.detected_at)}
          </p>
        </div>
        <Badge 
          variant="outline" 
          className={cn("text-xs shrink-0", typeColorClass)}
        >
          {getChangeTypeLabel(change.change_type)}
        </Badge>
      </div>
      {change.new_version && (
        <p className="text-xs text-muted-foreground mt-1">
          {change.previous_version && (
            <span className="line-through mr-1">{change.previous_version}</span>
          )}
          → v{change.new_version}
        </p>
      )}
    </div>
  )
}
