'use client'

import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Trash2, ChevronDown, ChevronUp, Code, FileText } from 'lucide-react'
import type { InstallMdStep } from '@/types'
import { createEmptyStep, generateId } from '@/lib/install-md-generator'

interface StepEditorProps {
  steps: InstallMdStep[]
  onChange: (steps: InstallMdStep[]) => void
}

export default function StepEditor({ steps, onChange }: StepEditorProps) {
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set(steps.map(s => s.id)))

  const toggleExpanded = useCallback((id: string) => {
    setExpandedSteps(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  const handleAddStep = useCallback(() => {
    const newStep = createEmptyStep()
    onChange([...steps, newStep])
    setExpandedSteps(prev => new Set(prev).add(newStep.id))
  }, [steps, onChange])

  const handleRemoveStep = useCallback((id: string) => {
    if (steps.length <= 1) return
    onChange(steps.filter(step => step.id !== id))
    setExpandedSteps(prev => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }, [steps, onChange])

  const handleUpdateStep = useCallback((id: string, updates: Partial<InstallMdStep>) => {
    onChange(steps.map(step => 
      step.id === id ? { ...step, ...updates } : step
    ))
  }, [steps, onChange])

  const handleMoveStep = useCallback((fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= steps.length) return
    const newSteps = [...steps]
    const [removed] = newSteps.splice(fromIndex, 1)
    newSteps.splice(toIndex, 0, removed)
    onChange(newSteps)
  }, [steps, onChange])

  const handleAddCodeBlock = useCallback((stepId: string) => {
    const step = steps.find(s => s.id === stepId)
    if (!step) return
    
    handleUpdateStep(stepId, {
      codeBlocks: [
        ...step.codeBlocks,
        { language: 'bash', code: '', label: '' }
      ]
    })
  }, [steps, handleUpdateStep])

  const handleUpdateCodeBlock = useCallback((
    stepId: string, 
    blockIndex: number, 
    updates: Partial<{ language: string; code: string; label: string }>
  ) => {
    const step = steps.find(s => s.id === stepId)
    if (!step) return

    const newCodeBlocks = step.codeBlocks.map((block, i) => 
      i === blockIndex ? { ...block, ...updates } : block
    )
    handleUpdateStep(stepId, { codeBlocks: newCodeBlocks })
  }, [steps, handleUpdateStep])

  const handleRemoveCodeBlock = useCallback((stepId: string, blockIndex: number) => {
    const step = steps.find(s => s.id === stepId)
    if (!step) return

    const newCodeBlocks = step.codeBlocks.filter((_, i) => i !== blockIndex)
    handleUpdateStep(stepId, { codeBlocks: newCodeBlocks })
  }, [steps, handleUpdateStep])

  return (
    <div className="space-y-4">
      <AnimatePresence mode="popLayout">
        {steps.map((step, index) => {
          const isExpanded = expandedSteps.has(step.id)
          
          return (
            <motion.div
              key={step.id}
              layout
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="border border-neutral-700 rounded-xl overflow-hidden"
            >
              {/* Step Header */}
              <div className="flex items-center gap-3 p-4 bg-white/5">
                {/* Move Buttons */}
                <div className="flex flex-col">
                  <button
                    type="button"
                    onClick={() => handleMoveStep(index, index - 1)}
                    disabled={index === 0}
                    className="p-0.5 text-neutral-500 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <ChevronUp className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMoveStep(index, index + 1)}
                    disabled={index === steps.length - 1}
                    className="p-0.5 text-neutral-500 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <ChevronDown className="w-4 h-4" />
                  </button>
                </div>

                {/* Step Number */}
                <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-sm font-medium text-white">
                  {index + 1}
                </div>

                {/* Title Input */}
                <input
                  type="text"
                  value={step.title}
                  onChange={(e) => handleUpdateStep(step.id, { title: e.target.value })}
                  placeholder="Step title (e.g., Install the CLI)"
                  className="flex-1 px-3 py-2 bg-transparent border-0 focus:outline-none text-white placeholder-neutral-500 font-medium"
                />

                {/* Expand/Collapse */}
                <button
                  type="button"
                  onClick={() => toggleExpanded(step.id)}
                  className="p-2 text-neutral-400 hover:text-white transition-colors"
                >
                  {isExpanded ? (
                    <ChevronUp className="w-5 h-5" />
                  ) : (
                    <ChevronDown className="w-5 h-5" />
                  )}
                </button>

                {/* Remove */}
                <button
                  type="button"
                  onClick={() => handleRemoveStep(step.id)}
                  disabled={steps.length <= 1}
                  className="p-2 text-neutral-500 hover:text-red-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {/* Step Content */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: 'auto' }}
                    exit={{ height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="p-4 space-y-4 border-t border-neutral-700/50">
                      {/* Description */}
                      <div>
                        <label className="flex items-center gap-2 text-sm text-neutral-400 mb-2">
                          <FileText className="w-4 h-4" />
                          Description
                        </label>
                        <textarea
                          value={step.description}
                          onChange={(e) => handleUpdateStep(step.id, { description: e.target.value })}
                          placeholder="Explain what this step does and why..."
                          rows={2}
                          className="w-full px-3 py-2 bg-white/5 border border-neutral-700 rounded-lg focus:outline-none focus:border-white text-white placeholder-neutral-500 resize-none"
                        />
                      </div>

                      {/* Code Blocks */}
                      <div>
                        <label className="flex items-center gap-2 text-sm text-neutral-400 mb-2">
                          <Code className="w-4 h-4" />
                          Code Blocks
                        </label>

                        <div className="space-y-3">
                          {step.codeBlocks.map((block, blockIndex) => (
                            <div key={blockIndex} className="border border-neutral-700 rounded-lg overflow-hidden">
                              {/* Code Block Header */}
                              <div className="flex items-center gap-2 px-3 py-2 bg-neutral-800/50 border-b border-neutral-700">
                                <input
                                  type="text"
                                  value={block.label || ''}
                                  onChange={(e) => handleUpdateCodeBlock(step.id, blockIndex, { label: e.target.value })}
                                  placeholder="Optional label (e.g., Using npm)"
                                  className="flex-1 px-2 py-1 bg-transparent border-0 focus:outline-none text-sm text-neutral-300 placeholder-neutral-500"
                                />
                                <select
                                  value={block.language}
                                  onChange={(e) => handleUpdateCodeBlock(step.id, blockIndex, { language: e.target.value })}
                                  className="px-2 py-1 bg-white/5 border border-neutral-600 rounded text-sm text-white focus:outline-none focus:border-white"
                                >
                                  <option value="bash">bash</option>
                                  <option value="javascript">javascript</option>
                                  <option value="typescript">typescript</option>
                                  <option value="python">python</option>
                                  <option value="json">json</option>
                                  <option value="yaml">yaml</option>
                                  <option value="shell">shell</option>
                                </select>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveCodeBlock(step.id, blockIndex)}
                                  className="p-1 text-neutral-500 hover:text-red-400 transition-colors"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>

                              {/* Code Textarea */}
                              <textarea
                                value={block.code}
                                onChange={(e) => handleUpdateCodeBlock(step.id, blockIndex, { code: e.target.value })}
                                placeholder="Enter command or code..."
                                rows={3}
                                className="w-full px-3 py-2 bg-neutral-900 border-0 focus:outline-none text-white font-mono text-sm resize-none"
                              />
                            </div>
                          ))}

                          {/* Add Code Block Button */}
                          <button
                            type="button"
                            onClick={() => handleAddCodeBlock(step.id)}
                            className="flex items-center gap-2 px-3 py-2 text-sm text-neutral-400 hover:text-white border border-dashed border-neutral-700 hover:border-neutral-500 rounded-lg transition-colors w-full justify-center"
                          >
                            <Plus className="w-4 h-4" />
                            Add Code Block
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )
        })}
      </AnimatePresence>

      {/* Add Step Button */}
      <button
        type="button"
        onClick={handleAddStep}
        className="flex items-center gap-2 px-4 py-3 text-neutral-400 hover:text-white border border-dashed border-neutral-700 hover:border-neutral-500 rounded-xl transition-colors w-full justify-center"
      >
        <Plus className="w-5 h-5" />
        Add Step
      </button>
    </div>
  )
}
