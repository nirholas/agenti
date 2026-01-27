'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Filter, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TEMPLATES, TEMPLATE_TYPE_COLORS } from '@/lib/constants';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { CodeBlock } from '@/components/ui/CodeBlock';

type TemplateType = 'all' | 'mcp' | 'default' | 'openapi' | 'settings' | 'standalone' | 'markdown';

const filterOptions: { id: TemplateType; label: string }[] = [
  { id: 'all', label: 'All Templates' },
  { id: 'mcp', label: 'MCP' },
  { id: 'default', label: 'Default' },
  { id: 'openapi', label: 'OpenAPI' },
  { id: 'settings', label: 'Settings' },
  { id: 'standalone', label: 'Standalone' },
  { id: 'markdown', label: 'Markdown' },
];

export default function TemplatesPage() {
  const [activeFilter, setActiveFilter] = useState<TemplateType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedTemplate, setExpandedTemplate] = useState<string | null>(null);

  const filteredTemplates = TEMPLATES.filter((template) => {
    const matchesFilter = activeFilter === 'all' || template.type === activeFilter;
    const matchesSearch =
      searchQuery === '' ||
      template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.useCase.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="min-h-screen pt-24 pb-16">
      {/* Header */}
      <section className="container mx-auto px-4 mb-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="max-w-3xl"
        >
          <h1 className="text-headline mb-4">
            Plugin <span className="gradient-text">Templates</span>
          </h1>
          <p className="text-body-lg text-muted-foreground">
            Explore all 8 plugin templates supported by Lyra. Each template is designed 
            for specific use cases, from simple basic plugins to complex MCP servers.
          </p>
        </motion.div>
      </section>

      {/* Filters */}
      <section className="container mx-auto px-4 mb-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="flex flex-col md:flex-row gap-4"
        >
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search templates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={cn(
                'w-full pl-10 pr-4 py-2.5 rounded-xl',
                'bg-white/5 border border-white/10',
                'text-white placeholder:text-muted-foreground',
                'focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-transparent',
                'transition-all duration-200'
              )}
            />
          </div>

          {/* Filter buttons */}
          <div className="flex flex-wrap gap-2">
            {filterOptions.map((option) => (
              <button
                key={option.id}
                onClick={() => setActiveFilter(option.id)}
                className={cn(
                  'px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200',
                  activeFilter === option.id
                    ? 'bg-white/15 text-white border border-white/20'
                    : 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10 border border-transparent'
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </motion.div>
      </section>

      {/* Templates Grid */}
      <section className="container mx-auto px-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <AnimatePresence mode="popLayout">
            {filteredTemplates.map((template, index) => (
              <motion.div
                key={template.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
              >
                <Card variant="glass" className="h-full">
                  <CardContent className="p-6">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-3xl">
                          {template.icon}
                        </div>
                        <div>
                          <h2 className="text-xl font-bold text-white">{template.name}</h2>
                          <Badge className={cn('mt-1', TEMPLATE_TYPE_COLORS[template.type])}>
                            {template.type.toUpperCase()}
                          </Badge>
                        </div>
                      </div>
                      <button
                        onClick={() =>
                          setExpandedTemplate(
                            expandedTemplate === template.id ? null : template.id
                          )
                        }
                        className="p-2 rounded-lg hover:bg-white/5 transition-colors"
                      >
                        <motion.div
                          animate={{ rotate: expandedTemplate === template.id ? 180 : 0 }}
                          transition={{ duration: 0.2 }}
                        >
                          <ChevronDown size={20} className="text-white/40" />
                        </motion.div>
                      </button>
                    </div>

                    {/* Description */}
                    <p className="text-muted-foreground mb-4">{template.description}</p>

                    {/* Use case */}
                    <div className="p-3 rounded-lg bg-white/5 border border-white/10 mb-4">
                      <span className="text-xs font-medium text-white/60">Best for: </span>
                      <span className="text-sm text-white/80">{template.useCase}</span>
                    </div>

                    {/* Expanded Content */}
                    <AnimatePresence>
                      {expandedTemplate === template.id && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.3 }}
                          className="overflow-hidden"
                        >
                          {/* Detection Criteria */}
                          <div className="pt-4 border-t border-white/10 mb-6">
                            <h3 className="text-sm font-semibold text-white mb-3">
                              Detection Criteria
                            </h3>
                            <ul className="space-y-2">
                              {template.criteria.map((criterion, i) => (
                                <li
                                  key={i}
                                  className="flex items-start gap-2 text-sm text-muted-foreground"
                                >
                                  <span className="text-white/50 mt-1">•</span>
                                  {criterion}
                                </li>
                              ))}
                            </ul>
                          </div>

                          {/* Example Manifest */}
                          <div className="mb-6">
                            <h3 className="text-sm font-semibold text-white mb-3">
                              Example manifest.json
                            </h3>
                            <CodeBlock
                              code={JSON.stringify(template.example, null, 2)}
                              language="json"
                              showLineNumbers
                            />
                          </div>

                          {/* CLI Command */}
                          <div>
                            <h3 className="text-sm font-semibold text-white mb-3">
                              Generate with CLI
                            </h3>
                            <CodeBlock code={template.cliCommand} language="bash" />
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* No results */}
        {filteredTemplates.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-16"
          >
            <div className="text-4xl mb-4">🔍</div>
            <h3 className="text-xl font-semibold text-white mb-2">No templates found</h3>
            <p className="text-muted-foreground">
              Try adjusting your search or filter criteria.
            </p>
          </motion.div>
        )}
      </section>
    </div>
  );
}
