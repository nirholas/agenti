'use client'

import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowRight, ArrowLeft, Check, FileText, Edit3, Eye, Download, ListTodo, Wrench, Terminal } from 'lucide-react'
import type { InstallMdGeneratorData, InstallMdTodoItem, InstallMdStep } from '@/types'
import { 
  createDefaultGeneratorData, 
  createEmptyTodoItem, 
  createEmptyStep,
  generateInstallMd,
  validateGeneratorData,
  INSTALL_MD_TEMPLATES,
  type InstallMdTemplateKey
} from '@/lib/install-md-generator'
import TodoEditor from './TodoEditor'
import StepEditor from './StepEditor'
import Preview from './Preview'

interface InstallMdWizardProps {
  onComplete?: (content: string) => void
}

type Step = 'basic' | 'todos' | 'steps' | 'preview'

const STEPS: { id: Step; label: string; icon: React.ElementType }[] = [
  { id: 'basic', label: 'Basic Info', icon: FileText },
  { id: 'todos', label: 'TODO List', icon: ListTodo },
  { id: 'steps', label: 'Steps', icon: Wrench },
  { id: 'preview', label: 'Preview', icon: Eye },
]

export default function InstallMdWizard({ onComplete }: InstallMdWizardProps) {
  const [step, setStep] = useState<Step>('basic')
  const [data, setData] = useState<InstallMdGeneratorData>(createDefaultGeneratorData())
  const [selectedTemplate, setSelectedTemplate] = useState<string>('empty')
  const [validationErrors, setValidationErrors] = useState<string[]>([])

  const handleTemplateSelect = useCallback((templateKey: string) => {
    setSelectedTemplate(templateKey)
    if (templateKey === 'empty') {
      setData(createDefaultGeneratorData())
    } else {
      const template = INSTALL_MD_TEMPLATES[templateKey as InstallMdTemplateKey]
      if (template) {
        // Deep copy to avoid readonly type issues
        setData({
          ...createDefaultGeneratorData(),
          objective: template.data.objective,
          doneWhen: template.data.doneWhen,
          todoItems: template.data.todoItems.map(t => ({ 
            id: t.id, 
            text: t.text, 
            completed: t.completed 
          })),
          steps: template.data.steps.map(s => ({
            id: s.id,
            title: s.title,
            description: s.description,
            codeBlocks: s.codeBlocks.map(cb => ({ ...cb })),
          })),
          productName: data.productName || '',
          description: data.description || '',
        })
      }
    }
  }, [data.productName, data.description])

  const handleBasicSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault()
    setStep('todos')
  }, [])

  const handleTodosChange = useCallback((todoItems: InstallMdTodoItem[]) => {
    setData(prev => ({ ...prev, todoItems }))
  }, [])

  const handleStepsChange = useCallback((steps: InstallMdStep[]) => {
    setData(prev => ({ ...prev, steps }))
  }, [])

  const handleComplete = useCallback(() => {
    const { isValid, errors } = validateGeneratorData(data)
    if (!isValid) {
      setValidationErrors(errors)
      return
    }
    const content = generateInstallMd(data)
    onComplete?.(content)
  }, [data, onComplete])

  const canProceedToTodos = data.productName.trim().length > 0 && data.objective.trim().length > 0
  const canProceedToSteps = data.todoItems.some(t => t.text.trim())
  const canProceedToPreview = data.steps.some(s => s.title.trim())

  const currentStepIndex = STEPS.findIndex(s => s.id === step)

  return (
    <div className="space-y-8">
      {/* Progress Steps */}
      <div className="flex items-center justify-center gap-2 md:gap-4">
        {STEPS.map((s, index) => {
          const Icon = s.icon
          const isActive = s.id === step
          const isPast = index < currentStepIndex
          const isFuture = index > currentStepIndex

          return (
            <div key={s.id} className="flex items-center">
              <button
                onClick={() => {
                  if (isPast) setStep(s.id)
                }}
                disabled={isFuture}
                className={`
                  flex items-center gap-2 px-3 py-2 rounded-lg transition-colors
                  ${isActive ? 'bg-white text-black' : ''}
                  ${isPast ? 'bg-white/10 text-white hover:bg-white/20 cursor-pointer' : ''}
                  ${isFuture ? 'bg-white/5 text-neutral-500 cursor-not-allowed' : ''}
                `}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden md:inline text-sm font-medium">{s.label}</span>
              </button>
              {index < STEPS.length - 1 && (
                <ArrowRight className={`w-4 h-4 mx-1 md:mx-2 ${isPast ? 'text-white' : 'text-neutral-600'}`} />
              )}
            </div>
          )
        })}
      </div>

      {/* Validation Errors */}
      <AnimatePresence>
        {validationErrors.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl"
          >
            <ul className="list-disc list-inside text-red-400 text-sm">
              {validationErrors.map((error, i) => (
                <li key={i}>{error}</li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Step Content */}
      <AnimatePresence mode="wait">
        {step === 'basic' && (
          <motion.div
            key="basic"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <form onSubmit={handleBasicSubmit} className="space-y-6">
              {/* Template Selection */}
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-3">
                  Start from a template
                </label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => handleTemplateSelect('empty')}
                    className={`p-3 rounded-lg border transition-colors text-left ${
                      selectedTemplate === 'empty'
                        ? 'border-white bg-white/10'
                        : 'border-neutral-700 hover:border-neutral-600'
                    }`}
                  >
                    <Terminal className="w-5 h-5 mb-2 text-neutral-400" />
                    <div className="text-sm font-medium text-white">Empty</div>
                    <div className="text-xs text-neutral-500">Start from scratch</div>
                  </button>
                  {Object.entries(INSTALL_MD_TEMPLATES).map(([key, template]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => handleTemplateSelect(key)}
                      className={`p-3 rounded-lg border transition-colors text-left ${
                        selectedTemplate === key
                          ? 'border-white bg-white/10'
                          : 'border-neutral-700 hover:border-neutral-600'
                      }`}
                    >
                      <Terminal className="w-5 h-5 mb-2 text-neutral-400" />
                      <div className="text-sm font-medium text-white">{template.name}</div>
                      <div className="text-xs text-neutral-500 line-clamp-1">{template.description}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Product Name */}
              <div>
                <label htmlFor="productName" className="block text-sm font-medium text-neutral-300 mb-2">
                  Product Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  id="productName"
                  value={data.productName}
                  onChange={(e) => setData(prev => ({ ...prev, productName: e.target.value }))}
                  placeholder="e.g., Mintlify CLI"
                  className="w-full px-4 py-3 bg-white/5 border border-neutral-700 rounded-lg focus:outline-none focus:border-white text-white placeholder-neutral-500"
                />
                <p className="mt-1 text-xs text-neutral-500">
                  Will be converted to lowercase-hyphenated format (e.g., mintlify-cli)
                </p>
              </div>

              {/* Description */}
              <div>
                <label htmlFor="description" className="block text-sm font-medium text-neutral-300 mb-2">
                  Description
                </label>
                <input
                  type="text"
                  id="description"
                  value={data.description}
                  onChange={(e) => setData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="e.g., Documentation and setup instructions for Mintlify CLI"
                  className="w-full px-4 py-3 bg-white/5 border border-neutral-700 rounded-lg focus:outline-none focus:border-white text-white placeholder-neutral-500"
                />
              </div>

              {/* Objective */}
              <div>
                <label htmlFor="objective" className="block text-sm font-medium text-neutral-300 mb-2">
                  Objective <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  id="objective"
                  value={data.objective}
                  onChange={(e) => setData(prev => ({ ...prev, objective: e.target.value }))}
                  placeholder="e.g., Install the CLI and set up a local preview environment"
                  className="w-full px-4 py-3 bg-white/5 border border-neutral-700 rounded-lg focus:outline-none focus:border-white text-white placeholder-neutral-500"
                />
                <p className="mt-1 text-xs text-neutral-500">
                  What should the installation achieve?
                </p>
              </div>

              {/* Done When */}
              <div>
                <label htmlFor="doneWhen" className="block text-sm font-medium text-neutral-300 mb-2">
                  Done When <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  id="doneWhen"
                  value={data.doneWhen}
                  onChange={(e) => setData(prev => ({ ...prev, doneWhen: e.target.value }))}
                  placeholder="e.g., Local server is running at http://localhost:3000"
                  className="w-full px-4 py-3 bg-white/5 border border-neutral-700 rounded-lg focus:outline-none focus:border-white text-white placeholder-neutral-500"
                />
                <p className="mt-1 text-xs text-neutral-500">
                  Specific verification criteria for success
                </p>
              </div>

              {/* Next Button */}
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={!canProceedToTodos}
                  className={`
                    flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-colors
                    ${canProceedToTodos
                      ? 'bg-white text-black hover:bg-neutral-200'
                      : 'bg-white/10 text-neutral-500 cursor-not-allowed'
                    }
                  `}
                >
                  Next: TODO List
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </form>
          </motion.div>
        )}

        {step === 'todos' && (
          <motion.div
            key="todos"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-white mb-2">TODO Checklist</h3>
                <p className="text-sm text-neutral-400">
                  Define the steps the LLM should complete. These appear as checkboxes.
                </p>
              </div>

              <TodoEditor
                items={data.todoItems}
                onChange={handleTodosChange}
              />

              {/* Navigation */}
              <div className="flex justify-between">
                <button
                  onClick={() => setStep('basic')}
                  className="flex items-center gap-2 px-6 py-3 rounded-lg font-medium border border-neutral-700 text-white hover:bg-white/5 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </button>
                <button
                  onClick={() => setStep('steps')}
                  disabled={!canProceedToSteps}
                  className={`
                    flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-colors
                    ${canProceedToSteps
                      ? 'bg-white text-black hover:bg-neutral-200'
                      : 'bg-white/10 text-neutral-500 cursor-not-allowed'
                    }
                  `}
                >
                  Next: Steps
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {step === 'steps' && (
          <motion.div
            key="steps"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-white mb-2">Installation Steps</h3>
                <p className="text-sm text-neutral-400">
                  Define detailed instructions with code blocks for each step.
                </p>
              </div>

              <StepEditor
                steps={data.steps}
                onChange={handleStepsChange}
              />

              {/* Navigation */}
              <div className="flex justify-between">
                <button
                  onClick={() => setStep('todos')}
                  className="flex items-center gap-2 px-6 py-3 rounded-lg font-medium border border-neutral-700 text-white hover:bg-white/5 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </button>
                <button
                  onClick={() => setStep('preview')}
                  disabled={!canProceedToPreview}
                  className={`
                    flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-colors
                    ${canProceedToPreview
                      ? 'bg-white text-black hover:bg-neutral-200'
                      : 'bg-white/10 text-neutral-500 cursor-not-allowed'
                    }
                  `}
                >
                  Next: Preview
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {step === 'preview' && (
          <motion.div
            key="preview"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-white mb-2">Preview & Download</h3>
                <p className="text-sm text-neutral-400">
                  Review your install.md file and download when ready.
                </p>
              </div>

              <Preview content={generateInstallMd(data)} />

              {/* Navigation */}
              <div className="flex justify-between">
                <button
                  onClick={() => setStep('steps')}
                  className="flex items-center gap-2 px-6 py-3 rounded-lg font-medium border border-neutral-700 text-white hover:bg-white/5 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </button>
                <button
                  onClick={handleComplete}
                  className="flex items-center gap-2 px-6 py-3 rounded-lg font-medium bg-white text-black hover:bg-neutral-200 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Download install.md
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
