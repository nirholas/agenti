import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'llm.energy | Extract Documentation for AI Agents',
  description: 'Fetch and organize llms.txt files into downloadable markdown documents ready for Claude, ChatGPT, and other AI assistants.',
  keywords: ['AI', 'LLM', 'documentation', 'llms.txt', 'markdown', 'Claude', 'ChatGPT'],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-screen bg-dark-900 antialiased noise-overlay">
        <div className="fixed inset-0 grid-bg pointer-events-none" />
        <div className="fixed inset-0 hex-pattern pointer-events-none" />
        <div className="relative z-10">
          {children}
        </div>
      </body>
    </html>
  )
}
