'use client'

import { motion } from 'framer-motion'

// Base skeleton component
function SkeletonPulse({ className }: { className?: string }) {
  return (
    <motion.div
      className={`bg-neutral-800 rounded ${className}`}
      animate={{
        opacity: [0.5, 0.8, 0.5],
      }}
      transition={{
        duration: 1.5,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    />
  )
}

// Document list item skeleton
export function DocumentItemSkeleton() {
  return (
    <div className="flex items-center justify-between p-3 bg-black/50 border border-neutral-800 rounded-lg">
      <div className="flex items-center gap-3 flex-1">
        <SkeletonPulse className="w-4 h-4 rounded" />
        <div className="flex-1 space-y-2">
          <SkeletonPulse className="h-4 w-3/4" />
          <SkeletonPulse className="h-3 w-1/2" />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <SkeletonPulse className="h-3 w-16" />
        <SkeletonPulse className="w-8 h-8 rounded-lg" />
      </div>
    </div>
  )
}

// Full document list skeleton
export function DocumentListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-2" role="status" aria-label="Loading documents">
      {Array.from({ length: count }).map((_, i) => (
        <DocumentItemSkeleton key={i} />
      ))}
      <span className="sr-only">Loading documents...</span>
    </div>
  )
}

// Preview content skeleton
export function PreviewSkeleton() {
  return (
    <div className="space-y-4" role="status" aria-label="Loading preview">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <SkeletonPulse className="h-9 w-48" />
        <SkeletonPulse className="h-8 w-20" />
      </div>
      
      {/* Content skeleton */}
      <div className="rounded-xl border border-neutral-800 p-4 bg-[#0a0a0a] space-y-3">
        <SkeletonPulse className="h-6 w-1/3" />
        <SkeletonPulse className="h-4 w-full" />
        <SkeletonPulse className="h-4 w-5/6" />
        <SkeletonPulse className="h-4 w-4/5" />
        <div className="h-2" />
        <SkeletonPulse className="h-5 w-1/4" />
        <SkeletonPulse className="h-4 w-full" />
        <SkeletonPulse className="h-4 w-3/4" />
        <SkeletonPulse className="h-4 w-5/6" />
        <div className="h-2" />
        <SkeletonPulse className="h-5 w-1/3" />
        <SkeletonPulse className="h-4 w-full" />
        <SkeletonPulse className="h-4 w-2/3" />
      </div>
      <span className="sr-only">Loading preview...</span>
    </div>
  )
}

// Stats card skeleton
export function StatsCardSkeleton() {
  return (
    <div className="p-4 bg-black/50 rounded-xl border border-neutral-800">
      <div className="flex items-center gap-2 mb-2">
        <SkeletonPulse className="w-4 h-4 rounded" />
        <SkeletonPulse className="h-3 w-20" />
      </div>
      <SkeletonPulse className="h-8 w-16" />
    </div>
  )
}

// Stats grid skeleton
export function StatsGridSkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4" role="status" aria-label="Loading statistics">
      <StatsCardSkeleton />
      <StatsCardSkeleton />
      <StatsCardSkeleton />
      <StatsCardSkeleton />
      <span className="sr-only">Loading statistics...</span>
    </div>
  )
}

// Download panel skeleton
export function DownloadPanelSkeleton() {
  return (
    <div className="space-y-6" role="status" aria-label="Loading download options">
      {/* Icon and text */}
      <div className="text-center">
        <SkeletonPulse className="w-16 h-16 mx-auto rounded-2xl mb-4" />
        <SkeletonPulse className="h-6 w-48 mx-auto mb-2" />
        <SkeletonPulse className="h-4 w-64 mx-auto" />
      </div>
      
      {/* Button */}
      <div className="flex flex-col items-center gap-4">
        <SkeletonPulse className="h-14 w-56 rounded-xl" />
        <div className="flex gap-6">
          <SkeletonPulse className="h-4 w-20" />
          <SkeletonPulse className="h-4 w-20" />
        </div>
      </div>
      <span className="sr-only">Loading download options...</span>
    </div>
  )
}

// Featured document button skeleton
export function FeaturedDocSkeleton() {
  return (
    <div className="flex items-center justify-between p-4 bg-white/5 border border-neutral-700 rounded-xl">
      <div className="flex items-center gap-3">
        <SkeletonPulse className="w-10 h-10 rounded-lg" />
        <div className="space-y-2">
          <SkeletonPulse className="h-4 w-32" />
          <SkeletonPulse className="h-3 w-48" />
        </div>
      </div>
      <SkeletonPulse className="w-5 h-5" />
    </div>
  )
}

// Table of contents skeleton
export function TOCSkeleton() {
  return (
    <div className="space-y-2 p-3 bg-black/50 rounded-lg border border-neutral-800">
      <SkeletonPulse className="h-4 w-24 mb-3" />
      <SkeletonPulse className="h-3 w-full" />
      <SkeletonPulse className="h-3 w-4/5 ml-4" />
      <SkeletonPulse className="h-3 w-3/4 ml-4" />
      <SkeletonPulse className="h-3 w-5/6" />
      <SkeletonPulse className="h-3 w-2/3 ml-4" />
      <SkeletonPulse className="h-3 w-4/5" />
    </div>
  )
}

// Header skeleton for mobile menu
export function NavSkeleton() {
  return (
    <div className="flex items-center gap-4" role="status" aria-label="Loading navigation">
      <SkeletonPulse className="h-4 w-20" />
      <SkeletonPulse className="h-4 w-16" />
      <span className="sr-only">Loading navigation...</span>
    </div>
  )
}
