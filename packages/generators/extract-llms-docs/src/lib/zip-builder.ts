import JSZip from 'jszip'
import type { GeneratedOutputs } from './output-generator'
import { slugify } from './parser'

/**
 * Create a ZIP bundle containing all documentation files
 */
export async function createZipBundle(
  outputs: GeneratedOutputs,
  siteName: string
): Promise<Blob> {
  const zip = new JSZip()
  const folderName = `${slugify(siteName)}-docs`
  const folder = zip.folder(folderName)

  if (!folder) {
    throw new Error('Failed to create ZIP folder')
  }

  // Add README
  folder.file(outputs.readme.filename, outputs.readme.content)

  // Add full documentation
  folder.file(outputs.fullDocument.filename, outputs.fullDocument.content)

  // Add agent prompt
  folder.file(outputs.agentPrompt.filename, outputs.agentPrompt.content)

  // Add MCP config
  folder.file(outputs.mcpConfig.filename, outputs.mcpConfig.content)

  // Add install.md if available
  if (outputs.installMd) {
    folder.file(outputs.installMd.filename, outputs.installMd.content)
  }

  // Add sections in subfolder
  const sectionsFolder = folder.folder('sections')
  if (sectionsFolder) {
    for (const section of outputs.sections) {
      sectionsFolder.file(section.filename, section.content)
    }
  }

  return await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  })
}

/**
 * Create a ZIP bundle with custom file selection
 */
export async function createCustomZipBundle(
  outputs: GeneratedOutputs,
  siteName: string,
  options: {
    includeFullDoc?: boolean
    includeAgentPrompt?: boolean
    includeMcpConfig?: boolean
    includeReadme?: boolean
    includeSections?: boolean
    includeInstallMd?: boolean
  }
): Promise<Blob> {
  const zip = new JSZip()
  const folderName = `${slugify(siteName)}-docs`
  const folder = zip.folder(folderName)

  if (!folder) {
    throw new Error('Failed to create ZIP folder')
  }

  // Add files based on options
  if (options.includeReadme !== false) {
    folder.file(outputs.readme.filename, outputs.readme.content)
  }

  if (options.includeFullDoc !== false) {
    folder.file(outputs.fullDocument.filename, outputs.fullDocument.content)
  }

  if (options.includeAgentPrompt !== false) {
    folder.file(outputs.agentPrompt.filename, outputs.agentPrompt.content)
  }

  if (options.includeMcpConfig !== false) {
    folder.file(outputs.mcpConfig.filename, outputs.mcpConfig.content)
  }

  // Add install.md if available and not excluded
  if (outputs.installMd && options.includeInstallMd !== false) {
    folder.file(outputs.installMd.filename, outputs.installMd.content)
  }

  if (options.includeSections !== false) {
    const sectionsFolder = folder.folder('sections')
    if (sectionsFolder) {
      for (const section of outputs.sections) {
        sectionsFolder.file(section.filename, section.content)
      }
    }
  }

  return await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  })
}

/**
 * Calculate total size of ZIP contents
 */
export function calculateZipSize(outputs: GeneratedOutputs): number {
  const totalSize =
    outputs.fullDocument.size +
    outputs.agentPrompt.size +
    outputs.mcpConfig.size +
    outputs.readme.size +
    outputs.sections.reduce((sum, section) => sum + section.size, 0) +
    (outputs.installMd?.size || 0)

  return totalSize
}

/**
 * Get file count for the ZIP
 */
export function getFileCount(outputs: GeneratedOutputs): number {
  // 4 main files + sections + optional install.md
  return 4 + outputs.sections.length + (outputs.installMd ? 1 : 0)
}

/**
 * Format byte size to human-readable string
 */
export function formatSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`
  } else if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`
  } else {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }
}
