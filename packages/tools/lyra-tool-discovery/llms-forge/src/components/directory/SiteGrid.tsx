'use client'

import { motion, AnimatePresence } from 'framer-motion'
import SiteCard from './SiteCard'
import { SiteEntry } from '@/data/sites'

interface SiteGridProps {
  sites: SiteEntry[]
}

export default function SiteGrid({ sites }: SiteGridProps) {
  if (sites.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="text-center py-16"
      >
        <p className="text-neutral-500 text-lg">No sites found matching your criteria.</p>
        <p className="text-neutral-600 text-sm mt-2">Try adjusting your search or filters.</p>
      </motion.div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <AnimatePresence mode="popLayout">
        {sites.map((site, index) => (
          <SiteCard key={site.id} site={site} index={index} />
        ))}
      </AnimatePresence>
    </div>
  )
}
