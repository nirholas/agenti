'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { TEMPLATES, TEMPLATE_TYPE_COLORS } from '@/lib/constants';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { CodeBlock } from '@/components/ui/CodeBlock';
import { ChevronDown, ChevronUp } from 'lucide-react';

type TemplateType = 'all' | 'mcp' | 'default' | 'openapi' | 'settings' | 'standalone' | 'markdown';

const filterTabs: { id: TemplateType; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'mcp', label: 'MCP' },
  { id: 'default', label: 'Default' },
  { id: 'openapi', label: 'OpenAPI' },
  { id: 'markdown', label: 'Markdown' },
];

function TemplateShowcase() {
  const [activeFilter, setActiveFilter] = useState<TemplateType>('all');
  const [expandedTemplate, setExpandedTemplate] = useState<string | null>(null);

  const filteredTemplates = activeFilter === 'all'
    ? TEMPLATES
    : TEMPLATES.filter(t => t.type === activeFilter);

  return (
    <section id="templates" className="py-24 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/[0.02] to-transparent" />

      <div className="container mx-auto px-4 relative z-10">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <h2 className="text-headline mb-4">
            <span className="gradient-text">8 Plugin Templates</span> for every use case
          </h2>
          <p className="text-body-lg text-muted-foreground max-w-2xl mx-auto">
            From simple basic plugins to complex MCP servers, we have the right template for your needs.
          </p>
        </motion.div>

        {/* Filter tabs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="flex flex-wrap justify-center gap-2 mb-12"
        >
          {filterTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveFilter(tab.id)}
              className={cn(
                'px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200',
                activeFilter === tab.id
                  ? 'bg-white/15 text-white border border-white/20'
                  : 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10 border border-transparent'
              )}
            >
              {tab.label}
            </button>
          ))}
        </motion.div>

        {/* Templates grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <AnimatePresence mode="popLayout">
            {filteredTemplates.map((template, index) => (
              <motion.div
                key={template.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
              >
                <Card
                  variant="glass"
                  className="h-full cursor-pointer"
                  onClick={() => setExpandedTemplate(
                    expandedTemplate === template.id ? null : template.id
                  )}
                >
                  <CardContent className="p-5">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{template.icon}</span>
                        <div>
                          <h3 className="font-semibold text-white">{template.name}</h3>
                          <Badge
                            className={cn('mt-1', TEMPLATE_TYPE_COLORS[template.type])}
                          >
                            {template.type}
                          </Badge>
                        </div>
                      </div>
                      <motion.div
                        animate={{ rotate: expandedTemplate === template.id ? 180 : 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <ChevronDown size={18} className="text-white/40" />
                      </motion.div>
                    </div>

                    {/* Description */}
                    <p className="text-sm text-muted-foreground mb-3">
                      {template.description}
                    </p>

                    {/* Use case */}
                    <div className="text-xs text-white/40">
                      <span className="font-medium text-white/60">Best for:</span>{' '}
                      {template.useCase}
                    </div>

                    {/* Expanded content */}
                    <AnimatePresence>
                      {expandedTemplate === template.id && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.3 }}
                          className="mt-4 pt-4 border-t border-white/10 overflow-hidden"
                        >
                          {/* Criteria */}
                          <div className="mb-4">
                            <h4 className="text-xs font-medium text-white/60 mb-2">
                              Detection Criteria:
                            </h4>
                            <ul className="space-y-1">
                              {template.criteria.map((criterion, i) => (
                                <li
                                  key={i}
                                  className="text-xs text-muted-foreground flex items-start gap-2"
                                >
                                  <span className="text-white/50 mt-0.5">•</span>
                                  {criterion}
                                </li>
                              ))}
                            </ul>
                          </div>

                          {/* Example config */}
                          <div>
                            <h4 className="text-xs font-medium text-white/60 mb-2">
                              Example Config:
                            </h4>
                            <CodeBlock
                              code={JSON.stringify(template.example, null, 2)}
                              language="json"
                              className="text-xs"
                            />
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
      </div>
    </section>
  );
}

export { TemplateShowcase };
