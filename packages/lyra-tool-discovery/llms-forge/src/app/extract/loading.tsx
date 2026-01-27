import { Loader2 } from 'lucide-react'

export default function ExtractLoading() {
  return (
    <div className="fixed inset-0 bg-[#300a24] flex items-center justify-center">
      {/* Ubuntu-style loading */}
      <div className="text-center">
        <div className="relative w-24 h-24 mx-auto mb-6">
          {/* Ubuntu logo placeholder */}
          <div className="absolute inset-0 rounded-full border-4 border-orange-500/20" />
          <div className="absolute inset-2 rounded-full border-4 border-t-orange-500 animate-spin" />
          <Loader2 className="absolute inset-0 w-full h-full p-6 text-orange-400 animate-spin" />
        </div>
        <p className="text-white/80 font-mono text-sm">Loading llm.energy...</p>
        <p className="text-white/40 font-mono text-xs mt-2">Preparing extraction environment</p>
      </div>
    </div>
  )
}
