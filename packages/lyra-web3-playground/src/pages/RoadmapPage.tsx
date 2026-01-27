/**
 * ✨ built by nich
 * 🌐 GitHub: github.com/nirholas
 * 💫 Building bridges to a better tomorrow 🌉
 */

/**
 * ProjectsPage.tsx - Community Projects and Features
 */
import { Clock, Rocket, Shield, Globe2, Users, Sparkles, CheckCircle2, ArrowRight, Code2, BookOpen, Layers, Wrench, Video, Share2, Cloud, ExternalLink, User, Key, FolderOpen, Link2 } from 'lucide-react';
import { useSEO } from '@/hooks/useSEO';

interface ProjectItem {
  title: string;
  description: string;
  status: 'live' | 'building' | 'planned';
  icon: React.JSX.Element;
  badges?: string[];
}

const projects: ProjectItem[] = [
  // LIVE - Current Features
  {
    title: 'Universal Development Environment',
    description: 'Browser-based UDE with Monaco Editor, live compilation, multi-language support, and testnet deployment.',
    status: 'live',
    icon: <Code2 className="w-5 h-5" />,
    badges: ['Live', 'Web', 'Solidity']
  },
  {
    title: 'Smart Contract Templates',
    description: '40+ production-ready templates for tokens, NFTs, DeFi, DAOs, gaming, and security patterns.',
    status: 'live',
    icon: <Layers className="w-5 h-5" />,
    badges: ['40+ Templates']
  },
  {
    title: 'Tutorial System',
    description: '50+ comprehensive tutorials from beginner to expert covering all aspects of Web3 development.',
    status: 'live',
    icon: <BookOpen className="w-5 h-5" />,
    badges: ['50+ Tutorials']
  },
  {
    title: 'Multi-Chain Support',
    description: 'Deploy to Ethereum, Base, Polygon, Avalanche, BSC, Arbitrum, Solana, and Monad testnets.',
    status: 'live',
    icon: <Globe2 className="w-5 h-5" />,
    badges: ['8 Chains']
  },
  // BUILDING - In Progress
  {
    title: 'Cross-Platform Export',
    description: 'Export projects to CodePen, JSFiddle, GitHub Gist, and more with one click.',
    status: 'building',
    icon: <ExternalLink className="w-5 h-5" />,
    badges: ['CodePen', 'JSFiddle', 'Gist']
  },
  {
    title: 'AI Code Assistant',
    description: 'AI-powered code suggestions, vulnerability detection, and gas optimization recommendations.',
    status: 'building',
    icon: <Sparkles className="w-5 h-5" />,
    badges: ['AI', 'Security']
  },
  {
    title: 'Community Features',
    description: 'Share templates, publish tutorials, and collaborate with other developers.',
    status: 'building',
    icon: <Users className="w-5 h-5" />,
    badges: ['Social', 'Sharing']
  },
  {
    title: 'Mobile Optimization',
    description: 'Improved mobile experience for learning on the go with responsive editor.',
    status: 'building',
    icon: <Wrench className="w-5 h-5" />,
    badges: ['Mobile', 'UX']
  },
  {
    title: 'More Chain Integrations',
    description: 'Support for additional EVM chains and Layer 2 networks based on community demand.',
    status: 'building',
    icon: <Globe2 className="w-5 h-5" />,
    badges: ['L2', 'EVM']
  },
  // PLANNED - Future
  {
    title: 'User Profiles & Privy Auth',
    description: 'Create your profile with Privy login. Email, social, or wallet—your identity, your way.',
    status: 'planned',
    icon: <Key className="w-5 h-5" />,
    badges: ['Privy', 'Web3 Auth', 'Profiles']
  },
  {
    title: 'Project Dashboard',
    description: 'Save, edit, and manage all your projects in one place. Fork, version, and organize your work.',
    status: 'planned',
    icon: <FolderOpen className="w-5 h-5" />,
    badges: ['Save', 'Edit', 'Organize']
  },
  {
    title: 'Share & Collaborate',
    description: 'Share projects via link, invite collaborators, and build together in real-time.',
    status: 'planned',
    icon: <Link2 className="w-5 h-5" />,
    badges: ['Links', 'Teams', 'Real-time']
  },
  {
    title: 'Community Explore',
    description: 'Discover and remix projects from the community. Like, comment, and feature the best creations.',
    status: 'planned',
    icon: <Users className="w-5 h-5" />,
    badges: ['Discover', 'Remix', 'Social']
  },
  {
    title: 'Lyra Hosting',
    description: 'Host your web apps and dApps directly from the UDE. Custom subdomains, SSL, and CDN included.',
    status: 'planned',
    icon: <Cloud className="w-5 h-5" />,
    badges: ['Hosting', 'Deploy', 'CDN']
  },
  {
    title: 'Contract Registry',
    description: 'Deploy and manage smart contracts with a permanent registry. Verified source, ABI hosting, and interaction UI.',
    status: 'planned',
    icon: <Share2 className="w-5 h-5" />,
    badges: ['Contracts', 'Verification']
  },
  {
    title: 'Collaborative Editing',
    description: 'Real-time collaborative code editing for pair programming and team learning.',
    status: 'planned',
    icon: <Users className="w-5 h-5" />,
    badges: ['Multiplayer']
  },
  {
    title: 'On-Chain Deployment Wizard',
    description: 'Guided mainnet deployment with gas estimation, verification, and security checks.',
    status: 'planned',
    icon: <Rocket className="w-5 h-5" />,
    badges: ['Mainnet', 'Verification']
  },
  {
    title: 'Certificate System',
    description: 'Earn verifiable certificates for completing tutorial tracks and skill assessments.',
    status: 'planned',
    icon: <Shield className="w-5 h-5" />,
    badges: ['Credentials']
  },
  {
    title: 'Video Tutorials',
    description: 'Step-by-step video guides integrated with interactive code examples.',
    status: 'planned',
    icon: <Video className="w-5 h-5" />,
    badges: ['Video', 'Learning']
  }
];

const statusStyles: Record<ProjectItem['status'], string> = {
  live: 'from-green-500 to-emerald-500',
  building: 'from-blue-500 to-cyan-500',
  planned: 'from-amber-500 to-orange-500'
};

const statusLabels: Record<ProjectItem['status'], string> = {
  live: 'Live Now',
  building: 'In Progress',
  planned: 'Planned'
};

export default function RoadmapPage() {
  useSEO({
    title: 'Roadmap & Projects',
    description: 'See what we\'re building at Lyra. Live features, current development, and planned updates. Transparent project roadmap for the Web3 community.',
    path: '/projects'
  });

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-16">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <div className="inline-flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-full font-semibold shadow-lg">
            <Rocket className="w-4 h-4" />
            <span>Community Projects</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-black mt-4">What We're Building</h1>
          <p className="text-lg text-gray-600 dark:text-gray-400 mt-4 max-w-3xl mx-auto">
            A transparent view of features that are live, currently in development, and planned for the future.
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {(['live', 'building', 'planned'] as const).map(bucket => (
            <div key={bucket} className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className={`px-6 py-4 bg-gradient-to-r ${statusStyles[bucket]} text-white flex items-center justify-between`}>
                <div className="flex items-center space-x-3">
                  {bucket === 'live' && <CheckCircle2 className="w-5 h-5" />}
                  {bucket === 'building' && <Clock className="w-5 h-5" />}
                  {bucket === 'planned' && <ArrowRight className="w-5 h-5" />}
                  <span className="text-lg font-bold">{statusLabels[bucket]}</span>
                </div>
              </div>

              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {projects.filter(item => item.status === bucket).map(item => (
                  <div key={item.title} className="p-6">
                    <div className="flex items-start space-x-3">
                      <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-purple-600 dark:text-purple-400 flex-shrink-0">
                        {item.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-bold">{item.title}</h3>
                        <p className="text-gray-600 dark:text-gray-300 mt-2 text-sm">{item.description}</p>
                        {item.badges && (
                          <div className="flex flex-wrap gap-2 mt-3">
                            {item.badges.map(badge => (
                              <span key={badge} className="px-3 py-1 text-xs font-semibold rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200">
                                {badge}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Principles Section */}
        <div className="mt-12 max-w-4xl mx-auto bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-8">
          <div className="flex items-center space-x-3 mb-6">
            <Shield className="w-6 h-6 text-green-500" />
            <h2 className="text-2xl font-bold">Our Principles</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-700">
              <h3 className="font-bold mb-2">Education First</h3>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Every feature we build serves our mission of making Web3 accessible to everyone.
              </p>
            </div>
            <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-700">
              <h3 className="font-bold mb-2">Security Focused</h3>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Templates and tutorials emphasize best practices to help developers write safer code.
              </p>
            </div>
            <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-700">
              <h3 className="font-bold mb-2">Community Driven</h3>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Open source at our core with a roadmap shaped by community feedback and contributions.
              </p>
            </div>
          </div>
        </div>

        {/* Feedback CTA */}
        <div className="mt-12 max-w-2xl mx-auto text-center">
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Have a feature request or suggestion? We'd love to hear from you!
          </p>
          <a
            href="https://github.com/nirholas/lyra-web3-playground/issues"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-bold hover:from-purple-700 hover:to-pink-700 transition-all"
          >
            <span>Submit Feedback on GitHub</span>
            <ArrowRight className="w-4 h-4" />
          </a>
        </div>
      </div>
    </div>
  );
}
