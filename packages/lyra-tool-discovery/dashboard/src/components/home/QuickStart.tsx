'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { ArrowRight, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { CodeBlock } from '@/components/ui/CodeBlock';

function QuickStart() {
  const installCommand = 'npm install -g lyra-tool-discovery';
  
  const envSetup = `# Set up your AI provider (choose one)
export OPENAI_API_KEY="your-openai-key"
# or
export ANTHROPIC_API_KEY="your-anthropic-key"`;

  const firstCommand = `# Analyze a GitHub repository
lyra-discover analyze-repo modelcontextprotocol/servers

# Or analyze an npm package
lyra-discover analyze-npm @modelcontextprotocol/server-filesystem

# Discover MCP tools across GitHub
lyra-discover discover --source github --query "mcp server"`;

  return (
    <section id="quickstart" className="py-24 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/[0.02] to-transparent" />

      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-4xl mx-auto">
          {/* Section header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center mb-12"
          >
            <h2 className="text-headline mb-4">
              Get started in <span className="gradient-text">minutes</span>
            </h2>
            <p className="text-body-lg text-muted-foreground max-w-2xl mx-auto">
              Install the CLI, set up your AI provider, and start discovering MCP tools.
            </p>
          </motion.div>

          {/* Steps */}
          <div className="space-y-8">
            {/* Step 1: Install */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-lg bg-white/10 border border-white/20 flex items-center justify-center text-sm font-bold text-white">
                  1
                </div>
                <h3 className="text-lg font-semibold text-white">Install the CLI</h3>
              </div>
              <CodeBlock code={installCommand} language="bash" title="Terminal" />
            </motion.div>

            {/* Step 2: Environment */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-lg bg-white/10 border border-white/20 flex items-center justify-center text-sm font-bold text-white">
                  2
                </div>
                <h3 className="text-lg font-semibold text-white">Configure your AI provider</h3>
              </div>
              <CodeBlock code={envSetup} language="bash" title=".env" />
            </motion.div>

            {/* Step 3: Run */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.3 }}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-lg bg-white/10 border border-white/20 flex items-center justify-center text-sm font-bold text-white">
                  3
                </div>
                <h3 className="text-lg font-semibold text-white">Start discovering</h3>
              </div>
              <CodeBlock code={firstCommand} language="bash" title="Terminal" showLineNumbers />
            </motion.div>
          </div>

          {/* CTA */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="mt-12 text-center"
          >
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/docs">
                <Button size="lg" rightIcon={<ArrowRight size={18} />}>
                  Read Full Documentation
                </Button>
              </Link>
              <Link
                href="https://github.com/nirholas/lyra-tool-discovery/tree/main/examples"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button variant="outline" size="lg" rightIcon={<ExternalLink size={16} />}>
                  View Examples
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

export { QuickStart };
