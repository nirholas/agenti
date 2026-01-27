import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
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
import { Badge } from "@/components/ui/badge"
import { X, Plus, Loader2 } from "lucide-react"
import type { CreateSubscriptionRequest, ChannelRequest } from "@/lib/api"

const subscriptionSchema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  description: z.string().max(1000).optional(),
  filters: z.object({
    namespaces: z.array(z.string()).optional(),
    keywords: z.array(z.string()).optional(),
    change_types: z.array(z.enum(["new", "updated", "removed"])).optional(),
  }),
  channels: z.array(z.object({
    type: z.enum(["discord", "slack", "email", "webhook"]),
    config: z.record(z.any()),
  })).min(1, "At least one channel is required"),
})

type SubscriptionFormData = z.infer<typeof subscriptionSchema>

interface SubscriptionFormProps {
  onSubmit: (data: CreateSubscriptionRequest) => Promise<void>
  onCancel?: () => void
  isLoading?: boolean
  defaultValues?: Partial<CreateSubscriptionRequest>
}

export function SubscriptionForm({
  onSubmit,
  onCancel,
  isLoading = false,
  defaultValues,
}: SubscriptionFormProps) {
  const [namespaces, setNamespaces] = useState<string[]>(
    defaultValues?.filters?.namespaces ?? []
  )
  const [keywords, setKeywords] = useState<string[]>(
    defaultValues?.filters?.keywords ?? []
  )
  const [changeTypes, setChangeTypes] = useState<string[]>(
    defaultValues?.filters?.change_types ?? []
  )
  const [channels, setChannels] = useState<ChannelRequest[]>(
    defaultValues?.channels ?? []
  )

  const [newNamespace, setNewNamespace] = useState("")
  const [newKeyword, setNewKeyword] = useState("")

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SubscriptionFormData>({
    resolver: zodResolver(subscriptionSchema),
    defaultValues: {
      name: defaultValues?.name ?? "",
      description: defaultValues?.description ?? "",
    },
  })

  const addNamespace = () => {
    if (newNamespace && !namespaces.includes(newNamespace)) {
      setNamespaces([...namespaces, newNamespace])
      setNewNamespace("")
    }
  }

  const removeNamespace = (ns: string) => {
    setNamespaces(namespaces.filter((n) => n !== ns))
  }

  const addKeyword = () => {
    if (newKeyword && !keywords.includes(newKeyword)) {
      setKeywords([...keywords, newKeyword])
      setNewKeyword("")
    }
  }

  const removeKeyword = (kw: string) => {
    setKeywords(keywords.filter((k) => k !== kw))
  }

  const toggleChangeType = (type: string) => {
    if (changeTypes.includes(type)) {
      setChangeTypes(changeTypes.filter((t) => t !== type))
    } else {
      setChangeTypes([...changeTypes, type])
    }
  }

  const addChannel = (type: ChannelRequest["type"]) => {
    setChannels([...channels, { type, config: {} }])
  }

  const updateChannelConfig = (index: number, key: string, value: string) => {
    const updated = [...channels]
    updated[index] = {
      ...updated[index],
      config: { ...updated[index].config, [key]: value },
    }
    setChannels(updated)
  }

  const removeChannel = (index: number) => {
    setChannels(channels.filter((_, i) => i !== index))
  }

  const handleFormSubmit = (data: SubscriptionFormData) => {
    onSubmit({
      name: data.name,
      description: data.description,
      filters: {
        namespaces: namespaces.length > 0 ? namespaces : undefined,
        keywords: keywords.length > 0 ? keywords : undefined,
        change_types: changeTypes.length > 0 ? changeTypes as any : undefined,
      },
      channels,
    })
  }

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
      {/* Basic Info */}
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Name *</Label>
          <Input
            id="name"
            {...register("name")}
            placeholder="My subscription"
          />
          {errors.name && (
            <p className="text-sm text-destructive">{errors.name.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Input
            id="description"
            {...register("description")}
            placeholder="Optional description"
          />
        </div>
      </div>

      {/* Filters */}
      <div className="space-y-4">
        <h3 className="font-medium">Filters</h3>

        {/* Namespaces */}
        <div className="space-y-2">
          <Label>Namespaces (glob patterns)</Label>
          <div className="flex gap-2">
            <Input
              value={newNamespace}
              onChange={(e) => setNewNamespace(e.target.value)}
              placeholder="e.g., io.github.*"
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addNamespace())}
            />
            <Button type="button" variant="outline" onClick={addNamespace}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {namespaces.map((ns) => (
              <Badge key={ns} variant="secondary">
                {ns}
                <button
                  type="button"
                  onClick={() => removeNamespace(ns)}
                  className="ml-1 hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        </div>

        {/* Keywords */}
        <div className="space-y-2">
          <Label>Keywords</Label>
          <div className="flex gap-2">
            <Input
              value={newKeyword}
              onChange={(e) => setNewKeyword(e.target.value)}
              placeholder="e.g., blockchain"
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addKeyword())}
            />
            <Button type="button" variant="outline" onClick={addKeyword}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {keywords.map((kw) => (
              <Badge key={kw} variant="secondary">
                {kw}
                <button
                  type="button"
                  onClick={() => removeKeyword(kw)}
                  className="ml-1 hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        </div>

        {/* Change Types */}
        <div className="space-y-2">
          <Label>Change Types</Label>
          <div className="flex gap-2">
            {["new", "updated", "removed"].map((type) => (
              <Badge
                key={type}
                variant={changeTypes.includes(type) ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => toggleChangeType(type)}
              >
                {type}
              </Badge>
            ))}
          </div>
        </div>
      </div>

      {/* Channels */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-medium">Notification Channels *</h3>
          <Select onValueChange={(value) => addChannel(value as ChannelRequest["type"])}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Add channel" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="discord">Discord</SelectItem>
              <SelectItem value="slack">Slack</SelectItem>
              <SelectItem value="email">Email</SelectItem>
              <SelectItem value="webhook">Webhook</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {channels.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Add at least one notification channel
          </p>
        )}

        <div className="space-y-3">
          {channels.map((channel, index) => (
            <ChannelConfigCard
              key={index}
              channel={channel}
              onConfigChange={(key, value) => updateChannelConfig(index, key, value)}
              onRemove={() => removeChannel(index)}
            />
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={isLoading || channels.length === 0}>
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {defaultValues ? "Update" : "Create"} Subscription
        </Button>
      </div>
    </form>
  )
}

interface ChannelConfigCardProps {
  channel: ChannelRequest
  onConfigChange: (key: string, value: string) => void
  onRemove: () => void
}

function ChannelConfigCard({ channel, onConfigChange, onRemove }: ChannelConfigCardProps) {
  const channelConfigs: Record<string, { key: string; label: string; placeholder: string }[]> = {
    discord: [
      { key: "webhook_url", label: "Webhook URL", placeholder: "https://discord.com/api/webhooks/..." },
      { key: "username", label: "Bot Username (optional)", placeholder: "MCP Watch" },
    ],
    slack: [
      { key: "webhook_url", label: "Webhook URL", placeholder: "https://hooks.slack.com/services/..." },
    ],
    email: [
      { key: "email", label: "Email Address", placeholder: "you@example.com" },
      { key: "digest", label: "Digest Frequency", placeholder: "immediate" },
    ],
    webhook: [
      { key: "url", label: "Webhook URL", placeholder: "https://your-server.com/webhook" },
      { key: "secret", label: "HMAC Secret (optional)", placeholder: "your-secret-key" },
    ],
  }

  const config = channelConfigs[channel.type] || []

  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="font-medium capitalize">{channel.type}</span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onRemove}
          className="h-8 w-8 text-muted-foreground hover:text-destructive"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {config.map((field) => (
        <div key={field.key} className="space-y-1">
          <Label className="text-sm">{field.label}</Label>
          {field.key === "digest" ? (
            <Select
              value={(channel.config as Record<string, string>)[field.key] || ""}
              onValueChange={(value) => onConfigChange(field.key, value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select frequency" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="immediate">Immediate</SelectItem>
                <SelectItem value="hourly">Hourly</SelectItem>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
              </SelectContent>
            </Select>
          ) : (
            <Input
              value={(channel.config as Record<string, string>)[field.key] || ""}
              onChange={(e) => onConfigChange(field.key, e.target.value)}
              placeholder={field.placeholder}
            />
          )}
        </div>
      ))}
    </div>
  )
}
