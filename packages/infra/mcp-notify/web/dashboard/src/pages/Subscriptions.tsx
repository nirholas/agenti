import { useState } from "react"
import {
  useSubscriptions,
  useCreateSubscription,
  useUpdateSubscription,
  useDeleteSubscription,
  usePauseSubscription,
  useResumeSubscription,
  useTestSubscription,
} from "@/lib/hooks"
import { SubscriptionCard } from "@/components/SubscriptionCard"
import { SubscriptionForm } from "@/components/SubscriptionForm"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useToast } from "@/components/ui/use-toast"
import type { Subscription, CreateSubscriptionRequest, UpdateSubscriptionRequest } from "@/lib/api"
import { Plus, Bell, Loader2 } from "lucide-react"

export function Subscriptions() {
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [editSubscription, setEditSubscription] = useState<Subscription | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [apiKeyResult, setApiKeyResult] = useState<{ subscription: Subscription; apiKey: string } | null>(null)

  const { data, isLoading, error } = useSubscriptions()
  const createMutation = useCreateSubscription()
  const updateMutation = useUpdateSubscription()
  const deleteMutation = useDeleteSubscription()
  const pauseMutation = usePauseSubscription()
  const resumeMutation = useResumeSubscription()
  const testMutation = useTestSubscription()
  const { toast } = useToast()

  const handleCreate = async (formData: CreateSubscriptionRequest) => {
    try {
      const result = await createMutation.mutateAsync(formData)
      setShowCreateDialog(false)
      setApiKeyResult({ subscription: result, apiKey: result.api_key })
      toast({
        title: "Subscription created",
        description: "Your subscription has been created successfully.",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create subscription",
        variant: "destructive",
      })
    }
  }

  const handleEdit = async (formData: CreateSubscriptionRequest) => {
    if (!editSubscription) return
    try {
      const updateData: UpdateSubscriptionRequest = {
        name: formData.name,
        description: formData.description,
        filters: formData.filters,
        channels: formData.channels,
      }
      await updateMutation.mutateAsync({ id: editSubscription.id, data: updateData })
      setEditSubscription(null)
      toast({
        title: "Subscription updated",
        description: "Your subscription has been updated successfully.",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update subscription",
        variant: "destructive",
      })
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    try {
      await deleteMutation.mutateAsync(deleteId)
      setDeleteId(null)
      toast({
        title: "Subscription deleted",
        description: "Your subscription has been deleted.",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete subscription",
        variant: "destructive",
      })
    }
  }

  const handlePause = async (id: string) => {
    try {
      await pauseMutation.mutateAsync(id)
      toast({
        title: "Subscription paused",
        description: "Notifications will be paused until you resume.",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to pause subscription",
        variant: "destructive",
      })
    }
  }

  const handleResume = async (id: string) => {
    try {
      await resumeMutation.mutateAsync(id)
      toast({
        title: "Subscription resumed",
        description: "You will now receive notifications again.",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to resume subscription",
        variant: "destructive",
      })
    }
  }

  const handleTest = async (id: string) => {
    try {
      await testMutation.mutateAsync(id)
      toast({
        title: "Test notification sent",
        description: "Check your notification channels.",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to send test notification",
        variant: "destructive",
      })
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Subscriptions</h1>
          <p className="text-muted-foreground">
            Manage your notification subscriptions
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Subscription
        </Button>
      </div>

      {/* Subscriptions List */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-5 w-3/4 mb-3" />
                <Skeleton className="h-4 w-1/2 mb-2" />
                <Skeleton className="h-3 w-full mb-2" />
                <Skeleton className="h-3 w-2/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : error ? (
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            Failed to load subscriptions
          </CardContent>
        </Card>
      ) : data?.subscriptions.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Bell className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No subscriptions yet</h3>
            <p className="text-muted-foreground mb-4">
              Create your first subscription to start receiving notifications
            </p>
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Subscription
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {data?.subscriptions.map((subscription) => (
            <SubscriptionCard
              key={subscription.id}
              subscription={subscription}
              onEdit={() => setEditSubscription(subscription)}
              onDelete={() => setDeleteId(subscription.id)}
              onPause={() => handlePause(subscription.id)}
              onResume={() => handleResume(subscription.id)}
              onTest={() => handleTest(subscription.id)}
            />
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Subscription</DialogTitle>
            <DialogDescription>
              Configure filters and notification channels for your subscription
            </DialogDescription>
          </DialogHeader>
          <SubscriptionForm
            onSubmit={handleCreate}
            onCancel={() => setShowCreateDialog(false)}
            isLoading={createMutation.isPending}
          />
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editSubscription} onOpenChange={(open) => !open && setEditSubscription(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Subscription</DialogTitle>
            <DialogDescription>
              Update your subscription filters and notification channels
            </DialogDescription>
          </DialogHeader>
          {editSubscription && (
            <SubscriptionForm
              onSubmit={handleEdit}
              onCancel={() => setEditSubscription(null)}
              isLoading={updateMutation.isPending}
              defaultValues={{
                name: editSubscription.name,
                description: editSubscription.description,
                filters: editSubscription.filters,
                channels: editSubscription.channels.map((ch) => ({
                  type: ch.type,
                  config: ch.config,
                })),
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* API Key Result Dialog */}
      <Dialog
        open={!!apiKeyResult}
        onOpenChange={() => setApiKeyResult(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Subscription Created!</DialogTitle>
            <DialogDescription>
              Save your API key - it won't be shown again
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-muted p-4 rounded-lg">
              <p className="text-sm text-muted-foreground mb-2">Your API Key:</p>
              <code className="text-sm font-mono break-all">
                {apiKeyResult?.apiKey}
              </code>
            </div>
            <p className="text-sm text-muted-foreground">
              Use this API key to manage your subscription programmatically.
            </p>
            <Button
              className="w-full"
              onClick={() => {
                navigator.clipboard.writeText(apiKeyResult?.apiKey || "")
                toast({ title: "API key copied to clipboard" })
              }}
            >
              Copy API Key
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Subscription?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. You will stop receiving
              notifications for this subscription.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
