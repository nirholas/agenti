import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/components/ui/use-toast"
import { useTheme } from "@/components/ThemeProvider"
import {
  Key,
  RefreshCw,
  Copy,
  Eye,
  EyeOff,
  Bell,
  Palette,
  Webhook,
  Loader2,
} from "lucide-react"

export function Settings() {
  const { theme, setTheme } = useTheme()
  const { toast } = useToast()

  const [showApiKey, setShowApiKey] = useState(false)
  const [apiKey, setApiKey] = useState(
    localStorage.getItem("mcp-watch-api-key") || ""
  )
  const [testWebhookUrl, setTestWebhookUrl] = useState("")
  const [testingWebhook, setTestingWebhook] = useState(false)

  const handleSaveApiKey = () => {
    localStorage.setItem("mcp-watch-api-key", apiKey)
    toast({
      title: "API key saved",
      description: "Your API key has been saved locally.",
    })
  }

  const handleCopyApiKey = () => {
    navigator.clipboard.writeText(apiKey)
    toast({ title: "API key copied to clipboard" })
  }

  const handleTestWebhook = async () => {
    if (!testWebhookUrl) return

    setTestingWebhook(true)
    try {
      const response = await fetch(testWebhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "test",
          message: "Test notification from MCP Notify",
          timestamp: new Date().toISOString(),
        }),
      })

      if (response.ok) {
        toast({
          title: "Webhook test successful",
          description: "Your webhook endpoint responded successfully.",
        })
      } else {
        toast({
          title: "Webhook test failed",
          description: `Server responded with ${response.status}`,
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "Webhook test failed",
        description: "Could not reach the webhook URL",
        variant: "destructive",
      })
    } finally {
      setTestingWebhook(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Manage your account and application preferences
        </p>
      </div>

      <Tabs defaultValue="api" className="space-y-6">
        <TabsList>
          <TabsTrigger value="api" className="gap-2">
            <Key className="h-4 w-4" />
            API
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2">
            <Bell className="h-4 w-4" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="appearance" className="gap-2">
            <Palette className="h-4 w-4" />
            Appearance
          </TabsTrigger>
          <TabsTrigger value="testing" className="gap-2">
            <Webhook className="h-4 w-4" />
            Testing
          </TabsTrigger>
        </TabsList>

        {/* API Settings */}
        <TabsContent value="api">
          <Card>
            <CardHeader>
              <CardTitle>API Key</CardTitle>
              <CardDescription>
                Your API key is used to authenticate requests to the MCP Notify API
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="apiKey">API Key</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      id="apiKey"
                      type={showApiKey ? "text" : "password"}
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder="Enter your API key"
                      className="pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-3"
                      onClick={() => setShowApiKey(!showApiKey)}
                    >
                      {showApiKey ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <Button variant="outline" onClick={handleCopyApiKey}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Get your API key from the subscription creation response
                </p>
              </div>
              <Button onClick={handleSaveApiKey}>Save API Key</Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notification Settings */}
        <TabsContent value="notifications">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Email Notifications</CardTitle>
                <CardDescription>
                  Configure email notification preferences
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Email Digest</Label>
                    <p className="text-sm text-muted-foreground">
                      Receive a summary of changes
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Digest Frequency</Label>
                    <p className="text-sm text-muted-foreground">
                      How often to send digests
                    </p>
                  </div>
                  <Select defaultValue="daily">
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hourly">Hourly</SelectItem>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Browser Notifications</CardTitle>
                <CardDescription>
                  Get notified in your browser
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Push Notifications</Label>
                    <p className="text-sm text-muted-foreground">
                      Receive push notifications in your browser
                    </p>
                  </div>
                  <Switch />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Appearance Settings */}
        <TabsContent value="appearance">
          <Card>
            <CardHeader>
              <CardTitle>Theme</CardTitle>
              <CardDescription>
                Customize the appearance of the dashboard
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Color Theme</Label>
                  <p className="text-sm text-muted-foreground">
                    Choose your preferred color scheme
                  </p>
                </div>
                <Select value={theme} onValueChange={setTheme}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="light">Light</SelectItem>
                    <SelectItem value="dark">Dark</SelectItem>
                    <SelectItem value="system">System</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Testing Tools */}
        <TabsContent value="testing">
          <Card>
            <CardHeader>
              <CardTitle>Webhook Testing</CardTitle>
              <CardDescription>
                Test your webhook endpoints before using them in subscriptions
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="webhookUrl">Webhook URL</Label>
                <Input
                  id="webhookUrl"
                  type="url"
                  value={testWebhookUrl}
                  onChange={(e) => setTestWebhookUrl(e.target.value)}
                  placeholder="https://your-server.com/webhook"
                />
              </div>
              <Button
                onClick={handleTestWebhook}
                disabled={!testWebhookUrl || testingWebhook}
              >
                {testingWebhook ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Testing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Send Test Request
                  </>
                )}
              </Button>
              <div className="bg-muted p-4 rounded-lg">
                <p className="text-sm font-medium mb-2">Test Payload:</p>
                <pre className="text-xs font-mono">
{`{
  "event": "test",
  "message": "Test notification from MCP Notify",
  "timestamp": "${new Date().toISOString()}"
}`}
                </pre>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
