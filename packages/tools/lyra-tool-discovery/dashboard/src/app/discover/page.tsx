'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Github, Package, Loader2, CheckCircle, AlertCircle, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { CodeBlock } from '@/components/ui/CodeBlock';
import { TEMPLATE_TYPE_COLORS } from '@/lib/constants';

type AnalysisState = 'idle' | 'loading' | 'success' | 'error';

interface MockResult {
  source: 'github' | 'npm';
  name: string;
  template: string;
  type: string;
  confidence: number;
  description: string;
  config: Record<string, unknown>;
}

export default function DiscoverPage() {
  const [inputValue, setInputValue] = useState('');
  const [inputType, setInputType] = useState<'github' | 'npm'>('github');
  const [analysisState, setAnalysisState] = useState<AnalysisState>('idle');
  const [result, setResult] = useState<MockResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async () => {
    if (!inputValue.trim()) return;

    setAnalysisState('loading');
    setResult(null);
    setError(null);

    // Simulate API call with mock data
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Mock result based on input
    if (inputValue.toLowerCase().includes('error')) {
      setAnalysisState('error');
      setError('Failed to analyze the repository. Please check the URL and try again.');
      return;
    }

    const mockResult: MockResult = {
      source: inputType,
      name: inputType === 'github' 
        ? inputValue.split('/').slice(-2).join('/') 
        : inputValue,
      template: 'mcp-stdio',
      type: 'mcp',
      confidence: 94,
      description: 'MCP server implementation using stdio transport for local process communication.',
      config: {
        name: inputType === 'github' 
          ? inputValue.split('/').pop() 
          : inputValue,
        version: '1.0.0',
        template: 'mcp-stdio',
        transport: 'stdio',
        command: 'node',
        args: ['./server.js'],
        capabilities: {
          tools: true,
          resources: true,
          prompts: false,
        },
      },
    };

    setResult(mockResult);
    setAnalysisState('success');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAnalyze();
    }
  };

  return (
    <div className="min-h-screen pt-24 pb-16">
      {/* Header */}
      <section className="container mx-auto px-4 mb-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="max-w-3xl mx-auto text-center"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 mb-6">
            <Sparkles size={16} className="text-white/60" />
            <span className="text-sm font-medium text-white/80">Interactive Demo</span>
          </div>
          <h1 className="text-headline mb-4">
            <span className="gradient-text">Discover</span> MCP Tools
          </h1>
          <p className="text-body-lg text-muted-foreground">
            Enter a GitHub repository URL or npm package name to analyze and discover
            the optimal plugin template.
          </p>
        </motion.div>
      </section>

      {/* Input Section */}
      <section className="container mx-auto px-4 mb-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="max-w-2xl mx-auto"
        >
          <Card variant="glass">
            <CardContent className="p-6">
              {/* Source Toggle */}
              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => setInputType('github')}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
                    inputType === 'github'
                      ? 'bg-white/15 text-white border border-white/20'
                      : 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10'
                  )}
                >
                  <Github size={16} />
                  GitHub
                </button>
                <button
                  onClick={() => setInputType('npm')}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
                    inputType === 'npm'
                      ? 'bg-white/15 text-white border border-white/20'
                      : 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10'
                  )}
                >
                  <Package size={16} />
                  npm
                </button>
              </div>

              {/* Input */}
              <div className="flex gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder={
                      inputType === 'github'
                        ? 'owner/repository or full GitHub URL'
                        : '@scope/package-name'
                    }
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className={cn(
                      'w-full pl-12 pr-4 py-3 rounded-xl',
                      'bg-white/5 border border-white/10',
                      'text-white placeholder:text-muted-foreground',
                      'focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-transparent',
                      'transition-all duration-200'
                    )}
                  />
                </div>
                <Button
                  onClick={handleAnalyze}
                  isLoading={analysisState === 'loading'}
                  disabled={!inputValue.trim()}
                >
                  Analyze
                </Button>
              </div>

              {/* Example inputs */}
              <div className="mt-4 text-sm text-muted-foreground">
                <span className="text-white/60">Try: </span>
                <button
                  onClick={() => {
                    setInputType('github');
                    setInputValue('modelcontextprotocol/servers');
                  }}
                  className="text-white/80 hover:text-white transition-colors underline underline-offset-2"
                >
                  modelcontextprotocol/servers
                </button>
                <span className="mx-2">or</span>
                <button
                  onClick={() => {
                    setInputType('npm');
                    setInputValue('@modelcontextprotocol/server-filesystem');
                  }}
                  className="text-white/80 hover:text-white transition-colors underline underline-offset-2"
                >
                  @modelcontextprotocol/server-filesystem
                </button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </section>

      {/* Results Section */}
      <section className="container mx-auto px-4">
        <div className="max-w-2xl mx-auto">
          <AnimatePresence mode="wait">
            {/* Loading State */}
            {analysisState === 'loading' && (
              <motion.div
                key="loading"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                <Card variant="glass">
                  <CardContent className="p-8 text-center">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                      className="inline-block mb-4"
                    >
                      <Loader2 size={40} className="text-white" />
                    </motion.div>
                    <h3 className="text-lg font-semibold text-white mb-2">Analyzing...</h3>
                    <p className="text-muted-foreground">
                      AI is scanning the repository and determining the optimal template.
                    </p>
                    <div className="mt-6 space-y-2">
                      {['Fetching repository metadata', 'Analyzing code structure', 'Detecting patterns'].map(
                        (step, i) => (
                          <motion.div
                            key={step}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: i * 0.5 }}
                            className="flex items-center justify-center gap-2 text-sm text-muted-foreground"
                          >
                            <motion.div
                              animate={{ opacity: [0.5, 1, 0.5] }}
                              transition={{ duration: 1, repeat: Infinity }}
                              className="w-1.5 h-1.5 rounded-full bg-white"
                            />
                            {step}
                          </motion.div>
                        )
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Error State */}
            {analysisState === 'error' && error && (
              <motion.div
                key="error"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                <Card variant="glass" className="border-red-500/30">
                  <CardContent className="p-8 text-center">
                    <AlertCircle size={40} className="text-red-400 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-white mb-2">Analysis Failed</h3>
                    <p className="text-muted-foreground">{error}</p>
                    <Button
                      variant="outline"
                      onClick={() => setAnalysisState('idle')}
                      className="mt-6"
                    >
                      Try Again
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Success State */}
            {analysisState === 'success' && result && (
              <motion.div
                key="success"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                <Card variant="gradient">
                  <CardContent className="p-6">
                    {/* Success header */}
                    <div className="flex items-start gap-4 mb-6 pb-6 border-b border-white/10">
                      <div className="w-12 h-12 rounded-xl bg-green-500/20 border border-green-500/30 flex items-center justify-center">
                        <CheckCircle className="text-green-400" size={24} />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-white mb-1">
                          Analysis Complete
                        </h3>
                        <p className="text-sm text-muted-foreground">{result.name}</p>
                      </div>
                      <Badge className={cn(TEMPLATE_TYPE_COLORS[result.type])}>
                        {result.template}
                      </Badge>
                    </div>

                    {/* Confidence */}
                    <div className="mb-6">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-white/60">Confidence Score</span>
                        <span className="text-sm font-bold text-green-400">{result.confidence}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${result.confidence}%` }}
                          transition={{ duration: 0.5, delay: 0.2 }}
                          className="h-full bg-gradient-to-r from-green-500 to-emerald-400 rounded-full"
                        />
                      </div>
                    </div>

                    {/* Description */}
                    <div className="mb-6">
                      <h4 className="text-sm font-semibold text-white mb-2">Description</h4>
                      <p className="text-sm text-muted-foreground">{result.description}</p>
                    </div>

                    {/* Generated Config */}
                    <div className="mb-6">
                      <h4 className="text-sm font-semibold text-white mb-3">Generated Configuration</h4>
                      <CodeBlock
                        code={JSON.stringify(result.config, null, 2)}
                        language="json"
                        showLineNumbers
                        title="plugin.json"
                      />
                    </div>

                    {/* Note */}
                    <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                      <p className="text-sm text-white/70">
                        <strong>Note:</strong> This is a demo preview. For full functionality including
                        real AI analysis and pipeline integration, use the CLI:
                      </p>
                      <code className="block mt-2 text-xs text-white/60 font-mono">
                        npx lyra-discover analyze-{result.source === 'github' ? 'repo' : 'npm'} {result.name}
                      </code>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </section>
    </div>
  );
}
