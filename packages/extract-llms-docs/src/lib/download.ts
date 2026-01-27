import type { Document } from '@/types'

/**
 * Download a single file by creating a blob and triggering download
 */
export function downloadFile(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/markdown' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * Download all documents as a ZIP file via the API
 */
export async function downloadZip(
  documents: Document[],
  fullDocument: Document,
  agentGuide: Document,
  siteName: string
): Promise<void> {
  const response = await fetch('/api/download', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ documents, fullDocument, agentGuide, siteName })
  })

  if (!response.ok) {
    throw new Error('Failed to generate ZIP file')
  }

  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${siteName}-docs.zip`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * Copy text to clipboard
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

/**
 * Extract hostname from URL for display
 */
export function getHostname(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return url
  }
}

/**
 * Calculate estimated file size from content
 */
export function estimateSize(content: string): string {
  const bytes = new Blob([content]).size
  if (bytes < 1024) {
    return `${bytes} B`
  } else if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`
  } else {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }
}

/**
 * Calculate total size of all documents
 */
export function calculateTotalSize(
  documents: Document[],
  fullDocument: Document,
  agentGuide: Document
): string {
  const allContent = [
    ...documents.map(d => d.content),
    fullDocument.content,
    agentGuide.content
  ].join('')
  return estimateSize(allContent)
}
