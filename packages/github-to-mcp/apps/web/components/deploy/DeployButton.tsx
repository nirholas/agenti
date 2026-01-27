/**
 * Deploy Button Component - One-click cloud deployment
 * @copyright 2024-2026 nirholas
 * @license MIT
 */

'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Cloud, 
  Loader2, 
  Check, 
  Copy, 
  ExternalLink, 
  Zap,
  Shield,
  Globe,
  X,
  AlertCircle,
  Rocket,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { copyToClipboard } from '@/lib/utils';
import type { ConversionResult } from '@/types';
import type { DeployedServer, DeployResponse } from '@/types/deploy';

interface DeployButtonProps {
  result: ConversionResult;
  onDeploy?: (server: DeployedServer) => void;
  className?: string;
}

type DeployStep = 'idle' | 'configuring' | 'deploying' | 'success' | 'error';

export default function DeployButton({ result, onDeploy, className = '' }: DeployButtonProps) {
  const [step, setStep] = useState<DeployStep>('idle');
  const [showModal, setShowModal] = useState(false);
  const [deployedServer, setDeployedServer] = useState<DeployedServer | null>(null);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const handleCopy = useCallback(async (text: string, id: string) => {
    const success = await copyToClipboard(text);
    if (success) {
      setCopied(id);
      setTimeout(() => setCopied(null), 2000);
    }
  }, []);

  const handleDeploy = useCallback(async () => {
    setStep('deploying');
    setError(null);

    try {
      const response = await fetch('/api/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: result.name,
          description: result.description,
          code: result.code,
          tools: result.tools.map(t => ({
            name: t.name,
            description: t.description,
            inputSchema: t.inputSchema,
          })),
          sourceRepo: result.repository?.fullName,
        }),
      });

      const data = await response.json() as DeployResponse;

      if (!data.success || !data.server) {
        throw new Error(data.error || 'Deployment failed');
      }

      setDeployedServer(data.server);
      setApiKey(data.apiKey || null);
      setStep('success');

      // Store in localStorage for dashboard
      const stored = localStorage.getItem('deployed-servers');
      const servers = stored ? JSON.parse(stored) : [];
      servers.push(data.server);
      localStorage.setItem('deployed-servers', JSON.stringify(servers));

      onDeploy?.(data.server);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Deployment failed');
      setStep('error');
    }
  }, [result, onDeploy]);

  const openModal = useCallback(() => {
    setShowModal(true);
    setStep('configuring');
  }, []);

  const closeModal = useCallback(() => {
    setShowModal(false);
    if (step !== 'success') {
      setStep('idle');
    }
  }, [step]);

  // Generate Claude Desktop config for the deployed server
  const claudeConfig = deployedServer ? JSON.stringify({
    mcpServers: {
      [deployedServer.name]: {
        transport: 'http',
        url: deployedServer.endpoint,
        headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined,
      },
    },
  }, null, 2) : '';

  return (
    <>
      {/* Deploy Button */}
      <Button
        onClick={openModal}
        disabled={step === 'deploying'}
        className={`bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white border-0 ${className}`}
      >
        {step === 'deploying' ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Deploying...
          </>
        ) : step === 'success' ? (
          <>
            <Check className="w-4 h-4 mr-2" />
            Deployed!
          </>
        ) : (
          <>
            <Cloud className="w-4 h-4 mr-2" />
            Deploy to Cloud
          </>
        )}
      </Button>

      {/* Deploy Modal */}
      <AnimatePresence>
        {showModal && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeModal}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50"
            />

            {/* Modal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed inset-4 md:inset-auto md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-full md:max-w-lg bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl z-50 overflow-hidden flex flex-col max-h-[90vh]"
            >
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-neutral-800">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                    <Cloud className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white">Deploy to Cloud</h2>
                    <p className="text-sm text-neutral-400">Host your MCP server instantly</p>
                  </div>
                </div>
                <button
                  onClick={closeModal}
                  className="p-2 text-neutral-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-6">
                {step === 'configuring' && (
                  <div className="space-y-6">
                    {/* Server Info */}
                    <div className="p-4 bg-black/30 rounded-xl border border-neutral-800">
                      <div className="text-sm text-neutral-400 mb-1">Server Name</div>
                      <div className="text-lg font-medium text-white">{result.name}</div>
                      <div className="text-sm text-neutral-500 mt-1">
                        {result.tools.length} tools • {result.repository?.fullName || 'Local'}
                      </div>
                    </div>

                    {/* Features */}
                    <div className="space-y-3">
                      <h3 className="text-sm font-medium text-neutral-400">What you'll get:</h3>
                      {[
                        { icon: Globe, label: 'Instant endpoint URL', desc: 'No server setup required' },
                        { icon: Zap, label: 'Edge deployment', desc: 'Global low-latency access' },
                        { icon: Shield, label: 'Secure API key', desc: 'Protected access to your tools' },
                      ].map(({ icon: Icon, label, desc }) => (
                        <div key={label} className="flex items-start gap-3 p-3 bg-white/5 rounded-lg">
                          <Icon className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                          <div>
                            <div className="text-sm font-medium text-white">{label}</div>
                            <div className="text-xs text-neutral-500">{desc}</div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Tools preview */}
                    <div>
                      <h3 className="text-sm font-medium text-neutral-400 mb-2">Tools to deploy:</h3>
                      <div className="flex flex-wrap gap-2">
                        {result.tools.slice(0, 5).map(tool => (
                          <span
                            key={tool.name}
                            className="px-2 py-1 text-xs bg-white/5 border border-neutral-800 rounded text-neutral-300"
                          >
                            {tool.name}
                          </span>
                        ))}
                        {result.tools.length > 5 && (
                          <span className="px-2 py-1 text-xs text-neutral-500">
                            +{result.tools.length - 5} more
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {step === 'deploying' && (
                  <div className="flex flex-col items-center justify-center py-12">
                    <div className="relative">
                      <div className="w-16 h-16 rounded-full border-4 border-neutral-800 border-t-blue-500 animate-spin" />
                      <Rocket className="w-6 h-6 text-blue-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                    </div>
                    <div className="mt-6 text-lg font-medium text-white">Deploying your server...</div>
                    <div className="mt-2 text-sm text-neutral-400">This usually takes a few seconds</div>
                  </div>
                )}

                {step === 'success' && deployedServer && (
                  <div className="space-y-6">
                    {/* Success message */}
                    <div className="text-center py-4">
                      <div className="w-16 h-16 mx-auto rounded-full bg-green-500/20 flex items-center justify-center mb-4">
                        <Check className="w-8 h-8 text-green-400" />
                      </div>
                      <h3 className="text-xl font-bold text-white mb-2">Deployed Successfully!</h3>
                      <p className="text-neutral-400">Your MCP server is now live</p>
                    </div>

                    {/* Endpoint */}
                    <div className="p-4 bg-black/30 rounded-xl border border-neutral-800">
                      <div className="text-xs text-neutral-500 mb-2">Endpoint URL</div>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 text-sm text-green-400 font-mono truncate">
                          {deployedServer.endpoint}
                        </code>
                        <button
                          onClick={() => handleCopy(deployedServer.endpoint, 'endpoint')}
                          className="p-2 text-neutral-400 hover:text-white rounded-lg hover:bg-white/5"
                        >
                          {copied === 'endpoint' ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {/* API Key (only shown once!) */}
                    {apiKey && (
                      <div className="p-4 bg-yellow-500/10 rounded-xl border border-yellow-500/30">
                        <div className="flex items-center gap-2 mb-2">
                          <AlertCircle className="w-4 h-4 text-yellow-400" />
                          <div className="text-xs text-yellow-400 font-medium">Save your API key - shown once!</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <code className="flex-1 text-sm text-yellow-300 font-mono truncate">
                            {apiKey}
                          </code>
                          <button
                            onClick={() => handleCopy(apiKey, 'apikey')}
                            className="p-2 text-yellow-400 hover:text-yellow-300 rounded-lg hover:bg-yellow-500/10"
                          >
                            {copied === 'apikey' ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Claude Config */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-xs text-neutral-500">Claude Desktop Config</div>
                        <button
                          onClick={() => handleCopy(claudeConfig, 'config')}
                          className="text-xs text-neutral-400 hover:text-white flex items-center gap-1"
                        >
                          {copied === 'config' ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                          Copy
                        </button>
                      </div>
                      <pre className="p-3 bg-black/50 rounded-lg text-xs text-neutral-300 font-mono overflow-x-auto">
                        {claudeConfig}
                      </pre>
                    </div>
                  </div>
                )}

                {step === 'error' && (
                  <div className="flex flex-col items-center justify-center py-12">
                    <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mb-4">
                      <X className="w-8 h-8 text-red-400" />
                    </div>
                    <div className="text-lg font-medium text-white mb-2">Deployment Failed</div>
                    <div className="text-sm text-neutral-400 text-center mb-6">{error}</div>
                    <Button onClick={() => setStep('configuring')} variant="outline">
                      Try Again
                    </Button>
                  </div>
                )}
              </div>

              {/* Footer */}
              {(step === 'configuring' || step === 'success') && (
                <div className="p-6 border-t border-neutral-800 bg-black/30">
                  {step === 'configuring' && (
                    <div className="flex gap-3">
                      <Button onClick={closeModal} variant="outline" className="flex-1">
                        Cancel
                      </Button>
                      <Button
                        onClick={handleDeploy}
                        className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 border-0"
                      >
                        <Rocket className="w-4 h-4 mr-2" />
                        Deploy Now
                      </Button>
                    </div>
                  )}
                  {step === 'success' && (
                    <div className="flex gap-3">
                      <Button onClick={closeModal} variant="outline" className="flex-1">
                        Close
                      </Button>
                      <Button
                        onClick={() => window.open('/dashboard', '_blank')}
                        className="flex-1 bg-white text-black hover:bg-neutral-200"
                      >
                        <ExternalLink className="w-4 h-4 mr-2" />
                        View Dashboard
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
