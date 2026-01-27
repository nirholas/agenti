/**
 * install.md Parser
 * 
 * Parses the install.md format for LLM-executable installation instructions.
 * Based on the Mintlify standard: https://installmd.org
 */

import type { 
  ParsedInstallMd, 
  InstallMdTodoItem, 
  InstallMdStep 
} from '@/types'

/**
 * Generate a unique ID
 */
function generateId(): string {
  return Math.random().toString(36).substring(2, 9)
}

/**
 * Extract the product name from H1 header
 */
function extractProductName(content: string): string {
  const match = content.match(/^#\s+(.+)$/m)
  return match ? match[1].trim() : ''
}

/**
 * Extract the description from blockquote
 */
function extractDescription(content: string): string {
  const match = content.match(/^>\s*(.+)$/m)
  return match ? match[1].trim() : ''
}

/**
 * Extract the action prompt (first instruction paragraph after description)
 */
function extractActionPrompt(content: string): string {
  // Look for pattern like "I want you to install..."
  const match = content.match(/^(?!>|#|OBJECTIVE|DONE WHEN|TODO|\s*-\s*\[)([A-Z]I want you .+?)$/m)
  if (match) return match[1].trim()
  
  // Alternative: Look for any instruction line before OBJECTIVE
  const objectiveIndex = content.indexOf('OBJECTIVE:')
  if (objectiveIndex > -1) {
    const beforeObjective = content.substring(0, objectiveIndex)
    const lines = beforeObjective.split('\n').filter(line => 
      line.trim() && 
      !line.startsWith('#') && 
      !line.startsWith('>') &&
      !line.startsWith('```')
    )
    // Find a line that looks like an instruction
    for (const line of lines.reverse()) {
      if (line.includes('Execute') || line.includes('install') || line.includes('I want')) {
        return line.trim()
      }
    }
  }
  
  return ''
}

/**
 * Extract OBJECTIVE value
 */
function extractObjective(content: string): string {
  const match = content.match(/OBJECTIVE:\s*(.+?)(?:\n|$)/i)
  return match ? match[1].trim() : ''
}

/**
 * Extract DONE WHEN criteria
 */
function extractDoneWhen(content: string): string {
  const match = content.match(/DONE WHEN:\s*(.+?)(?:\n|$)/i)
  return match ? match[1].trim() : ''
}

/**
 * Extract TODO checkbox items
 */
function extractTodoItems(content: string): InstallMdTodoItem[] {
  const items: InstallMdTodoItem[] = []
  
  // Find the TODO section
  const todoMatch = content.match(/##\s*TODO\s*\n([\s\S]*?)(?=\n##|\n---|\nEXECUTE NOW|$)/i)
  if (!todoMatch) return items
  
  const todoSection = todoMatch[1]
  const checkboxRegex = /^-\s*\[([ xX])\]\s*(.+)$/gm
  let match
  
  while ((match = checkboxRegex.exec(todoSection)) !== null) {
    items.push({
      id: generateId(),
      text: match[2].trim(),
      completed: match[1].toLowerCase() === 'x'
    })
  }
  
  return items
}

/**
 * Extract code blocks from a section
 */
function extractCodeBlocks(sectionContent: string): Array<{
  language: string
  code: string
  label?: string
}> {
  const blocks: Array<{ language: string; code: string; label?: string }> = []
  const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g
  let match
  
  while ((match = codeBlockRegex.exec(sectionContent)) !== null) {
    const language = match[1] || 'bash'
    const code = match[2].trim()
    
    // Try to find a label (text right before the code block)
    const beforeBlock = sectionContent.substring(0, match.index)
    const lines = beforeBlock.split('\n').filter(l => l.trim())
    const lastLine = lines[lines.length - 1]
    
    // If the last line looks like a label (ends with colon or describes the command)
    let label: string | undefined
    if (lastLine && (lastLine.endsWith(':') || lastLine.toLowerCase().includes('using'))) {
      label = lastLine.replace(/:$/, '').trim()
    }
    
    blocks.push({ language, code, label })
  }
  
  return blocks
}

/**
 * Extract step sections (## headers with installation instructions)
 */
function extractSteps(content: string): InstallMdStep[] {
  const steps: InstallMdStep[] = []
  
  // Split by ## headers but exclude TODO section and special headers
  const sectionRegex = /^##\s+(?!TODO\b)(.+)$/gm
  const sections: { title: string; startIndex: number }[] = []
  let match
  
  while ((match = sectionRegex.exec(content)) !== null) {
    const title = match[1].trim()
    // Skip metadata-style headers
    if (['TODO', 'EXECUTE NOW'].some(skip => title.toUpperCase().includes(skip))) {
      continue
    }
    sections.push({
      title,
      startIndex: match.index
    })
  }
  
  // Extract content for each section
  for (let i = 0; i < sections.length; i++) {
    const section = sections[i]
    const nextSection = sections[i + 1]
    const endIndex = nextSection?.startIndex ?? content.length
    
    // Check for EXECUTE NOW marker
    const executeNowIndex = content.indexOf('EXECUTE NOW:', section.startIndex)
    const effectiveEndIndex = (executeNowIndex > section.startIndex && executeNowIndex < endIndex) 
      ? executeNowIndex 
      : endIndex
    
    const sectionContent = content.substring(section.startIndex, effectiveEndIndex)
    
    // Extract description (text before first code block, after header)
    const headerEnd = sectionContent.indexOf('\n') + 1
    const firstCodeBlock = sectionContent.indexOf('```')
    const descriptionEnd = firstCodeBlock > -1 ? firstCodeBlock : sectionContent.length
    const description = sectionContent
      .substring(headerEnd, descriptionEnd)
      .split('\n')
      .filter(line => line.trim() && !line.startsWith('#'))
      .join('\n')
      .trim()
    
    const codeBlocks = extractCodeBlocks(sectionContent)
    
    steps.push({
      id: generateId(),
      title: section.title,
      description,
      codeBlocks
    })
  }
  
  return steps
}

/**
 * Validate the install.md content
 */
function validateInstallMd(content: string): string[] {
  const errors: string[] = []
  
  // Check for product name (H1)
  if (!content.match(/^#\s+\S/m)) {
    errors.push('Missing product name (H1 header)')
  }
  
  // Check for OBJECTIVE
  if (!content.match(/OBJECTIVE:/i)) {
    errors.push('Missing OBJECTIVE declaration')
  }
  
  // Check for DONE WHEN
  if (!content.match(/DONE WHEN:/i)) {
    errors.push('Missing DONE WHEN criteria')
  }
  
  // Check for TODO section
  if (!content.match(/##\s*TODO/i)) {
    errors.push('Missing TODO section with checkbox items')
  }
  
  // Check for at least one step section
  const stepSections = content.match(/^##\s+(?!TODO\b).+$/gm)
  if (!stepSections || stepSections.length < 2) {
    errors.push('Should have at least one step section beyond TODO')
  }
  
  // Check for EXECUTE NOW
  if (!content.match(/EXECUTE NOW:/i)) {
    errors.push('Missing EXECUTE NOW call-to-action')
  }
  
  return errors
}

/**
 * Parse an install.md file content
 */
export function parseInstallMd(content: string): ParsedInstallMd {
  const validationErrors = validateInstallMd(content)
  
  return {
    raw: content,
    productName: extractProductName(content),
    description: extractDescription(content),
    actionPrompt: extractActionPrompt(content),
    objective: extractObjective(content),
    doneWhen: extractDoneWhen(content),
    todoItems: extractTodoItems(content),
    steps: extractSteps(content),
    isValid: validationErrors.length === 0,
    validationErrors
  }
}

/**
 * Check if content appears to be a valid install.md file
 */
export function isValidInstallMd(content: string): boolean {
  // Must have key markers
  const hasProductName = /^#\s+\S/m.test(content)
  const hasObjective = /OBJECTIVE:/i.test(content)
  const hasDoneWhen = /DONE WHEN:/i.test(content)
  const hasTodo = /##\s*TODO/i.test(content)
  
  return hasProductName && hasObjective && hasDoneWhen && hasTodo
}

/**
 * Extract a summary of the install.md for display
 */
export function getInstallMdSummary(parsed: ParsedInstallMd): {
  productName: string
  objective: string
  stepCount: number
  todoCount: number
  hasCodeBlocks: boolean
} {
  const totalCodeBlocks = parsed.steps.reduce(
    (sum, step) => sum + step.codeBlocks.length, 
    0
  )
  
  return {
    productName: parsed.productName,
    objective: parsed.objective,
    stepCount: parsed.steps.length,
    todoCount: parsed.todoItems.length,
    hasCodeBlocks: totalCodeBlocks > 0
  }
}

/**
 * Fetch and parse install.md from a URL
 */
export async function fetchInstallMd(url: string): Promise<ParsedInstallMd | null> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'llms-forge/1.0 (Documentation Extractor)',
      },
    })
    
    if (!response.ok) {
      return null
    }
    
    const content = await response.text()
    
    // Basic check if this looks like install.md content
    if (!isValidInstallMd(content)) {
      return null
    }
    
    return parseInstallMd(content)
  } catch {
    return null
  }
}

export { generateId }

// Re-export types for convenience
export type { ParsedInstallMd, InstallMdTodoItem, InstallMdStep } from '@/types'
