import { useState, useEffect } from "react"
import { useSearchParams } from "react-router-dom"
import { useChanges } from "@/lib/hooks"
import { ChangeCard } from "@/components/ChangeCard"
import { FilterBar } from "@/components/FilterBar"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { Change, ChangesParams } from "@/lib/api"
import { formatDate } from "@/lib/utils"
import { Download, Calendar, ExternalLink, GitBranch, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"

export function Changes() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [params, setParams] = useState<ChangesParams>({
    limit: 50,
    server: searchParams.get("server") || undefined,
  })
  const [selectedChange, setSelectedChange] = useState<Change | null>(null)
  const [timeRange, setTimeRange] = useState<string>("24h")

  // Sync server filter from URL params
  useEffect(() => {
    const serverParam = searchParams.get("server")
    if (serverParam !== (params.server || null)) {
      setParams((prev) => ({ ...prev, server: serverParam || undefined }))
    }
  }, [searchParams])

  const { data, isLoading, error } = useChanges(params)

  const handleServerFilterClear = () => {
    setParams((prev) => ({ ...prev, server: undefined }))
    searchParams.delete("server")
    setSearchParams(searchParams)
  }

  const handleTimeRangeChange = (value: string) => {
    setTimeRange(value)
    const since = new Date()
    switch (value) {
      case "1h":
        since.setHours(since.getHours() - 1)
        break
      case "24h":
        since.setHours(since.getHours() - 24)
        break
      case "7d":
        since.setDate(since.getDate() - 7)
        break
      case "30d":
        since.setDate(since.getDate() - 30)
        break
      default:
        setParams({ ...params, since: undefined })
        return
    }
    setParams({ ...params, since: since.toISOString() })
  }

  const handleTypeChange = (value: string) => {
    if (value === "all") {
      setParams({ ...params, type: undefined })
    } else {
      setParams({ ...params, type: value as ChangesParams["type"] })
    }
  }

  const handleExport = (format: "json" | "csv") => {
    if (!data?.changes) return

    if (format === "json") {
      const blob = new Blob([JSON.stringify(data.changes, null, 2)], {
        type: "application/json",
      })
      downloadBlob(blob, "mcp-changes.json")
    } else {
      const headers = ["ID", "Server", "Type", "Version", "Detected At"]
      const rows = data.changes.map((c) => [
        c.id,
        c.server_name,
        c.change_type,
        c.new_version || "",
        c.detected_at,
      ])
      const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n")
      const blob = new Blob([csv], { type: "text/csv" })
      downloadBlob(blob, "mcp-changes.csv")
    }
  }

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Changes</h1>
          <p className="text-muted-foreground">
            Explore all detected changes in the MCP Registry
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => handleExport("csv")}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          <Button variant="outline" onClick={() => handleExport("json")}>
            <Download className="h-4 w-4 mr-2" />
            Export JSON
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <Select value={timeRange} onValueChange={handleTimeRangeChange}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Time range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1h">Last hour</SelectItem>
              <SelectItem value="24h">Last 24 hours</SelectItem>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="all">All time</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Select
          value={params.type || "all"}
          onValueChange={handleTypeChange}
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Change type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="new">New</SelectItem>
            <SelectItem value="updated">Updated</SelectItem>
            <SelectItem value="removed">Removed</SelectItem>
          </SelectContent>
        </Select>

        <FilterBar
          searchPlaceholder="Search servers..."
          onSearchChange={(value) =>
            setParams({ ...params, server: value || undefined })
          }
          className="flex-1"
        />

        {/* Server filter badge from URL navigation */}
        {params.server && (
          <Badge variant="secondary" className="gap-1">
            Server: {params.server}
            <button
              onClick={handleServerFilterClear}
              className="ml-1 hover:text-foreground"
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        )}
      </div>

      {/* Results count */}
      {data && (
        <p className="text-sm text-muted-foreground">
          Showing {data.changes.length} of {data.total_count} changes
        </p>
      )}

      {/* Changes Grid */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-5 w-3/4 mb-3" />
                <Skeleton className="h-4 w-1/2 mb-2" />
                <Skeleton className="h-3 w-1/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : error ? (
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            Failed to load changes
          </CardContent>
        </Card>
      ) : data?.changes.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            No changes found matching your filters
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {data?.changes.map((change) => (
            <ChangeCard
              key={change.id}
              change={change}
              onClick={() => setSelectedChange(change)}
              showDetails
            />
          ))}
        </div>
      )}

      {/* Change Detail Dialog */}
      <Dialog
        open={!!selectedChange}
        onOpenChange={() => setSelectedChange(null)}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedChange?.server_name}</DialogTitle>
          </DialogHeader>

          {selectedChange && (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <span className="capitalize font-medium">
                  {selectedChange.change_type}
                </span>
                <span className="text-muted-foreground">
                  {formatDate(selectedChange.detected_at)}
                </span>
              </div>

              {selectedChange.new_version && (
                <div className="flex items-center gap-2">
                  <GitBranch className="h-4 w-4 text-muted-foreground" />
                  {selectedChange.previous_version && (
                    <>
                      <span className="line-through text-muted-foreground">
                        {selectedChange.previous_version}
                      </span>
                      <span>→</span>
                    </>
                  )}
                  <span className="font-mono">{selectedChange.new_version}</span>
                </div>
              )}

              {selectedChange.server?.description && (
                <p className="text-muted-foreground">
                  {selectedChange.server.description}
                </p>
              )}

              {selectedChange.field_changes &&
                selectedChange.field_changes.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-medium">Field Changes</h4>
                    <div className="bg-muted rounded-lg p-4 space-y-2">
                      {selectedChange.field_changes.map((fc, i) => (
                        <div key={i} className="font-mono text-sm">
                          <span className="text-muted-foreground">{fc.field}:</span>{" "}
                          <span className="text-destructive">
                            {JSON.stringify(fc.old_value)}
                          </span>{" "}
                          →{" "}
                          <span className="text-success">
                            {JSON.stringify(fc.new_value)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              {selectedChange.server?.repository?.url && (
                <Button variant="outline" asChild>
                  <a
                    href={selectedChange.server.repository.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    View Repository
                  </a>
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
