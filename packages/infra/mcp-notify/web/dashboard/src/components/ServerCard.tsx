import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { Server } from "@/lib/api"
import { ExternalLink, Package, Globe, Eye } from "lucide-react"

interface ServerCardProps {
  server: Server
  onWatch?: () => void
  onViewHistory?: () => void
}

export function ServerCard({ server, onWatch, onViewHistory }: ServerCardProps) {
  return (
    <Card className="transition-all hover:shadow-md">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1 min-w-0 flex-1">
            <CardTitle className="text-base truncate">{server.name}</CardTitle>
            {server.version_detail?.version && (
              <Badge variant="outline" className="text-xs">
                v{server.version_detail.version}
                {server.version_detail.is_latest && " (latest)"}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {server.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {server.description}
          </p>
        )}

        {/* Packages */}
        {server.packages && server.packages.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {server.packages.map((pkg, i) => (
              <Badge key={i} variant="secondary" className="text-xs">
                <Package className="h-3 w-3 mr-1" />
                {pkg.registry_type}: {pkg.name}
              </Badge>
            ))}
          </div>
        )}

        {/* Remotes */}
        {server.remotes && server.remotes.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {server.remotes.map((remote, i) => (
              <Badge key={i} variant="outline" className="text-xs">
                <Globe className="h-3 w-3 mr-1" />
                {remote.transport_type}
              </Badge>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 pt-2">
          {server.repository?.url && (
            <Button variant="outline" size="sm" asChild>
              <a
                href={server.repository.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="h-3 w-3 mr-1" />
                Source
              </a>
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={onViewHistory}>
            <Eye className="h-3 w-3 mr-1" />
            History
          </Button>
          <Button variant="default" size="sm" onClick={onWatch}>
            Watch
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
