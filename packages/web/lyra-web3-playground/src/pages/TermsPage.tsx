/**
 * ✨ built by nich
 * 🌐 GitHub: github.com/nirholas
 * 💫 Code is poetry written for machines 📝
 */

import { FileText, Scale, AlertTriangle, Gavel, Users, Zap, Globe, Calendar, CheckCircle, Shield, Ban, Coins } from 'lucide-react';
import { useSEO } from '@/hooks/useSEO';

export default function TermsPage() {
  useSEO({
    title: 'Terms of Service',
    description: 'Lyra Web3 Playground terms of service. Understand your rights and responsibilities when using our blockchain development and smart contract learning platform.',
    path: '/terms'
  });

  const lastUpdated = 'December 28, 2025';

  const sections = [
    {
      icon: CheckCircle,
      title: '1. Acceptance of Terms',
      content: `By accessing and using Lyra Web3 Playground ("the Platform"), you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the Platform.

The Platform is designed for educational purposes and to help developers learn blockchain development. It is provided as-is for learning and experimentation.

YOU MUST BE AT LEAST 18 YEARS OLD OR HAVE PARENTAL CONSENT TO USE THIS PLATFORM.`
    },
    {
      icon: Zap,
      title: '2. Description of Service',
      content: `Lyra Web3 Playground provides:

• Interactive code editors for writing and testing smart contracts
• Educational examples and tutorials for blockchain development  
• Tools to compile and deploy contracts to test networks
• AI-generated code suggestions (experimental, unverified)
• A sandbox environment for experimenting with Web3 technologies

The Platform is free to use, open source, and provided as a hobby project with no commercial purpose. There is no guarantee of availability, accuracy, or fitness for any purpose.`
    },
    {
      icon: Users,
      title: '3. User Responsibilities',
      content: `When using the Platform, you agree to:

• Use the Platform only for lawful purposes
• Not deploy malicious or harmful smart contracts
• Not attempt to exploit, hack, or compromise the Platform
• Take FULL responsibility for any contracts you deploy to blockchain networks
• Understand that blockchain transactions are IRREVERSIBLE
• Keep your wallet credentials secure (we never ask for private keys)
• Not use the Platform for any illegal activities
• Independently verify and audit ALL code before production use
• Not rely on this Platform for financial, investment, or legal decisions`
    },
    {
      icon: AlertTriangle,
      title: '4. Disclaimer of Warranties',
      content: `THE PLATFORM IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.

SPECIFIC DISCLAIMERS:
• Code examples are for EDUCATIONAL PURPOSES ONLY and are NOT production-ready
• AI-generated code is experimental and may contain bugs or vulnerabilities
• Smart contract templates are NOT audited and may have security flaws
• We do not guarantee the security, accuracy, or correctness of any code
• Blockchain networks may experience downtime, congestion, or failures
• Transaction fees (gas) are determined by the network, not by us
• Third-party services may fail or become unavailable at any time

You acknowledge that blockchain development carries SIGNIFICANT INHERENT RISKS and you use the Platform ENTIRELY AT YOUR OWN RISK.`
    },
    {
      icon: Coins,
      title: '5. No Financial or Investment Advice',
      content: `NOTHING ON THIS PLATFORM CONSTITUTES FINANCIAL, INVESTMENT, LEGAL, OR TAX ADVICE.

• We are not financial advisors, lawyers, or licensed professionals
• Any information about tokens, DeFi, or blockchain is educational only
• You should consult qualified professionals before making financial decisions
• Past performance of any code or contract does not guarantee future results
• Cryptocurrency and DeFi involve substantial risk of loss

DO NOT make financial decisions based on information from this Platform.`
    },
    {
      icon: Scale,
      title: '6. Limitation of Liability',
      content: `TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, LYRA WEB3 PLAYGROUND, ITS CREATORS, CONTRIBUTORS, AND MAINTAINERS SHALL NOT BE LIABLE FOR:

• Any loss of cryptocurrency, tokens, or digital assets
• Any loss of profits, revenue, data, or business opportunities
• Failed, incorrect, or exploited smart contract deployments
• Any damages arising from the use of code from the Platform
• Network fees, gas costs, or failed transactions
• Third-party wallet, blockchain network, or API issues
• Security breaches, hacks, or vulnerabilities in user-deployed code
• Any direct, indirect, incidental, special, consequential, or punitive damages
• Any damages whatsoever, even if advised of the possibility of such damages

THE TOTAL LIABILITY OF THE PROJECT AND ITS CREATORS SHALL NOT EXCEED $0 (ZERO DOLLARS) UNDER ANY CIRCUMSTANCES.

You are SOLELY RESPONSIBLE for reviewing, testing, and auditing any code before deployment.`
    },
    {
      icon: Shield,
      title: '7. Indemnification',
      content: `You agree to indemnify, defend, and hold harmless Lyra Web3 Playground, its creators, contributors, maintainers, and affiliates from and against any and all claims, damages, losses, costs, and expenses (including reasonable attorneys' fees) arising from:

• Your use or misuse of the Platform
• Your violation of these Terms
• Your violation of any third-party rights
• Smart contracts you deploy using code from this Platform
• Any claims brought by third parties related to your use of the Platform`
    },
    {
      icon: Ban,
      title: '8. Prohibited Uses',
      content: `You may NOT use this Platform for:

• Money laundering or terrorist financing
• Fraud, scams, or deceptive practices
• Creating malicious or exploitative smart contracts
• Any activity that violates applicable laws or regulations
• Circumventing security measures or access restrictions
• Impersonating others or misrepresenting affiliations
• Any activity that could harm users of blockchain networks`
    },
    {
      icon: Globe,
      title: '9. Intellectual Property',
      content: `• The Platform's source code is open source under the MIT License
• Code examples and tutorials may be used freely for learning
• You retain ownership of any original code you create
• Third-party libraries are subject to their respective licenses
• The "Lyra" name and branding are property of the project maintainers
• AI-generated code has no guaranteed intellectual property status`
    },
    {
      icon: Gavel,
      title: '10. Modifications & Termination',
      content: `We reserve the right to:

• Modify these Terms of Service at any time without notice
• Modify, suspend, or discontinue the Platform at any time
• Restrict access to the Platform for any reason

Changes will be effective immediately upon posting to the Platform. Your continued use of the Platform after changes constitutes acceptance of the modified terms.

We encourage you to review these terms periodically.`
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white">
        <div className="max-w-4xl mx-auto px-4 py-16">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-white/20 rounded-xl">
              <FileText className="w-8 h-8" />
            </div>
            <h1 className="text-4xl font-bold">Terms of Service</h1>
          </div>
          <p className="text-xl text-white/80 max-w-2xl">
            Please read these terms carefully before using Lyra Web3 Playground.
          </p>
          <div className="flex items-center gap-2 mt-4 text-white/60">
            <Calendar className="w-4 h-4" />
            <span>Last updated: {lastUpdated}</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-12">
        {/* Important Notice */}
        <div className="mb-12 p-6 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
          <div className="flex items-start gap-4">
            <AlertTriangle className="w-6 h-6 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-1" />
            <div>
              <h2 className="text-lg font-bold text-amber-800 dark:text-amber-200 mb-2">
                Important: Educational Purpose Only
              </h2>
              <p className="text-amber-700 dark:text-amber-300">
                This platform is designed for learning and experimentation. Smart contracts 
                deployed through this platform should be thoroughly tested and audited before 
                any production use. Always use testnets for learning and never deploy untested 
                code to mainnet with real funds.
              </p>
            </div>
          </div>
        </div>

        {/* Sections */}
        <div className="space-y-6">
          {sections.map((section, index) => (
            <div 
              key={index}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden"
            >
              <div className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                    <section.icon className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <h2 className="text-xl font-bold">{section.title}</h2>
                </div>
                
                <div className="text-gray-600 dark:text-gray-400 whitespace-pre-line leading-relaxed">
                  {section.content}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Agreement */}
        <div className="mt-12 p-6 bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 border border-purple-200 dark:border-purple-800 rounded-xl text-center">
          <h3 className="font-bold text-lg mb-2">By Using This Platform</h3>
          <p className="text-gray-600 dark:text-gray-400">
            You acknowledge that you have read, understood, and agree to be bound by these Terms of Service.
          </p>
        </div>

        {/* Contact */}
        <div className="mt-8 text-center">
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            Questions about these terms? Open an issue on GitHub.
          </p>
          <a 
            href="https://github.com/nirholas/lyra-web3-playground/issues"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
          >
            <Globe className="w-4 h-4" />
            Contact on GitHub
          </a>
        </div>
      </div>
    </div>
  );
}
