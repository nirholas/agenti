/**
 * install.md Generator
 * 
 * Generates install.md files following the Mintlify standard
 * for LLM-executable installation instructions.
 */

import type { 
  InstallMdGeneratorData, 
  InstallMdTodoItem, 
  InstallMdStep 
} from '@/types'

/**
 * Generate a unique ID
 */
export function generateId(): string {
  return Math.random().toString(36).substring(2, 9)
}

/**
 * Create an empty todo item
 */
export function createEmptyTodoItem(): InstallMdTodoItem {
  return {
    id: generateId(),
    text: '',
    completed: false,
  }
}

/**
 * Create an empty step
 */
export function createEmptyStep(): InstallMdStep {
  return {
    id: generateId(),
    title: '',
    description: '',
    codeBlocks: [],
  }
}

/**
 * Create default generator data
 */
export function createDefaultGeneratorData(): InstallMdGeneratorData {
  return {
    productName: '',
    description: '',
    objective: '',
    doneWhen: '',
    todoItems: [createEmptyTodoItem()],
    steps: [createEmptyStep()],
  }
}

/**
 * Generate the install.md content from generator data
 */
export function generateInstallMd(data: InstallMdGeneratorData): string {
  const lines: string[] = []
  
  // Header - Product name as lowercase, hyphenated H1
  const slug = data.productName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  lines.push(`# ${slug || 'product-name'}`)
  lines.push('')
  
  // Description as blockquote
  if (data.description) {
    lines.push(`> ${data.description}`)
    lines.push('')
  }
  
  // Action prompt
  lines.push(`I want you to install ${data.productName || 'this software'} for me. Execute all the steps below autonomously.`)
  lines.push('')
  
  // OBJECTIVE
  if (data.objective) {
    lines.push(`OBJECTIVE: ${data.objective}`)
    lines.push('')
  }
  
  // DONE WHEN
  if (data.doneWhen) {
    lines.push(`DONE WHEN: ${data.doneWhen}`)
    lines.push('')
  }
  
  // TODO section
  lines.push('## TODO')
  lines.push('')
  for (const item of data.todoItems) {
    if (item.text.trim()) {
      const checkbox = item.completed ? '[x]' : '[ ]'
      lines.push(`- ${checkbox} ${item.text}`)
    }
  }
  lines.push('')
  
  // Step sections
  for (const step of data.steps) {
    if (step.title.trim()) {
      lines.push(`## ${step.title}`)
      lines.push('')
      
      if (step.description.trim()) {
        lines.push(step.description)
        lines.push('')
      }
      
      for (const block of step.codeBlocks) {
        if (block.label) {
          lines.push(`${block.label}:`)
          lines.push('')
        }
        lines.push(`\`\`\`${block.language || 'bash'}`)
        lines.push(block.code)
        lines.push('```')
        lines.push('')
      }
    }
  }
  
  // EXECUTE NOW call-to-action
  lines.push(`EXECUTE NOW: Complete the above TODO list to achieve: ${data.objective || 'successful installation'}.`)
  
  return lines.join('\n').trim() + '\n'
}

/**
 * Validate generator data
 */
export function validateGeneratorData(data: InstallMdGeneratorData): {
  isValid: boolean
  errors: string[]
} {
  const errors: string[] = []
  
  if (!data.productName.trim()) {
    errors.push('Product name is required')
  }
  
  if (!data.objective.trim()) {
    errors.push('Objective is required')
  }
  
  if (!data.doneWhen.trim()) {
    errors.push('Done When criteria is required')
  }
  
  const validTodos = data.todoItems.filter(t => t.text.trim())
  if (validTodos.length === 0) {
    errors.push('At least one TODO item is required')
  }
  
  const validSteps = data.steps.filter(s => s.title.trim())
  if (validSteps.length === 0) {
    errors.push('At least one step is required')
  }
  
  return {
    isValid: errors.length === 0,
    errors,
  }
}

/**
 * Pre-defined templates for common installation types
 */
export const INSTALL_MD_TEMPLATES = {
  npm: {
    name: 'NPM Package',
    description: 'For npm/yarn/pnpm installable packages',
    data: {
      objective: 'Install the package and verify it works correctly.',
      doneWhen: 'Package is installed and can be imported/used successfully.',
      todoItems: [
        { id: generateId(), text: 'Verify Node.js is installed', completed: false },
        { id: generateId(), text: 'Install the package', completed: false },
        { id: generateId(), text: 'Verify installation', completed: false },
      ],
      steps: [
        {
          id: generateId(),
          title: 'Prerequisites',
          description: 'You need to have Node.js installed. Verify your Node.js version:',
          codeBlocks: [
            { language: 'bash', code: 'node --version' },
          ],
        },
        {
          id: generateId(),
          title: 'Install the package',
          description: 'Install using your preferred package manager.',
          codeBlocks: [
            { language: 'bash', code: 'npm install package-name', label: 'Using npm' },
            { language: 'bash', code: 'yarn add package-name', label: 'Using yarn' },
            { language: 'bash', code: 'pnpm add package-name', label: 'Using pnpm' },
          ],
        },
        {
          id: generateId(),
          title: 'Verify installation',
          description: 'Verify the package was installed correctly:',
          codeBlocks: [
            { language: 'bash', code: 'npm list package-name' },
          ],
        },
      ],
    },
  },
  cli: {
    name: 'CLI Tool',
    description: 'For command-line interface tools',
    data: {
      objective: 'Install the CLI tool and make it available globally.',
      doneWhen: 'CLI is accessible from any terminal and --help shows usage.',
      todoItems: [
        { id: generateId(), text: 'Check system requirements', completed: false },
        { id: generateId(), text: 'Install the CLI globally', completed: false },
        { id: generateId(), text: 'Verify CLI is in PATH', completed: false },
        { id: generateId(), text: 'Test basic commands', completed: false },
      ],
      steps: [
        {
          id: generateId(),
          title: 'Prerequisites',
          description: 'Ensure you have the required dependencies installed.',
          codeBlocks: [],
        },
        {
          id: generateId(),
          title: 'Install the CLI',
          description: 'Install the CLI tool globally:',
          codeBlocks: [
            { language: 'bash', code: 'npm install -g cli-name' },
          ],
        },
        {
          id: generateId(),
          title: 'Verify installation',
          description: 'Check that the CLI is installed and accessible:',
          codeBlocks: [
            { language: 'bash', code: 'cli-name --version' },
            { language: 'bash', code: 'cli-name --help' },
          ],
        },
      ],
    },
  },
  python: {
    name: 'Python Package',
    description: 'For pip installable Python packages',
    data: {
      objective: 'Install the Python package and verify it can be imported.',
      doneWhen: 'Package can be imported in Python without errors.',
      todoItems: [
        { id: generateId(), text: 'Verify Python version', completed: false },
        { id: generateId(), text: 'Create virtual environment (recommended)', completed: false },
        { id: generateId(), text: 'Install the package', completed: false },
        { id: generateId(), text: 'Verify installation', completed: false },
      ],
      steps: [
        {
          id: generateId(),
          title: 'Prerequisites',
          description: 'You need Python 3.8 or higher. Check your Python version:',
          codeBlocks: [
            { language: 'bash', code: 'python --version' },
          ],
        },
        {
          id: generateId(),
          title: 'Create virtual environment',
          description: 'It\'s recommended to use a virtual environment:',
          codeBlocks: [
            { language: 'bash', code: 'python -m venv venv\nsource venv/bin/activate  # On Windows: venv\\Scripts\\activate' },
          ],
        },
        {
          id: generateId(),
          title: 'Install the package',
          description: 'Install using pip:',
          codeBlocks: [
            { language: 'bash', code: 'pip install package-name' },
          ],
        },
        {
          id: generateId(),
          title: 'Verify installation',
          description: 'Verify the package is installed:',
          codeBlocks: [
            { language: 'bash', code: 'pip show package-name' },
            { language: 'python', code: 'import package_name\nprint(package_name.__version__)' },
          ],
        },
      ],
    },
  },
  docker: {
    name: 'Docker Container',
    description: 'For Docker-based applications',
    data: {
      objective: 'Pull and run the Docker container successfully.',
      doneWhen: 'Container is running and accessible on the specified port.',
      todoItems: [
        { id: generateId(), text: 'Verify Docker is installed', completed: false },
        { id: generateId(), text: 'Pull the Docker image', completed: false },
        { id: generateId(), text: 'Run the container', completed: false },
        { id: generateId(), text: 'Verify container is running', completed: false },
      ],
      steps: [
        {
          id: generateId(),
          title: 'Prerequisites',
          description: 'You need Docker installed and running. Verify Docker is available:',
          codeBlocks: [
            { language: 'bash', code: 'docker --version\ndocker info' },
          ],
        },
        {
          id: generateId(),
          title: 'Pull the image',
          description: 'Pull the Docker image:',
          codeBlocks: [
            { language: 'bash', code: 'docker pull image-name:latest' },
          ],
        },
        {
          id: generateId(),
          title: 'Run the container',
          description: 'Start the container:',
          codeBlocks: [
            { language: 'bash', code: 'docker run -d -p 8080:8080 --name container-name image-name:latest' },
          ],
        },
        {
          id: generateId(),
          title: 'Verify container',
          description: 'Check that the container is running:',
          codeBlocks: [
            { language: 'bash', code: 'docker ps\ndocker logs container-name' },
          ],
        },
      ],
    },
  },
  binary: {
    name: 'Binary Download',
    description: 'For downloadable binary executables',
    data: {
      objective: 'Download and install the binary executable.',
      doneWhen: 'Binary is executable and responds to --version flag.',
      todoItems: [
        { id: generateId(), text: 'Detect operating system and architecture', completed: false },
        { id: generateId(), text: 'Download the appropriate binary', completed: false },
        { id: generateId(), text: 'Make binary executable', completed: false },
        { id: generateId(), text: 'Move to PATH location', completed: false },
        { id: generateId(), text: 'Verify installation', completed: false },
      ],
      steps: [
        {
          id: generateId(),
          title: 'Detect system',
          description: 'Determine your operating system and architecture:',
          codeBlocks: [
            { language: 'bash', code: 'uname -s  # OS\nuname -m  # Architecture' },
          ],
        },
        {
          id: generateId(),
          title: 'Download binary',
          description: 'Download the appropriate binary for your system:',
          codeBlocks: [
            { language: 'bash', code: 'curl -LO https://example.com/releases/latest/binary-linux-amd64', label: 'Linux (amd64)' },
            { language: 'bash', code: 'curl -LO https://example.com/releases/latest/binary-darwin-amd64', label: 'macOS (Intel)' },
            { language: 'bash', code: 'curl -LO https://example.com/releases/latest/binary-darwin-arm64', label: 'macOS (Apple Silicon)' },
          ],
        },
        {
          id: generateId(),
          title: 'Install binary',
          description: 'Make the binary executable and move it to your PATH:',
          codeBlocks: [
            { language: 'bash', code: 'chmod +x binary-*\nsudo mv binary-* /usr/local/bin/binary-name' },
          ],
        },
        {
          id: generateId(),
          title: 'Verify installation',
          description: 'Check that the binary is installed correctly:',
          codeBlocks: [
            { language: 'bash', code: 'binary-name --version' },
          ],
        },
      ],
    },
  },
} as const

export type InstallMdTemplateKey = keyof typeof INSTALL_MD_TEMPLATES
