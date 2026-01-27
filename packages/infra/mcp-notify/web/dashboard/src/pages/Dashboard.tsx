import { StatsCard } from "@/components/StatsCard"
import { LiveFeed } from "@/components/LiveFeed"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useStats } from "@/lib/hooks"
import { formatRelativeTime } from "@/lib/utils"
import { Link } from "react-router-dom"
import {
  Bell,
  Activity,
  Server,
  Send,
  Plus,
  Rss,
  CheckCircle,
  Clock,
} from "lucide-react"

export function Dashboard() {
  const { data: stats, isLoading, error } = useStats()

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Monitor MCP Registry changes and manage subscriptions
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link to="/subscriptions">
              <Rss className="h-4 w-4 mr-2" />
              RSS Feed
            </Link>
          </Button>
          <Button asChild>
            <Link to="/subscriptions">
              <Plus className="h-4 w-4 mr-2" />
              New Subscription
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {isLoading ? (
          <>
            {[...Array(4)].map((_, i) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <Skeleton className="h-4 w-24 mb-3" />
                  <Skeleton className="h-8 w-16 mb-2" />
                  <Skeleton className="h-3 w-32" />
                </CardContent>
              </Card>
            ))}
          </>
        ) : error ? (
          <Card className="col-span-full">
            <CardContent className="p-6 text-center text-muted-foreground">
              Failed to load statistics
            </CardContent>
          </Card>
        ) : stats ? (
          <>
            <StatsCard
              title="Active Subscriptions"
              value={stats.active_subscriptions}
              description={`${stats.total_subscriptions} total`}
              icon={Bell}
            />
            <StatsCard
              title="Changes (24h)"
              value={stats.changes_last_24h}
              description={`${stats.total_changes} total changes`}
              icon={Activity}
            />
            <StatsCard
              title="Notifications Sent"
              value={stats.total_notifications}
              description="All time"
              icon={Send}
            />
            <StatsCard
              title="MCP Servers"
              value={stats.server_count}
              description="In registry"
              icon={Server}
            />
          </>
        ) : null}
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Live Feed */}
        <div className="lg:col-span-2">
          <LiveFeed maxItems={8} />
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* System Status */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-success" />
                System Status
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Registry Connection</span>
                <span className="flex items-center gap-2 text-sm text-success">
                  <span className="w-2 h-2 rounded-full bg-success" />
                  Connected
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Last Poll</span>
                <span className="text-sm">
                  {stats?.last_poll_time ? formatRelativeTime(stats.last_poll_time) : "—"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Poll Interval</span>
                <span className="text-sm">5 minutes</span>
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" className="w-full justify-start" asChild>
                <Link to="/subscriptions">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Subscription
                </Link>
              </Button>
              <Button variant="outline" className="w-full justify-start" asChild>
                <Link to="/servers">
                  <Server className="h-4 w-4 mr-2" />
                  Browse Servers
                </Link>
              </Button>
              <Button variant="outline" className="w-full justify-start" asChild>
                <Link to="/changes">
                  <Activity className="h-4 w-4 mr-2" />
                  View All Changes
                </Link>
              </Button>
              <Button variant="outline" className="w-full justify-start" asChild>
                <a href="/api/v1/feeds/rss" target="_blank" rel="noopener noreferrer">
                  <Rss className="h-4 w-4 mr-2" />
                  Subscribe via RSS
                </a>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
