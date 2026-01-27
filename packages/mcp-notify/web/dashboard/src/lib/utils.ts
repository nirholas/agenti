import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: Date | string): string {
  const d = new Date(date)
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

export function formatRelativeTime(date: Date | string): string {
  const d = new Date(date)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffSecs = Math.floor(diffMs / 1000)
  const diffMins = Math.floor(diffSecs / 60)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffSecs < 60) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return formatDate(d)
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str
  return str.slice(0, length) + '...'
}

export function getChangeTypeColor(type: string): string {
  switch (type) {
    case 'new':
      return 'text-success bg-success/10 border-success/20'
    case 'updated':
      return 'text-primary bg-primary/10 border-primary/20'
    case 'removed':
      return 'text-destructive bg-destructive/10 border-destructive/20'
    default:
      return 'text-muted-foreground bg-muted border-border'
  }
}

export function getChangeTypeLabel(type: string): string {
  switch (type) {
    case 'new':
      return 'New'
    case 'updated':
      return 'Updated'
    case 'removed':
      return 'Removed'
    default:
      return type
  }
}

export function getChannelIcon(type: string): string {
  switch (type) {
    case 'discord':
      return '💬'
    case 'slack':
      return '📱'
    case 'email':
      return '📧'
    case 'webhook':
      return '🔗'
    case 'telegram':
      return '✈️'
    case 'teams':
      return '👥'
    default:
      return '📢'
  }
}
