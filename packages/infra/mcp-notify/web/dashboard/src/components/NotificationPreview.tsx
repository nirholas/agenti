import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getChannelIcon } from "@/lib/utils"
import type { ChannelRequest } from "@/lib/api"

interface NotificationPreviewProps {
  channel: ChannelRequest
  serverName?: string
  changeType?: "new" | "updated" | "removed"
  version?: string
  className?: string
}

export function NotificationPreview({
  channel,
  serverName = "example-mcp-server",
  changeType = "updated",
  version = "1.2.0",
  className,
}: NotificationPreviewProps) {
  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <span>{getChannelIcon(channel.type)}</span>
          Notification Preview
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue={channel.type}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="discord">Discord</TabsTrigger>
            <TabsTrigger value="slack">Slack</TabsTrigger>
            <TabsTrigger value="email">Email</TabsTrigger>
            <TabsTrigger value="webhook">JSON</TabsTrigger>
          </TabsList>

          <TabsContent value="discord" className="mt-4">
            <DiscordPreview
              serverName={serverName}
              changeType={changeType}
              version={version}
            />
          </TabsContent>

          <TabsContent value="slack" className="mt-4">
            <SlackPreview
              serverName={serverName}
              changeType={changeType}
              version={version}
            />
          </TabsContent>

          <TabsContent value="email" className="mt-4">
            <EmailPreview
              serverName={serverName}
              changeType={changeType}
              version={version}
            />
          </TabsContent>

          <TabsContent value="webhook" className="mt-4">
            <JsonPreview
              serverName={serverName}
              changeType={changeType}
              version={version}
            />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}

interface PreviewProps {
  serverName: string
  changeType: "new" | "updated" | "removed"
  version: string
}

function DiscordPreview({ serverName, changeType, version }: PreviewProps) {
  const colors = {
    new: "border-l-success",
    updated: "border-l-primary",
    removed: "border-l-destructive",
  }

  return (
    <div className="bg-[#36393f] rounded-lg p-4 text-white text-sm">
      <div className={`border-l-4 ${colors[changeType]} pl-3`}>
        <p className="font-semibold text-primary">MCP Notify</p>
        <p className="text-gray-300 mt-1">
          Server <span className="font-mono bg-[#2f3136] px-1 rounded">{serverName}</span> was {changeType}
        </p>
        {version && (
          <p className="text-gray-400 text-xs mt-2">Version: {version}</p>
        )}
        <div className="flex gap-2 mt-3">
          <span className="bg-[#5865f2] text-white text-xs px-3 py-1 rounded">
            View Details
          </span>
        </div>
      </div>
    </div>
  )
}

function SlackPreview({ serverName, changeType, version }: PreviewProps) {
  const colors = {
    new: "bg-success",
    updated: "bg-primary",
    removed: "bg-destructive",
  }

  return (
    <div className="bg-white border rounded-lg p-4 text-sm">
      <div className="flex gap-3">
        <div className={`w-1 ${colors[changeType]} rounded`} />
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-bold">MCP Notify</span>
            <span className="text-xs text-gray-500">12:34 PM</span>
          </div>
          <p className="mt-1">
            Server <code className="bg-gray-100 px-1 rounded">{serverName}</code> was {changeType}
          </p>
          {version && (
            <p className="text-gray-500 text-xs mt-1">Version: {version}</p>
          )}
        </div>
      </div>
    </div>
  )
}

function EmailPreview({ serverName, changeType, version }: PreviewProps) {
  const subjects = {
    new: `New MCP Server: ${serverName}`,
    updated: `Server Updated: ${serverName}`,
    removed: `Server Removed: ${serverName}`,
  }

  return (
    <div className="bg-white border rounded-lg overflow-hidden text-sm">
      <div className="bg-gray-50 border-b p-3 space-y-1">
        <p><span className="text-gray-500">From:</span> notifications@mcpregistry.dev</p>
        <p><span className="text-gray-500">Subject:</span> {subjects[changeType]}</p>
      </div>
      <div className="p-4 space-y-2">
        <p>Hello,</p>
        <p>
          The MCP server <strong>{serverName}</strong> has been {changeType} in the registry.
        </p>
        {version && (
          <p className="text-gray-600">New version: {version}</p>
        )}
        <p className="text-primary underline">View in Dashboard →</p>
      </div>
    </div>
  )
}

function JsonPreview({ serverName, changeType, version }: PreviewProps) {
  const payload = {
    event: `server.${changeType}`,
    timestamp: new Date().toISOString(),
    server: {
      name: serverName,
      version: version,
    },
    change_type: changeType,
  }

  return (
    <pre className="bg-muted rounded-lg p-4 text-xs overflow-auto font-mono">
      {JSON.stringify(payload, null, 2)}
    </pre>
  )
}
