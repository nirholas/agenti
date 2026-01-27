import { describe, it, expect } from 'vitest'
import { 
  generateInstallMd, 
  validateGeneratorData, 
  createDefaultGeneratorData,
  createEmptyTodoItem,
  createEmptyStep,
  generateId,
  INSTALL_MD_TEMPLATES
} from '@/lib/install-md-generator'
import { parseInstallMd, isValidInstallMd } from '@/lib/install-md-parser'
import type { InstallMdGeneratorData } from '@/types'

describe('install-md-generator', () => {
  describe('generateId', () => {
    it('should generate unique IDs', () => {
      const id1 = generateId()
      const id2 = generateId()
      expect(id1).not.toBe(id2)
      expect(typeof id1).toBe('string')
      expect(id1.length).toBeGreaterThan(0)
    })
  })

  describe('createEmptyTodoItem', () => {
    it('should create an empty todo item with id', () => {
      const item = createEmptyTodoItem()
      expect(item.id).toBeDefined()
      expect(item.text).toBe('')
      expect(item.completed).toBe(false)
    })
  })

  describe('createEmptyStep', () => {
    it('should create an empty step with id', () => {
      const step = createEmptyStep()
      expect(step.id).toBeDefined()
      expect(step.title).toBe('')
      expect(step.description).toBe('')
      expect(step.codeBlocks).toEqual([])
    })
  })

  describe('createDefaultGeneratorData', () => {
    it('should create default generator data', () => {
      const data = createDefaultGeneratorData()
      
      expect(data.productName).toBe('')
      expect(data.description).toBe('')
      expect(data.objective).toBe('')
      expect(data.doneWhen).toBe('')
      // Default includes one empty todo item
      expect(data.todoItems).toHaveLength(1)
      expect(data.todoItems[0].text).toBe('')
      // Default includes one empty step
      expect(data.steps).toHaveLength(1)
      expect(data.steps[0].title).toBe('')
    })
  })

  describe('validateGeneratorData', () => {
    it('should return errors for empty data', () => {
      const data = createDefaultGeneratorData()
      const result = validateGeneratorData(data)
      
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Product name is required')
      expect(result.errors).toContain('Objective is required')
      expect(result.errors).toContain('Done When criteria is required')
      expect(result.errors).toContain('At least one TODO item is required')
    })

    it('should accept any product name format (will be slugified)', () => {
      const data: InstallMdGeneratorData = {
        productName: 'My Tool Name',
        description: 'Test',
        objective: 'Test objective',
        doneWhen: 'Test done',
        todoItems: [{ id: '1', text: 'Test item', completed: false }],
        steps: [{ id: '1', title: 'Install', description: '', codeBlocks: [] }]
      }
      const result = validateGeneratorData(data)
      
      // Product name is accepted since it will be slugified during generation
      expect(result.errors).not.toContain('Product name is required')
    })

    it('should accept valid lowercase-hyphenated names', () => {
      const data: InstallMdGeneratorData = {
        productName: 'my-awesome-tool',
        description: 'Test',
        objective: 'Test objective',
        doneWhen: 'Test done',
        todoItems: [{ id: '1', text: 'Test item', completed: false }],
        steps: [{ id: '1', title: 'Install', description: '', codeBlocks: [] }]
      }
      const result = validateGeneratorData(data)
      
      expect(result.isValid).toBe(true)
    })

    it('should require at least one TODO item with text', () => {
      const data: InstallMdGeneratorData = {
        productName: 'test',
        description: 'Test',
        objective: 'Test objective',
        doneWhen: 'Test done',
        todoItems: [{ id: '1', text: '', completed: false }],  // Empty text
        steps: [{ id: '1', title: 'Step', description: '', codeBlocks: [] }]
      }
      const result = validateGeneratorData(data)
      
      expect(result.errors).toContain('At least one TODO item is required')
    })

    it('should return no errors for valid data', () => {
      const data: InstallMdGeneratorData = {
        productName: 'my-tool',
        description: 'A great tool',
        objective: 'Install the tool successfully',
        doneWhen: 'Tool is installed and working',
        todoItems: [{ id: '1', text: 'Install', completed: false }],
        steps: [{ id: '1', title: 'Install Step', description: '', codeBlocks: [] }]
      }
      const result = validateGeneratorData(data)
      
      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })
  })

  describe('generateInstallMd', () => {
    it('should generate valid install.md content', () => {
      const data: InstallMdGeneratorData = {
        productName: 'test-cli',
        description: 'A command line tool for testing',
        objective: 'Install the Test CLI and verify it works',
        doneWhen: 'The test --version command returns a version number',
        todoItems: [
          { id: '1', text: 'Verify Node.js is installed', completed: false },
          { id: '2', text: 'Install the CLI globally', completed: false },
          { id: '3', text: 'Verify installation', completed: false }
        ],
        steps: [
          {
            id: '1',
            title: 'Prerequisites',
            description: 'Ensure Node.js is installed',
            codeBlocks: [{ language: 'bash', code: 'node --version' }]
          },
          {
            id: '2',
            title: 'Installation',
            description: 'Install the CLI globally',
            codeBlocks: [{ language: 'bash', code: 'npm install -g test-cli' }]
          }
        ]
      }

      const content = generateInstallMd(data)
      
      // Verify the generated content is valid
      expect(isValidInstallMd(content)).toBe(true)
      
      // Parse and verify structure
      const parsed = parseInstallMd(content)
      expect(parsed.productName).toBe('test-cli')
      expect(parsed.description).toBe('A command line tool for testing')
      expect(parsed.objective).toBe('Install the Test CLI and verify it works')
      expect(parsed.doneWhen).toBe('The test --version command returns a version number')
      expect(parsed.todoItems).toHaveLength(3)
      expect(parsed.steps).toHaveLength(2)
    })

    it('should include code blocks in steps', () => {
      const data: InstallMdGeneratorData = {
        productName: 'my-app',
        description: 'Test app',
        objective: 'Install the app',
        doneWhen: 'App is installed',
        todoItems: [{ id: '1', text: 'Install', completed: false }],
        steps: [
          {
            id: '1',
            title: 'Install',
            description: 'Run the install command',
            codeBlocks: [
              { language: 'bash', code: 'npm install my-app' },
              { language: 'bash', code: 'my-app init' }
            ]
          }
        ]
      }

      const content = generateInstallMd(data)
      
      expect(content).toContain('```bash')
      expect(content).toContain('npm install my-app')
      expect(content).toContain('my-app init')
    })

    it('should handle steps without code blocks', () => {
      const data: InstallMdGeneratorData = {
        productName: 'manual-setup',
        description: 'Manual setup guide',
        objective: 'Complete manual setup',
        doneWhen: 'Setup is complete',
        todoItems: [{ id: '1', text: 'Follow instructions', completed: false }],
        steps: [
          {
            id: '1',
            title: 'Manual Step',
            description: 'Follow the instructions in the GUI',
            codeBlocks: []
          }
        ]
      }

      const content = generateInstallMd(data)
      
      expect(content).toContain('## Manual Step')
      expect(content).toContain('Follow the instructions in the GUI')
      expect(isValidInstallMd(content)).toBe(true)
    })

    it('should handle empty steps array', () => {
      const data: InstallMdGeneratorData = {
        productName: 'simple-tool',
        description: 'A simple tool',
        objective: 'Install the tool',
        doneWhen: 'Tool is installed',
        todoItems: [{ id: '1', text: 'Install', completed: false }],
        steps: []
      }

      const content = generateInstallMd(data)
      
      // Without steps, it may not pass strict validation but should generate content
      expect(content).toContain('# simple-tool')
      expect(content).toContain('OBJECTIVE:')
    })

    it('should slugify product name correctly', () => {
      const data: InstallMdGeneratorData = {
        productName: 'My Awesome Tool',
        description: 'Test',
        objective: 'Test',
        doneWhen: 'Test',
        todoItems: [{ id: '1', text: 'Test', completed: false }],
        steps: [{ id: '1', title: 'Test', description: '', codeBlocks: [] }]
      }

      const content = generateInstallMd(data)
      
      expect(content).toContain('# my-awesome-tool')
    })
  })

  describe('INSTALL_MD_TEMPLATES', () => {
    it('should have predefined templates', () => {
      expect(INSTALL_MD_TEMPLATES).toBeDefined()
      expect(Object.keys(INSTALL_MD_TEMPLATES).length).toBeGreaterThan(0)
    })

    it('should have npm template', () => {
      expect(INSTALL_MD_TEMPLATES.npm).toBeDefined()
      expect(INSTALL_MD_TEMPLATES.npm.data.objective).toContain('Install the package')
    })

    it('should have cli template', () => {
      expect(INSTALL_MD_TEMPLATES.cli).toBeDefined()
      expect(INSTALL_MD_TEMPLATES.cli.data.objective).toContain('CLI')
    })

    it('should have python template', () => {
      expect(INSTALL_MD_TEMPLATES.python).toBeDefined()
      expect(INSTALL_MD_TEMPLATES.python.data.objective).toContain('Python')
    })

    it('should have docker template', () => {
      expect(INSTALL_MD_TEMPLATES.docker).toBeDefined()
      expect(INSTALL_MD_TEMPLATES.docker.data.objective).toContain('Docker')
    })

    it('templates should generate valid install.md', () => {
      Object.entries(INSTALL_MD_TEMPLATES).forEach(([name, template]) => {
        const data: InstallMdGeneratorData = {
          productName: `test-${name}`,
          description: 'Test description',
          objective: template.data.objective,
          doneWhen: template.data.doneWhen,
          todoItems: template.data.todoItems.map(t => ({ id: t.id, text: t.text, completed: t.completed })),
          steps: template.data.steps.map(s => ({
            id: s.id,
            title: s.title,
            description: s.description,
            codeBlocks: s.codeBlocks.map(cb => ({ ...cb })),
          })),
        }
        const content = generateInstallMd(data)
        expect(isValidInstallMd(content)).toBe(true)
      })
    })
  })
})
