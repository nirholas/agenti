'use client'

import { useCallback, useState } from 'react'
import { motion, Reorder, useDragControls } from 'framer-motion'
import { Plus, Trash2, GripVertical, ChevronDown, ChevronUp } from 'lucide-react'
import { nanoid } from 'nanoid'
import type { GeneratorSection } from '@/types'

interface SectionEditorProps {
  sections: GeneratorSection[]
  onChange: (sections: GeneratorSection[]) => void
}

interface SectionItemProps {
  section: GeneratorSection
  onUpdate: (id: string, updates: Partial<GeneratorSection>) => void
  onDelete: (id: string) => void
}

function SectionItem({ section, onUpdate, onDelete }: SectionItemProps) {
  const [isExpanded, setIsExpanded] = useState(true)
  const dragControls = useDragControls()

  return (
    <Reorder.Item
      value={section}
      id={section.id}
      dragListener={false}
      dragControls={dragControls}
      className="bg-black border border-neutral-800 rounded-xl overflow-hidden"
    >
      {/* Section Header */}
      <div className="flex items-center gap-3 p-4 bg-neutral-900/50">
        <button
          type="button"
          className="cursor-grab active:cursor-grabbing p-1.5 hover:bg-white/10 rounded-lg transition-colors"
          onPointerDown={(e) => dragControls.start(e)}
          aria-label="Drag to reorder"
        >
          <GripVertical className="w-4 h-4 text-neutral-500" />
        </button>
        
        <input
          type="text"
          value={section.title}
          onChange={(e) => onUpdate(section.id, { title: e.target.value })}
          placeholder="Section Title"
          className="flex-1 bg-transparent border-none text-white font-medium focus:outline-none placeholder-neutral-500"
        />
        
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
          aria-label={isExpanded ? 'Collapse section' : 'Expand section'}
        >
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-neutral-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-neutral-400" />
          )}
        </button>
        
        <button
          type="button"
          onClick={() => onDelete(section.id)}
          className="p-1.5 hover:bg-red-500/20 text-neutral-400 hover:text-red-400 rounded-lg transition-colors"
          aria-label="Delete section"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
      
      {/* Section Content */}
      {isExpanded && (
        <motion.div
          initial={{ height: 0 }}
          animate={{ height: 'auto' }}
          exit={{ height: 0 }}
          className="p-4 pt-0"
        >
          <textarea
            value={section.content}
            onChange={(e) => onUpdate(section.id, { content: e.target.value })}
            placeholder="Section content (supports markdown)..."
            rows={4}
            className="w-full px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-lg text-white placeholder-neutral-500 focus:border-neutral-600 focus:outline-none resize-none font-mono text-sm"
          />
          <div className="flex justify-end mt-2">
            <span className="text-xs text-neutral-500">
              {section.content.length} characters
            </span>
          </div>
        </motion.div>
      )}
    </Reorder.Item>
  )
}

export default function SectionEditor({ sections, onChange }: SectionEditorProps) {
  const handleAdd = useCallback(() => {
    const newSection: GeneratorSection = {
      id: nanoid(),
      title: '',
      content: '',
    }
    onChange([...sections, newSection])
  }, [sections, onChange])

  const handleUpdate = useCallback((id: string, updates: Partial<GeneratorSection>) => {
    onChange(
      sections.map(section =>
        section.id === id ? { ...section, ...updates } : section
      )
    )
  }, [sections, onChange])

  const handleDelete = useCallback((id: string) => {
    onChange(sections.filter(section => section.id !== id))
  }, [sections, onChange])

  const handleReorder = useCallback((newOrder: GeneratorSection[]) => {
    onChange(newOrder)
  }, [onChange])

  return (
    <div className="space-y-4">
      {/* Section List */}
      {sections.length > 0 ? (
        <Reorder.Group
          axis="y"
          values={sections}
          onReorder={handleReorder}
          className="space-y-3"
        >
          {sections.map((section) => (
            <SectionItem
              key={section.id}
              section={section}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
            />
          ))}
        </Reorder.Group>
      ) : (
        <div className="text-center py-8 text-neutral-500">
          <p>No sections yet. Add your first section below.</p>
        </div>
      )}

      {/* Add Section Button */}
      <button
        type="button"
        onClick={handleAdd}
        className="w-full flex items-center justify-center gap-2 p-4 border-2 border-dashed border-neutral-700 rounded-xl text-neutral-400 hover:border-neutral-500 hover:text-white transition-colors"
      >
        <Plus className="w-4 h-4" />
        Add Section
      </button>

      {/* Help Text */}
      <p className="text-xs text-neutral-500 text-center">
        Drag sections to reorder. Each section becomes a ## header in the final llms.txt.
      </p>
    </div>
  )
}
