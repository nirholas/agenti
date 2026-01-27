'use client'

import { BookOpen, Zap, Sparkles, Terminal, Layers, Link2, Bug, Users, Scale } from 'lucide-react'
import Link from 'next/link'
import { Logo, LogoIcon } from './Logo'

// GitHub icon as inline SVG to avoid importing Github from lucide
function GithubIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
    </svg>
  )
}

const FOOTER_LINKS = {
  resources: [
    { href: '/#how-it-works', label: 'How it works', icon: Zap },
    { href: '/#features', label: 'Features', icon: Sparkles },
    { href: '/playground', label: 'Playground', icon: Terminal },
    { href: '/batch', label: 'Batch Convert', icon: Layers },
    { href: 'https://github.com/nirholas/github-to-mcp#readme', label: 'Documentation', icon: BookOpen, external: true },
    { href: 'https://modelcontextprotocol.io', label: 'MCP Protocol', icon: Link2, external: true },
  ],
  project: [
    { href: 'https://github.com/nirholas/github-to-mcp', label: 'GitHub Repository', icon: GithubIcon, external: true },
    { href: 'https://github.com/nirholas/github-to-mcp/issues', label: 'Report Issues', icon: Bug, external: true },
    { href: 'https://github.com/nirholas/github-to-mcp/blob/main/CONTRIBUTING.md', label: 'Contributing', icon: Users, external: true },
    { href: 'https://github.com/nirholas/github-to-mcp/blob/main/LICENSE', label: 'License', icon: Scale, external: true },
  ],
}

export default function Footer() {
  return (
    <footer className="border-t border-neutral-800 bg-black/80 backdrop-blur-xl">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 md:gap-8">
          {/* Brand */}
          <div className="md:col-span-2">
            <Link href="/" className="inline-block mb-4">
              <Logo size="lg" />
            </Link>
            <p className="text-neutral-500 text-sm max-w-md mb-6">
              Convert GitHub repositories into MCP (Model Context Protocol) servers, making your code instantly accessible to AI agents like Claude, ChatGPT, and other assistants.
            </p>
            <div className="flex items-center gap-3">
              <a 
                href="https://github.com/nirholas/github-to-mcp" 
                target="_blank" 
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-lg bg-white/5 border border-neutral-800 flex items-center justify-center hover:border-neutral-600 hover:bg-white/10 transition-colors"
                aria-label="GitHub"
              >
                <GithubIcon className="w-5 h-5 text-neutral-400 hover:text-white" />
              </a>
            </div>
          </div>

          {/* Resources */}
          <div>
            <h3 className="text-white font-semibold mb-4">Resources</h3>
            <ul className="space-y-3">
              {FOOTER_LINKS.resources.map((link) => (
                <li key={link.href}>
                  {link.external ? (
                    <a 
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors"
                    >
                      {link.icon && <link.icon className="w-4 h-4" />}
                      {link.label}
                    </a>
                  ) : (
                    <Link 
                      href={link.href}
                      className="flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors"
                    >
                      {link.icon && <link.icon className="w-4 h-4" />}
                      {link.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {/* Project */}
          <div>
            <h3 className="text-white font-semibold mb-4">Project</h3>
            <ul className="space-y-3">
              {FOOTER_LINKS.project.map((link) => (
                <li key={link.href}>
                  <a 
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors"
                  >
                    {link.icon && <link.icon className="w-4 h-4" />}
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom */}
        <div className="mt-12 pt-8 border-t border-neutral-800 flex flex-col md:flex-row items-center justify-center gap-4">
          <div className="text-sm text-neutral-500">
            © {new Date().getFullYear()} github-to-mcp — Open Source
          </div>
        </div>
      </div>
    </footer>
  )
}
