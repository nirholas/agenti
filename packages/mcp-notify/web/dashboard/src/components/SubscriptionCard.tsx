import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { formatRelativeTime, getChannelIcon } from "@/lib/utils"
import type { Subscription } from "@/lib/api"
import { 
  Pause, 
  Play, 
  Trash2, 
  Edit, 
  Bell, 
  Send,
  MoreHorizontal
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface SubscriptionCardProps {
  subscription: Subscription
  onEdit?: () => void
  onDelete?: () => void
  onPause?: () => void
  onResume?: () => void
  onTest?: () => void
}

export function SubscriptionCard({
  subscription,
  onEdit,
  onDelete,
  onPause,
  onResume,
  onTest,
}: SubscriptionCardProps) {
  const isActive = subscription.status === "active"
  const isPaused = subscription.status === "paused"

  return (
    <Card className="relative overflow-hidden">
      {/* Status indicator */}
      <div
        className={`absolute top-0 left-0 w-1 h-full ${
          isActive ? "bg-success" : isPaused ? "bg-warning" : "bg-muted"
        }`}
      />

      <CardHeader className="pb-3 pl-5">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1 min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <CardTitle className="text-base truncate">
                {subscription.name}
              </CardTitle>
              <Badge
                variant={isActive ? "success" : isPaused ? "warning" : "secondary"}
              >
                {subscription.status}
              </Badge>
            </div>
            {subscription.description && (
              <p className="text-sm text-muted-foreground line-clamp-1">
                {subscription.description}
              </p>
            )}
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEdit}>
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onTest}>
                <Send className="mr-2 h-4 w-4" />
                Test Notification
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {isActive ? (
                <DropdownMenuItem onClick={onPause}>
                  <Pause className="mr-2 h-4 w-4" />
                  Pause
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={onResume}>
                  <Play className="mr-2 h-4 w-4" />
                  Resume
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={onDelete}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>

      <CardContent className="pl-5 space-y-4">
        {/* Filters */}
        <div className="space-y-2">
          {subscription.filters.namespaces && subscription.filters.namespaces.length > 0 && (
            <div className="flex flex-wrap gap-1">
              <span className="text-xs text-muted-foreground mr-1">Namespaces:</span>
              {subscription.filters.namespaces.map((ns) => (
                <Badge key={ns} variant="outline" className="text-xs">
                  {ns}
                </Badge>
              ))}
            </div>
          )}
          {subscription.filters.keywords && subscription.filters.keywords.length > 0 && (
            <div className="flex flex-wrap gap-1">
              <span className="text-xs text-muted-foreground mr-1">Keywords:</span>
              {subscription.filters.keywords.map((kw) => (
                <Badge key={kw} variant="outline" className="text-xs">
                  {kw}
                </Badge>
              ))}
            </div>
          )}
          {subscription.filters.change_types && subscription.filters.change_types.length > 0 && (
            <div className="flex flex-wrap gap-1">
              <span className="text-xs text-muted-foreground mr-1">Types:</span>
              {subscription.filters.change_types.map((ct) => (
                <Badge key={ct} variant="outline" className="text-xs">
                  {ct}
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* Channels */}
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-muted-foreground" />
          <div className="flex gap-2">
            {subscription.channels.map((channel) => (
              <div
                key={channel.id}
                className="flex items-center gap-1 text-sm"
                title={`${channel.type}: ${channel.success_count} sent, ${channel.failure_count} failed`}
              >
                <span>{getChannelIcon(channel.type)}</span>
                <span className="capitalize">{channel.type}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Last notified */}
        {subscription.last_notified && (
          <p className="text-xs text-muted-foreground">
            Last notified: {formatRelativeTime(subscription.last_notified)}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
