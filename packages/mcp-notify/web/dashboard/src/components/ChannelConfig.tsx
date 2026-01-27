import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Check, Loader2, X } from "lucide-react"
import type { ChannelRequest } from "@/lib/api"

interface ChannelConfigProps {
  channel: ChannelRequest
  onChange: (channel: ChannelRequest) => void
  onTest?: () => Promise<{ success: boolean; message: string }>
  onRemove?: () => void
}

export function ChannelConfig({
  channel,
  onChange,
  onTest,
  onRemove,
}: ChannelConfigProps) {
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)

  const handleTest = async () => {
    if (!onTest) return
    setTesting(true)
    setTestResult(null)
    try {
      const result = await onTest()
      setTestResult(result)
    } catch (error) {
      setTestResult({ success: false, message: "Test failed" })
    } finally {
      setTesting(false)
    }
  }

  const updateConfig = (key: string, value: string | boolean) => {
    onChange({
      ...channel,
      config: { ...channel.config, [key]: value },
    })
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base capitalize flex items-center gap-2">
            {channel.type === "discord" && "💬"}
            {channel.type === "slack" && "📱"}
            {channel.type === "email" && "📧"}
            {channel.type === "webhook" && "🔗"}
            {channel.type}
          </CardTitle>
          <div className="flex items-center gap-2">
            {onTest && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleTest}
                disabled={testing}
              >
                {testing ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  "Test"
                )}
              </Button>
            )}
            {onRemove && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onRemove}
                className="h-8 w-8"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
        {testResult && (
          <div
            className={`flex items-center gap-2 text-sm ${
              testResult.success ? "text-success" : "text-destructive"
            }`}
          >
            {testResult.success ? (
              <Check className="h-4 w-4" />
            ) : (
              <X className="h-4 w-4" />
            )}
            {testResult.message}
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {channel.type === "discord" && (
          <>
            <div className="space-y-2">
              <Label>Webhook URL *</Label>
              <Input
                type="url"
                value={channel.config.webhook_url || ""}
                onChange={(e) => updateConfig("webhook_url", e.target.value)}
                placeholder="https://discord.com/api/webhooks/..."
              />
              <p className="text-xs text-muted-foreground">
                Get this from Discord: Server Settings → Integrations → Webhooks
              </p>
            </div>
            <div className="space-y-2">
              <Label>Bot Username</Label>
              <Input
                value={channel.config.username || ""}
                onChange={(e) => updateConfig("username", e.target.value)}
                placeholder="MCP Notify"
              />
            </div>
            <div className="space-y-2">
              <Label>Avatar URL</Label>
              <Input
                type="url"
                value={channel.config.avatar_url || ""}
                onChange={(e) => updateConfig("avatar_url", e.target.value)}
                placeholder="https://example.com/avatar.png"
              />
            </div>
          </>
        )}

        {channel.type === "slack" && (
          <>
            <div className="space-y-2">
              <Label>Webhook URL *</Label>
              <Input
                type="url"
                value={channel.config.webhook_url || ""}
                onChange={(e) => updateConfig("webhook_url", e.target.value)}
                placeholder="https://hooks.slack.com/services/..."
              />
              <p className="text-xs text-muted-foreground">
                Create an Incoming Webhook app in your Slack workspace
              </p>
            </div>
          </>
        )}

        {channel.type === "email" && (
          <>
            <div className="space-y-2">
              <Label>Email Address *</Label>
              <Input
                type="email"
                value={channel.config.email || ""}
                onChange={(e) => updateConfig("email", e.target.value)}
                placeholder="you@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label>Digest Frequency</Label>
              <Select
                value={channel.config.digest || "immediate"}
                onValueChange={(value) => updateConfig("digest", value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="immediate">Immediate</SelectItem>
                  <SelectItem value="hourly">Hourly Digest</SelectItem>
                  <SelectItem value="daily">Daily Digest</SelectItem>
                  <SelectItem value="weekly">Weekly Digest</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Batch notifications to reduce email volume
              </p>
            </div>
          </>
        )}

        {channel.type === "webhook" && (
          <>
            <div className="space-y-2">
              <Label>Webhook URL *</Label>
              <Input
                type="url"
                value={channel.config.url || ""}
                onChange={(e) => updateConfig("url", e.target.value)}
                placeholder="https://your-server.com/webhook"
              />
            </div>
            <div className="space-y-2">
              <Label>HTTP Method</Label>
              <Select
                value={channel.config.method || "POST"}
                onValueChange={(value) => updateConfig("method", value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="POST">POST</SelectItem>
                  <SelectItem value="PUT">PUT</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>HMAC Secret</Label>
              <Input
                type="password"
                value={channel.config.secret || ""}
                onChange={(e) => updateConfig("secret", e.target.value)}
                placeholder="Optional signing secret"
              />
              <p className="text-xs text-muted-foreground">
                If provided, requests will include an X-Signature header
              </p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
