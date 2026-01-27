/**
 * ✨ built by nich
 * 🌐 GitHub: github.com/nirholas
 * 💫 The journey of a thousand apps begins with a single line 🛤️
 */

import { Shield, Eye, Database, Lock, UserCheck, Globe, Mail, Calendar } from 'lucide-react';
import { useSEO } from '@/hooks/useSEO';

interface ContentBlock {
  subtitle?: string;
  items: string[];
}

interface Section {
  icon: typeof Eye;
  title: string;
  content: ContentBlock[];
}

export default function PrivacyPage() {
  useSEO({
    title: 'Privacy Policy',
    description: 'Lyra Web3 Playground privacy policy. Learn how we protect your data, handle wallet connections, and respect your privacy in our blockchain development platform.',
    path: '/privacy'
  });

  const lastUpdated = 'December 26, 2025';

  const sections: Section[] = [
    {
      icon: Eye,
      title: 'Information We Collect',
      content: [
        {
          subtitle: 'Information You Provide',
          items: [
            'Wallet addresses when you connect to use Web3 features',
            'Code you write in the playground (stored locally in your browser)',
            'Preferences and settings (theme, language) stored in local storage'
          ]
        },
        {
          subtitle: 'Automatically Collected',
          items: [
            'Basic analytics (page views, feature usage) via privacy-respecting analytics',
            'Browser type and version for compatibility',
            'Error logs to improve the platform'
          ]
        }
      ]
    },
    {
      icon: Database,
      title: 'How We Use Your Information',
      content: [
        {
          items: [
            'To provide and maintain the playground functionality',
            'To improve user experience and fix bugs',
            'To communicate updates about the platform (if you opt-in)',
            'To ensure security and prevent abuse'
          ]
        }
      ]
    },
    {
      icon: Lock,
      title: 'Data Security',
      content: [
        {
          items: [
            'All data transmission is encrypted using HTTPS',
            'We do not store your private keys - ever',
            'Wallet connections are handled by your wallet provider (MetaMask, etc.)',
            'Code you write stays in your browser unless you explicitly share it',
            'We use industry-standard security practices'
          ]
        }
      ]
    },
    {
      icon: UserCheck,
      title: 'Your Rights',
      content: [
        {
          items: [
            'Access: Request a copy of any data we have about you',
            'Deletion: Request deletion of your data at any time',
            'Portability: Export your saved code and settings',
            'Opt-out: Disable analytics in your browser settings',
            'Correction: Update any incorrect information'
          ]
        }
      ]
    },
    {
      icon: Globe,
      title: 'Third-Party Services',
      content: [
        {
          subtitle: 'We integrate with:',
          items: [
            'Ethereum and other blockchain networks (for smart contract deployment)',
            'Vercel (hosting)',
            'CDN providers for static assets',
            'Wallet providers (MetaMask, etc.) - governed by their privacy policies'
          ]
        },
        {
          subtitle: 'We do NOT:',
          items: [
            'Sell your data to third parties',
            'Use your data for advertising',
            'Share personal information without consent'
          ]
        }
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white">
        <div className="max-w-4xl mx-auto px-4 py-16">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-white/20 rounded-xl">
              <Shield className="w-8 h-8" />
            </div>
            <h1 className="text-4xl font-bold">Privacy Policy</h1>
          </div>
          <p className="text-xl text-white/80 max-w-2xl">
            Your privacy matters. We're committed to transparency about how we handle your data.
          </p>
          <div className="flex items-center gap-2 mt-4 text-white/60">
            <Calendar className="w-4 h-4" />
            <span>Last updated: {lastUpdated}</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-12">
        {/* Quick Summary */}
        <div className="mb-12 p-6 bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20 border border-green-200 dark:border-green-800 rounded-xl">
          <h2 className="text-xl font-bold mb-4 text-green-800 dark:text-green-200">
            🔒 Privacy at a Glance
          </h2>
          <div className="grid md:grid-cols-3 gap-4 text-sm">
            <div className="flex items-start gap-2">
              <span className="text-green-600">✓</span>
              <span className="text-gray-700 dark:text-gray-300">No account required</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-green-600">✓</span>
              <span className="text-gray-700 dark:text-gray-300">Code stays in your browser</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-green-600">✓</span>
              <span className="text-gray-700 dark:text-gray-300">No private keys stored</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-green-600">✓</span>
              <span className="text-gray-700 dark:text-gray-300">No data selling</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-green-600">✓</span>
              <span className="text-gray-700 dark:text-gray-300">Minimal analytics</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-green-600">✓</span>
              <span className="text-gray-700 dark:text-gray-300">Open source</span>
            </div>
          </div>
        </div>

        {/* Sections */}
        <div className="space-y-8">
          {sections.map((section, index) => (
            <div 
              key={index}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden"
            >
              <div className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                    <section.icon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <h2 className="text-xl font-bold">{section.title}</h2>
                </div>
                
                <div className="space-y-4">
                  {section.content.map((block, blockIndex) => (
                    <div key={blockIndex}>
                      {block.subtitle && (
                        <h3 className="font-semibold text-gray-700 dark:text-gray-300 mb-2">
                          {block.subtitle}
                        </h3>
                      )}
                      <ul className="space-y-2">
                        {block.items.map((item, itemIndex) => (
                          <li 
                            key={itemIndex}
                            className="flex items-start gap-2 text-gray-600 dark:text-gray-400"
                          >
                            <span className="text-blue-500 mt-1">•</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Contact */}
        <div className="mt-12 p-6 bg-gray-100 dark:bg-gray-800 rounded-xl">
          <div className="flex items-start gap-4">
            <Mail className="w-6 h-6 text-blue-600 dark:text-blue-400 mt-1" />
            <div>
              <h3 className="font-bold text-lg mb-2">Questions About Privacy?</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                If you have any questions about this Privacy Policy or how we handle your data, 
                please reach out.
              </p>
              <a 
                href="https://github.com/nirholas/lyra-web3-playground/issues"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                Contact Us on GitHub
              </a>
            </div>
          </div>
        </div>

        {/* Open Source Note */}
        <div className="mt-8 text-center text-sm text-gray-500 dark:text-gray-400">
          <p>
            Lyra Web3 Playground is open source. You can review our code at{' '}
            <a 
              href="https://github.com/nirholas/lyra-web3-playground"
              className="text-blue-600 hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              github.com/nirholas/lyra-web3-playground
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
