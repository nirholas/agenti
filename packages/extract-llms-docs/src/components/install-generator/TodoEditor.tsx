'use client'

import { useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Trash2, GripVertical } from 'lucide-react'
import type { InstallMdTodoItem } from '@/types'
import { createEmptyTodoItem } from '@/lib/install-md-generator'

interface TodoEditorProps {
  items: InstallMdTodoItem[]
  onChange: (items: InstallMdTodoItem[]) => void
}

export default function TodoEditor({ items, onChange }: TodoEditorProps) {
  const handleAddItem = useCallback(() => {
    onChange([...items, createEmptyTodoItem()])
  }, [items, onChange])

  const handleRemoveItem = useCallback((id: string) => {
    if (items.length <= 1) return
    onChange(items.filter(item => item.id !== id))
  }, [items, onChange])

  const handleUpdateItem = useCallback((id: string, text: string) => {
    onChange(items.map(item => 
      item.id === id ? { ...item, text } : item
    ))
  }, [items, onChange])

  const handleToggleCompleted = useCallback((id: string) => {
    onChange(items.map(item => 
      item.id === id ? { ...item, completed: !item.completed } : item
    ))
  }, [items, onChange])

  const handleMoveItem = useCallback((fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= items.length) return
    const newItems = [...items]
    const [removed] = newItems.splice(fromIndex, 1)
    newItems.splice(toIndex, 0, removed)
    onChange(newItems)
  }, [items, onChange])

  return (
    <div className="space-y-3">
      <AnimatePresence mode="popLayout">
        {items.map((item, index) => (
          <motion.div
            key={item.id}
            layout
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex items-center gap-3 group"
          >
            {/* Drag Handle */}
            <div className="flex flex-col opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                type="button"
                onClick={() => handleMoveItem(index, index - 1)}
                disabled={index === 0}
                className="p-0.5 text-neutral-500 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <svg className="w-3 h-3" viewBox="0 0 12 12" fill="currentColor">
                  <path d="M6 2L2 6h8L6 2z" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => handleMoveItem(index, index + 1)}
                disabled={index === items.length - 1}
                className="p-0.5 text-neutral-500 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <svg className="w-3 h-3" viewBox="0 0 12 12" fill="currentColor">
                  <path d="M6 10L2 6h8l-4 4z" />
                </svg>
              </button>
            </div>

            {/* Checkbox */}
            <button
              type="button"
              onClick={() => handleToggleCompleted(item.id)}
              className={`
                w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center transition-colors
                ${item.completed 
                  ? 'bg-white border-white' 
                  : 'border-neutral-600 hover:border-neutral-500'
                }
              `}
            >
              {item.completed && (
                <svg className="w-3 h-3 text-black" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M2 6l3 3 5-6" />
                </svg>
              )}
            </button>

            {/* Text Input */}
            <input
              type="text"
              value={item.text}
              onChange={(e) => handleUpdateItem(item.id, e.target.value)}
              placeholder="Enter TODO item..."
              className="flex-1 px-3 py-2 bg-white/5 border border-neutral-700 rounded-lg focus:outline-none focus:border-white text-white placeholder-neutral-500"
            />

            {/* Remove Button */}
            <button
              type="button"
              onClick={() => handleRemoveItem(item.id)}
              disabled={items.length <= 1}
              className="p-2 text-neutral-500 hover:text-red-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Add Item Button */}
      <button
        type="button"
        onClick={handleAddItem}
        className="flex items-center gap-2 px-4 py-2 text-sm text-neutral-400 hover:text-white border border-dashed border-neutral-700 hover:border-neutral-500 rounded-lg transition-colors w-full justify-center"
      >
        <Plus className="w-4 h-4" />
        Add TODO Item
      </button>

      {/* Help Text */}
      <p className="text-xs text-neutral-500 mt-2">
        Tip: These appear as checkboxes in the install.md. The LLM will work through them sequentially.
      </p>
    </div>
  )
}
