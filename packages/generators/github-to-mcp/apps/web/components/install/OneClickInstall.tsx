/**
 * One Click Install Component - Platform-specific installation instructions
 * @copyright 2024-2026 nirholas
 * @license MIT
 */

'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Download,
  Copy,
  Check,
  Terminal,
  Laptop,
  Apple,
  MonitorSmartphone,
  ChevronRight,
  AlertCircle,
  Info,
  ExternalLink,
  Play,
  Zap,
  Package,
  Settings,
  Shield,
  RefreshCw,
} from 'lucide-react';
import type { 
  InstallPlatform, 
  InstallInstructions, 
  InstallStep,
  PlatformDetection,
  ConversionResult,
} from '@/types';

interface OneClickInstallProps {
  result: ConversionResult;
  serverName?: string;
  onInstallStart?: () => void;
}

const PLATFORM_ICONS: Record<InstallPlatform, typeof Laptop> = {
  'macos': Apple,
  'windows': MonitorSmartphone,
  'linux': Terminal,
  'docker': Package,
};

const PLATFORM_NAMES: Record<InstallPlatform, string> = {
  'macos': 'macOS',
  'windows': 'Windows',
  'linux': 'Linux',
  'docker': 'Docker',
};

const PLATFORM_COLORS: Record<InstallPlatform, string> = {
  'macos': 'from-gray-500/20 to-gray-600/10',
  'windows': 'from-blue-500/20 to-blue-600/10',
  'linux': 'from-orange-500/20 to-orange-600/10',
  'docker': 'from-cyan-500/20 to-cyan-600/10',
};

export default function OneClickInstall({
  result,
  serverName = 'mcp-server',
  onInstallStart,
}: OneClickInstallProps) {
  const [detectedPlatform, setDetectedPlatform] = useState<PlatformDetection | null>(null);
  const [selectedPlatform, setSelectedPlatform] = useState<InstallPlatform>('macos');
  const [currentStep, setCurrentStep] = useState(0);
  const [copiedCommand, setCopiedCommand] = useState<string | null>(null);
  const [expandedStep, setExpandedStep] = useState<number | null>(0);
  const [isDetecting, setIsDetecting] = useState(true);

  const sanitizedServerName = useMemo(() =>
    serverName.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/--+/g, '-'),
    [serverName]
  );

  // Detect platform on mount
  useEffect(() => {
    const detectPlatform = async () => {
      setIsDetecting(true);
      
      try {
        // Check navigator.userAgent
        const ua = navigator.userAgent.toLowerCase();
        let os: InstallPlatform = 'linux';
        
        if (ua.includes('mac')) {
          os = 'macos';
        } else if (ua.includes('win')) {
          os = 'windows';
        } else if (ua.includes('linux')) {
          os = 'linux';
        }

        // Check for Node.js (via API endpoint if available)
        let nodeVersion: string | undefined;
        let npmVersion: string | undefined;
        let hasDocker = false;
        let hasPython = false;

        // Simulate detection (in real app, would hit an API)
        const detection: PlatformDetection = {
          os,
          arch: navigator.userAgent.includes('arm') || navigator.userAgent.includes('ARM') 
            ? 'arm64' 
            : 'x64',
          nodeVersion: '20.x', // Assume modern versions
          npmVersion: '10.x',
          hasDocker: true,
          hasPython: true,
          pythonVersion: '3.11',
        };

        setDetectedPlatform(detection);
        setSelectedPlatform(os);
      } catch (error) {
        console.error('Platform detection failed:', error);
        setDetectedPlatform({ os: 'linux', arch: 'x64' });
        setSelectedPlatform('linux');
      } finally {
        setIsDetecting(false);
      }
    };

    detectPlatform();
  }, []);

  // Generate instructions for each platform
  const instructions: Record<InstallPlatform, InstallInstructions> = useMemo(() => {
    const repoUrl = result.repository.url;
    const repoName = result.repository.name;
    
    return {
      macos: {
        platform: 'macos',
        title: 'Install on macOS',
        description: 'One-click installation using Homebrew or direct download',
        prerequisites: [
          'macOS 12 or later',
          'Node.js 18+ or Python 3.9+',
          'Homebrew (recommended)',
        ],
        steps: [
          {
            title: 'Install with npx (Recommended)',
            description: 'Run the MCP server directly without installation',
            command: `npx @github-to-mcp/${sanitizedServerName}`,
            isOptional: false,
          },
          {
            title: 'Or install globally',
            description: 'Install the server for persistent use',
            command: `npm install -g @github-to-mcp/${sanitizedServerName}`,
            isOptional: true,
          },
          {
            title: 'Configure Claude Desktop',
            description: 'Add to your Claude configuration',
            command: `# Add to ~/Library/Application Support/Claude/claude_desktop_config.json
{
  "mcpServers": {
    "${sanitizedServerName}": {
      "command": "npx",
      "args": ["@github-to-mcp/${sanitizedServerName}"]
    }
  }
}`,
            isOptional: false,
          },
          {
            title: 'Restart Claude Desktop',
            description: 'Restart to apply changes',
            command: 'killall Claude && open -a Claude',
            isOptional: false,
          },
        ],
        estimatedTime: '2 minutes',
      },
      windows: {
        platform: 'windows',
        title: 'Install on Windows',
        description: 'Installation via npm or chocolatey',
        prerequisites: [
          'Windows 10/11',
          'Node.js 18+ (LTS)',
          'PowerShell or Windows Terminal',
        ],
        steps: [
          {
            title: 'Install with npx (Recommended)',
            description: 'Run the MCP server directly',
            command: `npx @github-to-mcp/${sanitizedServerName}`,
            isOptional: false,
          },
          {
            title: 'Or install globally',
            description: 'Install for persistent use',
            command: `npm install -g @github-to-mcp/${sanitizedServerName}`,
            isOptional: true,
          },
          {
            title: 'Configure Claude Desktop',
            description: 'Add to your Claude configuration',
            command: `# Add to %APPDATA%\\Claude\\claude_desktop_config.json
{
  "mcpServers": {
    "${sanitizedServerName}": {
      "command": "npx",
      "args": ["@github-to-mcp/${sanitizedServerName}"]
    }
  }
}`,
            isOptional: false,
          },
          {
            title: 'Restart Claude Desktop',
            description: 'Restart to apply changes',
            command: 'taskkill /IM Claude.exe /F && start Claude',
            isOptional: false,
          },
        ],
        estimatedTime: '3 minutes',
      },
      linux: {
        platform: 'linux',
        title: 'Install on Linux',
        description: 'Installation via npm or direct clone',
        prerequisites: [
          'Ubuntu 20.04+, Debian, Fedora, or similar',
          'Node.js 18+ or Python 3.9+',
          'Terminal access',
        ],
        steps: [
          {
            title: 'Install with npx (Recommended)',
            description: 'Run the MCP server directly',
            command: `npx @github-to-mcp/${sanitizedServerName}`,
            isOptional: false,
          },
          {
            title: 'Or clone and build from source',
            description: 'For development or customization',
            command: `git clone ${repoUrl}
cd ${repoName}
npm install
npm run build`,
            isOptional: true,
          },
          {
            title: 'Configure Claude Desktop',
            description: 'Add to your Claude configuration',
            command: `# Add to ~/.config/Claude/claude_desktop_config.json
{
  "mcpServers": {
    "${sanitizedServerName}": {
      "command": "npx",
      "args": ["@github-to-mcp/${sanitizedServerName}"]
    }
  }
}`,
            isOptional: false,
          },
          {
            title: 'Run as systemd service (optional)',
            description: 'For persistent background operation',
            command: `# Create service file
sudo tee /etc/systemd/system/${sanitizedServerName}.service << EOF
[Unit]
Description=${sanitizedServerName} MCP Server
After=network.target

[Service]
Type=simple
User=$USER
ExecStart=/usr/bin/npx @github-to-mcp/${sanitizedServerName}
Restart=on-failure

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable ${sanitizedServerName}
sudo systemctl start ${sanitizedServerName}`,
            isOptional: true,
          },
        ],
        estimatedTime: '3 minutes',
      },
      docker: {
        platform: 'docker',
        title: 'Run with Docker',
        description: 'Containerized deployment for isolation',
        prerequisites: [
          'Docker 20.10+',
          'Docker Compose (optional)',
        ],
        steps: [
          {
            title: 'Pull and run container',
            description: 'One-command deployment',
            command: `docker run -d --name ${sanitizedServerName} \\
  -p 3000:3000 \\
  ghcr.io/github-to-mcp/${sanitizedServerName}:latest`,
            isOptional: false,
          },
          {
            title: 'Or build from Dockerfile',
            description: 'Build locally with customizations',
            command: `# Using the exported Dockerfile
docker build -t ${sanitizedServerName}:latest .
docker run -d --name ${sanitizedServerName} -p 3000:3000 ${sanitizedServerName}:latest`,
            isOptional: true,
          },
          {
            title: 'Using Docker Compose',
            description: 'For multi-service setups',
            command: `# Using the exported docker-compose.yml
docker-compose up -d`,
            isOptional: true,
          },
          {
            title: 'Configure Claude for Docker',
            description: 'Point Claude to containerized server',
            command: `{
  "mcpServers": {
    "${sanitizedServerName}": {
      "command": "docker",
      "args": ["exec", "-i", "${sanitizedServerName}", "node", "dist/index.js"]
    }
  }
}`,
            isOptional: false,
          },
        ],
        estimatedTime: '2 minutes',
      },
    };
  }, [result, sanitizedServerName]);

  const currentInstructions = instructions[selectedPlatform];

  const copyToClipboard = useCallback(async (text: string, stepIndex: number) => {
    // Strip comments from command before copying
    const cleanCommand = text.split('\n')
      .filter(line => !line.trim().startsWith('#'))
      .join('\n')
      .trim();
    
    await navigator.clipboard.writeText(cleanCommand);
    setCopiedCommand(`${selectedPlatform}-${stepIndex}`);
    setTimeout(() => setCopiedCommand(null), 2000);
  }, [selectedPlatform]);

  const handleStartInstall = useCallback(() => {
    setCurrentStep(0);
    setExpandedStep(0);
    onInstallStart?.();
  }, [onInstallStart]);

  const markStepComplete = useCallback((stepIndex: number) => {
    setCurrentStep(prev => Math.max(prev, stepIndex + 1));
    setExpandedStep(stepIndex + 1);
  }, []);

  const PlatformIcon = PLATFORM_ICONS[selectedPlatform];

  return (
    <div className="space-y-6">
      {/* Header with platform detection */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-xl border border-neutral-800 bg-neutral-900/50 backdrop-blur-xl overflow-hidden"
      >
        <div className={`p-6 bg-gradient-to-br ${PLATFORM_COLORS[selectedPlatform]}`}>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center">
                <PlatformIcon className="w-7 h-7 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-white">
                  {currentInstructions.title}
                </h2>
                <p className="text-sm text-neutral-300 mt-1">
                  {currentInstructions.description}
                </p>
                <div className="flex items-center gap-4 mt-2 text-xs text-neutral-400">
                  <span className="flex items-center gap-1">
                    <Zap className="w-3 h-3" />
                    {currentInstructions.estimatedTime}
                  </span>
                  <span className="flex items-center gap-1">
                    <Package className="w-3 h-3" />
                    {result.tools.length} tools
                  </span>
                </div>
              </div>
            </div>

            {isDetecting ? (
              <div className="flex items-center gap-2 text-sm text-neutral-400">
                <RefreshCw className="w-4 h-4 animate-spin" />
                Detecting...
              </div>
            ) : detectedPlatform && (
              <div className="text-right text-sm">
                <div className="text-neutral-400">Detected System</div>
                <div className="text-white font-medium">
                  {PLATFORM_NAMES[detectedPlatform.os]} {detectedPlatform.arch}
                </div>
                {detectedPlatform.nodeVersion && (
                  <div className="text-xs text-neutral-500">
                    Node.js {detectedPlatform.nodeVersion}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Platform tabs */}
        <div className="p-3 border-t border-neutral-800 flex gap-2 overflow-x-auto">
          {(Object.keys(instructions) as InstallPlatform[]).map((platform) => {
            const Icon = PLATFORM_ICONS[platform];
            const isSelected = selectedPlatform === platform;
            const isDetected = detectedPlatform?.os === platform;
            
            return (
              <button
                key={platform}
                onClick={() => {
                  setSelectedPlatform(platform);
                  setCurrentStep(0);
                  setExpandedStep(0);
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                  isSelected
                    ? 'bg-white text-black'
                    : 'text-neutral-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon className="w-4 h-4" />
                {PLATFORM_NAMES[platform]}
                {isDetected && !isSelected && (
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                )}
              </button>
            );
          })}
        </div>
      </motion.div>

      {/* Prerequisites */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="rounded-xl border border-neutral-800 bg-neutral-900/50 backdrop-blur-xl p-4"
      >
        <div className="flex items-center gap-2 mb-3">
          <Settings className="w-4 h-4 text-neutral-400" />
          <span className="text-sm font-medium text-white">Prerequisites</span>
        </div>
        <ul className="space-y-2">
          {currentInstructions.prerequisites.map((prereq, index) => (
            <motion.li
              key={index}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className="flex items-center gap-2 text-sm text-neutral-400"
            >
              <Check className="w-4 h-4 text-green-400 flex-shrink-0" />
              {prereq}
            </motion.li>
          ))}
        </ul>
      </motion.div>

      {/* Installation steps */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="space-y-3"
      >
        {currentInstructions.steps.map((step, index) => {
          const isComplete = index < currentStep;
          const isActive = index === currentStep;
          const isExpanded = expandedStep === index;
          
          return (
            <motion.div
              key={`${selectedPlatform}-${index}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className={`rounded-xl border overflow-hidden ${
                isComplete
                  ? 'border-green-500/30 bg-green-500/5'
                  : isActive
                  ? 'border-white/30 bg-white/5'
                  : 'border-neutral-800 bg-neutral-900/50'
              }`}
            >
              <button
                onClick={() => setExpandedStep(isExpanded ? null : index)}
                className="w-full p-4 flex items-center gap-4 text-left"
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  isComplete
                    ? 'bg-green-500 text-white'
                    : isActive
                    ? 'bg-white text-black'
                    : 'bg-white/10 text-neutral-400'
                }`}>
                  {isComplete ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <span className="text-sm font-medium">{index + 1}</span>
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`font-medium ${isComplete || isActive ? 'text-white' : 'text-neutral-300'}`}>
                      {step.title}
                    </span>
                    {step.isOptional && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-neutral-400">
                        Optional
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-neutral-500 truncate">{step.description}</p>
                </div>

                <ChevronRight className={`w-5 h-5 text-neutral-500 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
              </button>

              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="border-t border-neutral-800"
                  >
                    <div className="p-4 space-y-3">
                      <div className="relative">
                        <pre className="p-4 pr-12 rounded-lg bg-black border border-neutral-800 overflow-x-auto text-sm font-mono text-green-400">
                          <code>{step.command}</code>
                        </pre>
                        <button
                          onClick={() => copyToClipboard(step.command, index)}
                          className="absolute top-3 right-3 p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                          title="Copy command"
                        >
                          {copiedCommand === `${selectedPlatform}-${index}` ? (
                            <Check className="w-4 h-4 text-green-400" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </button>
                      </div>

                      {step.warning && (
                        <div className="flex items-start gap-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                          <AlertCircle className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
                          <p className="text-sm text-yellow-200">{step.warning}</p>
                        </div>
                      )}

                      {step.note && (
                        <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                          <Info className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                          <p className="text-sm text-blue-200">{step.note}</p>
                        </div>
                      )}

                      {step.link && (
                        <a
                          href={step.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-sm text-white hover:underline"
                        >
                          Learn more
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}

                      {!isComplete && (
                        <button
                          onClick={() => markStepComplete(index)}
                          className="flex items-center gap-2 px-4 py-2 bg-white text-black rounded-lg text-sm font-medium hover:bg-neutral-200 transition-colors"
                        >
                          <Check className="w-4 h-4" />
                          Mark as Complete
                        </button>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </motion.div>

      {/* Completion state */}
      <AnimatePresence>
        {currentStep >= currentInstructions.steps.filter(s => !s.isOptional).length && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="rounded-xl border border-green-500/30 bg-green-500/10 p-6 text-center"
          >
            <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-green-400" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">Installation Complete!</h3>
            <p className="text-neutral-400 mb-4">
              Your MCP server is now configured and ready to use with Claude Desktop.
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => window.open('claude://open', '_blank')}
                className="flex items-center gap-2 px-4 py-2 bg-white text-black rounded-lg font-medium hover:bg-neutral-200 transition-colors"
              >
                <Play className="w-4 h-4" />
                Open Claude
              </button>
              <button
                onClick={handleStartInstall}
                className="flex items-center gap-2 px-4 py-2 bg-white/10 text-white rounded-lg font-medium hover:bg-white/20 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Start Over
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Help section */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="flex items-center justify-center gap-6 text-sm text-neutral-500"
      >
        <a href="#" className="flex items-center gap-1 hover:text-white transition-colors">
          <Shield className="w-4 h-4" />
          Security Guide
        </a>
        <a href="#" className="flex items-center gap-1 hover:text-white transition-colors">
          <AlertCircle className="w-4 h-4" />
          Troubleshooting
        </a>
        <a href="#" className="flex items-center gap-1 hover:text-white transition-colors">
          <ExternalLink className="w-4 h-4" />
          Documentation
        </a>
      </motion.div>
    </div>
  );
}
