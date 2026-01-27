'use client'

import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowRight, ArrowLeft, Check, FileText, Edit3, Eye, Download } from 'lucide-react'
import type { GeneratorSection, GeneratorData } from '@/types'
import SectionEditor from './SectionEditor'
import Preview from './Preview'
import { nanoid } from 'nanoid'

interface GeneratorWizardProps {
  onComplete?: (data: GeneratorData) => void
}

type Step = 'basic' | 'sections' | 'preview'

const TEMPLATES = [
  {
    id: 'empty',
    name: 'Empty',
    description: 'Start from scratch',
    sections: [],
  },
  {
    id: 'basic-docs',
    name: 'Basic Documentation',
    description: 'Standard documentation structure',
    sections: [
      { id: nanoid(), title: 'Getting Started', content: 'Quick start guide for new users...' },
      { id: nanoid(), title: 'Installation', content: 'How to install and configure...' },
      { id: nanoid(), title: 'Usage', content: 'Basic usage examples...' },
      { id: nanoid(), title: 'API Reference', content: 'API documentation...' },
    ],
  },
  {
    id: 'api-reference',
    name: 'API Reference',
    description: 'For API documentation',
    sections: [
      { id: nanoid(), title: 'Authentication', content: 'How to authenticate requests...' },
      { id: nanoid(), title: 'Endpoints', content: 'List of available endpoints...' },
      { id: nanoid(), title: 'Request Format', content: 'How to format API requests...' },
      { id: nanoid(), title: 'Response Format', content: 'API response structure...' },
      { id: nanoid(), title: 'Error Handling', content: 'Error codes and handling...' },
    ],
  },
  {
    id: 'product-docs',
    name: 'Product Documentation',
    description: 'For product/service docs',
    sections: [
      { id: nanoid(), title: 'Overview', content: 'Product overview and key features...' },
      { id: nanoid(), title: 'Features', content: 'Detailed feature descriptions...' },
      { id: nanoid(), title: 'Pricing', content: 'Pricing tiers and options...' },
      { id: nanoid(), title: 'FAQ', content: 'Frequently asked questions...' },
      { id: nanoid(), title: 'Support', content: 'How to get support...' },
    ],
  },
]

export default function GeneratorWizard({ onComplete }: GeneratorWizardProps) {
  const [step, setStep] = useState<Step>('basic')
  const [data, setData] = useState<GeneratorData>({
    siteName: '',
    description: '',
    url: '',
    sections: [],
  })
  const [selectedTemplate, setSelectedTemplate] = useState<string>('empty')

  const handleBasicSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault()
    
    // Apply template sections if template was selected
    const template = TEMPLATES.find(t => t.id === selectedTemplate)
    if (template && template.sections.length > 0 && data.sections.length === 0) {
      setData(prev => ({
        ...prev,
        sections: template.sections.map(s => ({ ...s, id: nanoid() })),
      }))
    }
    
    setStep('sections')
  }, [selectedTemplate, data.sections.length])

  const handleSectionsChange = useCallback((sections: GeneratorSection[]) => {
    setData(prev => ({ ...prev, sections }))
  }, [])

  const handleComplete = useCallback(() => {
    onComplete?.(data)
  }, [data, onComplete])

  const canProceedToSections = data.siteName.trim().length > 0
  const canProceedToPreview = data.sections.length > 0

  return (
    <div className="space-y-8">
      {/* Progress Steps */}
      <div className="flex items-center justify-center gap-4">
        {[
          { id: 'basic', label: 'Basic Info', icon: FileText },
          { id: 'sections', label: 'Sections', icon: Edit3 },
          { id: 'preview', label: 'Preview', icon: Eye },
        ].map((s, index) => (
          <div key={s.id} className="flex items-center">
            <button
              onClick={() => {
                if (s.id === 'basic') setStep('basic')
                else if (s.id === 'sections' && canProceedToSections) setStep('sections')
                else if (s.id === 'preview' && canProceedToPreview) setStep('preview')
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                step === s.id
                  ? 'bg-white text-black'
                  : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
              }`}
            >
              <s.icon className="w-4 h-4" />
              <span className="hidden sm:inline">{s.label}</span>
              <span className="sm:hidden">{index + 1}</span>
            </button>
            {index < 2 && (
              <ArrowRight className="w-4 h-4 text-neutral-600 mx-2" />
            )}
          </div>
        ))}
      </div>

      {/* Step Content */}
      <AnimatePresence mode="wait">
        {/* Step 1: Basic Info */}
        {step === 'basic' && (
          <motion.div
            key="basic"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <form onSubmit={handleBasicSubmit} className="space-y-6">
              <div className="rounded-2xl border border-neutral-800 p-6 bg-neutral-900/50">
                <h2 className="text-lg font-semibold text-white mb-4">Basic Information</h2>
                
                <div className="space-y-4">
                  <div>
                    <label htmlFor="siteName" className="block text-sm font-medium text-neutral-400 mb-2">
                      Site Name *
                    </label>
                    <input
                      id="siteName"
                      type="text"
                      value={data.siteName}
                      onChange={(e) => setData(prev => ({ ...prev, siteName: e.target.value }))}
                      placeholder="My Documentation"
                      className="w-full px-4 py-3 bg-black border border-neutral-700 rounded-xl text-white placeholder-neutral-500 focus:border-neutral-500 focus:outline-none"
                      required
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="description" className="block text-sm font-medium text-neutral-400 mb-2">
                      Description
                    </label>
                    <textarea
                      id="description"
                      value={data.description}
                      onChange={(e) => setData(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Brief description of your documentation..."
                      rows={3}
                      className="w-full px-4 py-3 bg-black border border-neutral-700 rounded-xl text-white placeholder-neutral-500 focus:border-neutral-500 focus:outline-none resize-none"
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="url" className="block text-sm font-medium text-neutral-400 mb-2">
                      Source URL (optional)
                    </label>
                    <input
                      id="url"
                      type="url"
                      value={data.url}
                      onChange={(e) => setData(prev => ({ ...prev, url: e.target.value }))}
                      placeholder="https://docs.example.com"
                      className="w-full px-4 py-3 bg-black border border-neutral-700 rounded-xl text-white placeholder-neutral-500 focus:border-neutral-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Templates */}
              <div className="rounded-2xl border border-neutral-800 p-6 bg-neutral-900/50">
                <h2 className="text-lg font-semibold text-white mb-4">Start from Template</h2>
                
                <div className="grid grid-cols-2 gap-3">
                  {TEMPLATES.map((template) => (
                    <button
                      key={template.id}
                      type="button"
                      onClick={() => setSelectedTemplate(template.id)}
                      className={`p-4 rounded-xl border text-left transition-colors ${
                        selectedTemplate === template.id
                          ? 'border-white bg-white/10'
                          : 'border-neutral-700 hover:border-neutral-500'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-white">{template.name}</span>
                        {selectedTemplate === template.id && (
                          <Check className="w-4 h-4 text-white" />
                        )}
                      </div>
                      <p className="text-xs text-neutral-400">{template.description}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Next Button */}
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={!canProceedToSections}
                  className="flex items-center gap-2 px-6 py-3 bg-white text-black font-semibold rounded-xl hover:bg-neutral-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next: Add Sections
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </form>
          </motion.div>
        )}

        {/* Step 2: Sections */}
        {step === 'sections' && (
          <motion.div
            key="sections"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <div className="rounded-2xl border border-neutral-800 p-6 bg-neutral-900/50">
              <h2 className="text-lg font-semibold text-white mb-4">Documentation Sections</h2>
              
              <SectionEditor
                sections={data.sections}
                onChange={handleSectionsChange}
              />
            </div>

            {/* Navigation */}
            <div className="flex justify-between">
              <button
                type="button"
                onClick={() => setStep('basic')}
                className="flex items-center gap-2 px-6 py-3 bg-neutral-800 text-white rounded-xl hover:bg-neutral-700 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
              
              <button
                type="button"
                onClick={() => setStep('preview')}
                disabled={!canProceedToPreview}
                className="flex items-center gap-2 px-6 py-3 bg-white text-black font-semibold rounded-xl hover:bg-neutral-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next: Preview
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}

        {/* Step 3: Preview */}
        {step === 'preview' && (
          <motion.div
            key="preview"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <Preview data={data} />

            {/* Navigation */}
            <div className="flex justify-between">
              <button
                type="button"
                onClick={() => setStep('sections')}
                className="flex items-center gap-2 px-6 py-3 bg-neutral-800 text-white rounded-xl hover:bg-neutral-700 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
              
              <button
                type="button"
                onClick={handleComplete}
                className="flex items-center gap-2 px-6 py-3 bg-white text-black font-semibold rounded-xl hover:bg-neutral-200 transition-colors"
              >
                <Download className="w-4 h-4" />
                Download llms.txt
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
