import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { formatRelativeTime, getChangeTypeColor, getChangeTypeLabel, cn } from "@/lib/utils"
import type { Change } from "@/lib/api"
import { ExternalLink, GitBranch, Package } from "lucide-react"

interface ChangeCardProps {
  change: Change
  onClick?: () => void
  showDetails?: boolean
}

export function ChangeCard({ change, onClick, showDetails = false }: ChangeCardProps) {
  const typeColorClass = getChangeTypeColor(change.change_type)

  return (
    <Card
      className={cn(
        "transition-all hover:shadow-md cursor-pointer",
        onClick && "hover:border-primary/50"
      )}
      onClick={onClick}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1 min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-base truncate">
                {change.server_name}
              </h3>
              <Badge 
                variant="outline" 
                className={cn("border text-xs", typeColorClass)}
              >
                {getChangeTypeLabel(change.change_type)}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {formatRelativeTime(change.detected_at)}
            </p>
          </div>
          {change.new_version && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground bg-muted px-2 py-1 rounded-md">
              <GitBranch className="h-3 w-3" />
              {change.previous_version && (
                <>
                  <span className="line-through">{change.previous_version}</span>
                  <span>→</span>
                </>
              )}
              <span className="font-medium text-foreground">{change.new_version}</span>
            </div>
          )}
        </div>
      </CardHeader>

      {showDetails && change.server && (
        <CardContent className="pt-0 space-y-3">
          {change.server.description && (
            <p className="text-sm text-muted-foreground line-clamp-2">
              {change.server.description}
            </p>
          )}

          {change.field_changes && change.field_changes.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Changes:</p>
              <div className="space-y-1">
                {change.field_changes.slice(0, 3).map((fc, i) => (
                  <div
                    key={i}
                    className="text-xs bg-muted rounded px-2 py-1 font-mono"
                  >
                    <span className="text-muted-foreground">{fc.field}:</span>{" "}
                    <span className="text-destructive line-through">
                      {JSON.stringify(fc.old_value)}
                    </span>{" "}
                    →{" "}
                    <span className="text-success">
                      {JSON.stringify(fc.new_value)}
                    </span>
                  </div>
                ))}
                {change.field_changes.length > 3 && (
                  <p className="text-xs text-muted-foreground">
                    +{change.field_changes.length - 3} more changes
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 pt-2">
            {change.server.repository?.url && (
              <Button variant="outline" size="sm" asChild>
                <a
                  href={change.server.repository.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                >
                  <ExternalLink className="h-3 w-3 mr-1" />
                  Repository
                </a>
              </Button>
            )}
            {change.server.packages && change.server.packages.length > 0 && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Package className="h-3 w-3" />
                {change.server.packages.length} package(s)
              </div>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  )
}
