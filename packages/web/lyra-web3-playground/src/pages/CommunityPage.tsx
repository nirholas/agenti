/**
 * ✨ built by nich
 * 🌐 GitHub: github.com/nirholas
 * 💫 Your potential is limitless 🌌
 */

/**
 * CommunityPage.tsx - Community page with real links
 */
import { Link } from 'react-router-dom';
import { useSEO } from '@/hooks/useSEO';
import {
  Github,
  Twitter,
  Users,
  Heart,
  BookOpen,
  Code2,
  ExternalLink,
  MessageSquare,
  GitPullRequest,
  Bug,
  Lightbulb,
  Star
} from 'lucide-react';

interface CommunityChannel {
  name: string;
  description: string;
  icon: React.JSX.Element;
  link: string;
  action: string;
  color: string;
}

const channels: CommunityChannel[] = [
  {
    name: 'GitHub Repository',
    description: 'View source code, report issues, and contribute to the project',
    icon: <Github className="w-8 h-8" />,
    link: 'https://github.com/nirholas/lyra-web3-playground',
    action: 'View Repository',
    color: 'bg-gray-800'
  },
  {
    name: 'GitHub Discussions',
    description: 'Ask questions, share ideas, and connect with other developers',
    icon: <MessageSquare className="w-8 h-8" />,
    link: 'https://github.com/nirholas/lyra-web3-playground/discussions',
    action: 'Join Discussion',
    color: 'bg-purple-600'
  },
  {
    name: 'Twitter / X',
    description: 'Follow for updates, tips, and announcements',
    icon: <Twitter className="w-8 h-8" />,
    link: 'https://x.com/nichxbt',
    action: 'Follow @nichxbt',
    color: 'bg-blue-500'
  }
];

interface ContributionWay {
  icon: React.JSX.Element;
  title: string;
  description: string;
  link: string;
  linkText: string;
}

const contributionWays: ContributionWay[] = [
  {
    icon: <Code2 className="w-8 h-8" />,
    title: 'Contribute Code',
    description: 'Fix bugs, add features, or improve existing functionality',
    link: 'https://github.com/nirholas/lyra-web3-playground/pulls',
    linkText: 'Open a Pull Request'
  },
  {
    icon: <Bug className="w-8 h-8" />,
    title: 'Report Issues',
    description: 'Found a bug? Let us know so we can fix it',
    link: 'https://github.com/nirholas/lyra-web3-playground/issues/new',
    linkText: 'Report an Issue'
  },
  {
    icon: <BookOpen className="w-8 h-8" />,
    title: 'Improve Docs',
    description: 'Help us improve documentation and tutorials',
    link: 'https://github.com/nirholas/lyra-web3-playground',
    linkText: 'Edit Documentation'
  },
  {
    icon: <Lightbulb className="w-8 h-8" />,
    title: 'Suggest Features',
    description: "Have an idea? We'd love to hear it",
    link: 'https://github.com/nirholas/lyra-web3-playground/discussions/categories/ideas',
    linkText: 'Share Your Idea'
  }
];

export default function CommunityPage() {
  useSEO({
    title: 'Community',
    description: 'Join the Lyra Web3 community. Contribute to open source, share projects, get help from fellow developers, and shape the future of blockchain education.',
    path: '/community'
  });

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Hero */}
      <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white py-20">
        <div className="container mx-auto px-4 text-center">
          <Users className="w-16 h-16 mx-auto mb-6" />
          <h1 className="text-4xl md:text-6xl font-black mb-4">
            Join Our Community
          </h1>
          <p className="text-xl text-purple-100 mb-8 max-w-2xl mx-auto">
            Connect with developers learning and building the future of Web3.
            This is an open source project and we welcome all contributions!
          </p>
          
          <div className="flex items-center justify-center space-x-4 flex-wrap gap-4">
            <a
              href="https://github.com/nirholas/lyra-web3-playground"
              target="_blank"
              rel="noopener noreferrer"
              className="px-8 py-4 bg-white text-purple-600 rounded-xl font-bold text-lg hover:bg-gray-100 transition-all shadow-lg"
            >
              <Github className="w-5 h-5 inline mr-2" />
              View on GitHub
            </a>
            <a
              href="https://x.com/nichxbt"
              target="_blank"
              rel="noopener noreferrer"
              className="px-8 py-4 border-2 border-white/50 rounded-xl font-bold text-lg hover:bg-white/10 transition-all"
            >
              <Twitter className="w-5 h-5 inline mr-2" />
              Follow on X
            </a>
          </div>
        </div>
      </div>

      {/* Channels */}
      <div className="container mx-auto px-4 py-16">
        <h2 className="text-3xl font-bold text-center mb-12">Connect With Us</h2>
        
        <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {channels.map((channel, index) => (
            <a
              key={index}
              href={channel.link}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 hover:shadow-xl transition-all group"
            >
              <div className={`${channel.color} w-16 h-16 rounded-xl flex items-center justify-center text-white mb-4 group-hover:scale-110 transition-transform`}>
                {channel.icon}
              </div>
              <h3 className="text-xl font-bold mb-2">{channel.name}</h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
                {channel.description}
              </p>
              <div className="flex items-center space-x-2 text-purple-600 dark:text-purple-400 font-medium">
                <span>{channel.action}</span>
                <ExternalLink className="w-4 h-4" />
              </div>
            </a>
          ))}
        </div>
      </div>

      {/* Ways to Contribute */}
      <div className="bg-gray-100 dark:bg-gray-800/50 py-16">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-4">Ways to Contribute</h2>
          <p className="text-gray-600 dark:text-gray-400 text-center mb-12 max-w-2xl mx-auto">
            Every contribution helps make Web3 education more accessible.
            Here's how you can get involved:
          </p>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
            {contributionWays.map((way, index) => (
              <div
                key={index}
                className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 hover:shadow-xl transition-all"
              >
                <div className="text-purple-600 dark:text-purple-400 mb-4">
                  {way.icon}
                </div>
                <h3 className="text-lg font-bold mb-2">{way.title}</h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
                  {way.description}
                </p>
                <a
                  href={way.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-purple-600 dark:text-purple-400 font-medium text-sm hover:underline inline-flex items-center space-x-1"
                >
                  <span>{way.linkText}</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Creator Section */}
      <div className="py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-2xl mx-auto text-center">
            <div className="text-6xl mb-6">👨‍💻</div>
            <h2 className="text-3xl font-bold mb-4">Created by nich</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              This project is maintained by <a href="https://x.com/nichxbt" target="_blank" rel="noopener noreferrer" className="text-purple-600 hover:underline">@nichxbt</a> with
              contributions from the open source community.
            </p>
            <div className="flex items-center justify-center space-x-4">
              <a
                href="https://github.com/nirholas"
                target="_blank"
                rel="noopener noreferrer"
                className="p-3 bg-gray-900 text-white rounded-full hover:bg-gray-800 transition-all"
                aria-label="GitHub"
              >
                <Github className="w-6 h-6" />
              </a>
              <a
                href="https://x.com/nichxbt"
                target="_blank"
                rel="noopener noreferrer"
                className="p-3 bg-blue-500 text-white rounded-full hover:bg-blue-600 transition-all"
                aria-label="Twitter"
              >
                <Twitter className="w-6 h-6" />
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Contributing Guide CTA */}
      <div className="py-16 bg-gray-100 dark:bg-gray-800/50">
        <div className="container mx-auto px-4">
          <div className="max-w-2xl mx-auto text-center p-12 bg-gradient-to-r from-purple-600 to-pink-600 rounded-2xl text-white">
            <GitPullRequest className="w-12 h-12 mx-auto mb-4" />
            <h2 className="text-3xl font-bold mb-4">Ready to Contribute?</h2>
            <p className="text-purple-100 mb-6">
              Check out our contribution guide to get started
            </p>
            <Link
              to="/contribute"
              className="inline-flex items-center space-x-2 px-6 py-3 bg-white text-purple-600 rounded-lg font-bold hover:bg-gray-100 transition-all"
            >
              <span>Read Contribution Guide</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Star CTA */}
      <div className="py-16">
        <div className="container mx-auto px-4 text-center">
          <Star className="w-12 h-12 mx-auto mb-4 text-yellow-500" />
          <h2 className="text-2xl font-bold mb-4">Support the Project</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md mx-auto">
            If you find this project helpful, consider giving it a star on GitHub!
          </p>
          <a
            href="https://github.com/nirholas/lyra-web3-playground"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center space-x-2 px-6 py-3 bg-gray-900 text-white rounded-lg font-bold hover:bg-gray-800 transition-all"
          >
            <Star className="w-5 h-5" />
            <span>Star on GitHub</span>
          </a>
        </div>
      </div>
    </div>
  );
}
