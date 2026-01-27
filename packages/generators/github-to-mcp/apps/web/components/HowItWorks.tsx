'use client'

import { motion } from 'framer-motion'
import { Github, Code2, Server } from 'lucide-react'

const steps = [
  {
    number: 1,
    title: 'Paste GitHub URL',
    description: 'Enter any public GitHub repository URL. We support repos with README files, OpenAPI specs, GraphQL schemas, and source code.',
    icon: Github,
  },
  {
    number: 2,
    title: 'Analyze & Extract',
    description: 'We analyze the repository structure, detect the type (SDK, CLI, library), and extract all available tools and endpoints.',
    icon: Code2,
  },
  {
    number: 3,
    title: 'Get MCP Server',
    description: 'Download production-ready MCP server code in TypeScript or Python, with configs for Claude Desktop, Cursor, and more.',
    icon: Server,
  },
]

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="py-24 scroll-mt-24 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-dots opacity-30" aria-hidden="true" />

      <div className="relative z-10">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
            How it <span className="text-neutral-500">works</span>
          </h2>
          <p className="text-xl text-neutral-400 max-w-2xl mx-auto">
            Three simple steps to convert any GitHub repo into an MCP server.
          </p>
        </motion.div>

        {/* Steps timeline */}
        <div className="max-w-4xl mx-auto">
          <div className="relative">
            {/* Connecting line */}
            <div className="absolute left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-neutral-600 via-neutral-700 to-neutral-800 hidden md:block" />

            {/* Steps */}
            <div className="space-y-12 md:space-y-24">
              {steps.map((step, index) => {
                const Icon = step.icon
                const isEven = index % 2 === 0

                return (
                  <motion.div
                    key={step.number}
                    initial={{ opacity: 0, x: isEven ? -50 : 50 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: index * 0.2 }}
                    className={`flex flex-col md:flex-row items-center gap-8 ${
                      isEven ? 'md:flex-row' : 'md:flex-row-reverse'
                    }`}
                  >
                    {/* Content */}
                    <div className={`flex-1 text-center ${isEven ? 'md:text-right' : 'md:text-left'}`}>
                      <motion.div
                        whileHover={{ scale: 1.02 }}
                        className="inline-block"
                      >
                        <div className="rounded-2xl p-6 md:p-8 bg-neutral-900/50 backdrop-blur-sm border border-neutral-800">
                          <div className="text-sm font-bold text-neutral-500 mb-2">
                            Step {step.number}
                          </div>
                          <h3 className="text-xl md:text-2xl font-bold text-white mb-3">
                            {step.title}
                          </h3>
                          <p className="text-neutral-400">
                            {step.description}
                          </p>
                        </div>
                      </motion.div>
                    </div>

                    {/* Center icon */}
                    <div className="relative z-10">
                      <motion.div
                        whileHover={{ scale: 1.1 }}
                        className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-white/5 border border-neutral-700 flex items-center justify-center shadow-lg"
                      >
                        <Icon className="w-8 h-8 md:w-10 md:h-10 text-white" />
                      </motion.div>
                      
                      {/* Number badge */}
                      <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-white text-black flex items-center justify-center text-xs font-bold">
                        {step.number}
                      </div>
                    </div>

                    {/* Empty space for alternating layout */}
                    <div className="flex-1 hidden md:block" aria-hidden="true" />
                  </motion.div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
