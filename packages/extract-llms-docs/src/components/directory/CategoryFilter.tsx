'use client'

import { motion } from 'framer-motion'
import { Globe, Brain, Code, BookOpen, Cloud, Layers } from 'lucide-react'
import { CATEGORIES, CategoryId } from '@/data/sites'

const ICONS = {
  Globe,
  Brain,
  Code,
  BookOpen,
  Cloud,
  Layers,
}

interface CategoryFilterProps {
  selected: CategoryId
  onChange: (category: CategoryId) => void
  counts: Record<CategoryId, number>
}

export default function CategoryFilter({ selected, onChange, counts }: CategoryFilterProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="flex flex-wrap gap-2"
    >
      {CATEGORIES.map((category) => {
        const Icon = ICONS[category.icon as keyof typeof ICONS]
        const isSelected = selected === category.id
        const count = counts[category.id] || 0

        return (
          <button
            key={category.id}
            onClick={() => onChange(category.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              isSelected
                ? 'bg-white text-black'
                : 'bg-neutral-900 text-neutral-400 hover:bg-neutral-800 hover:text-white border border-neutral-800'
            }`}
          >
            <Icon className="w-4 h-4" />
            <span>{category.label}</span>
            <span
              className={`text-xs ${
                isSelected ? 'text-neutral-600' : 'text-neutral-600'
              }`}
            >
              {count}
            </span>
          </button>
        )
      })}
    </motion.div>
  )
}
