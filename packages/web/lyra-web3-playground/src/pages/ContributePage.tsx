/**
 * ✨ built by nich
 * 🌐 GitHub: github.com/nirholas
 * 💫 Creating connections through code 🔗
 */

import { 
  GitBranch, 
  Code2, 
  BookOpen, 
  Bug, 
  Lightbulb, 
  Heart, 
  CheckCircle, 
  ArrowRight,
  Github,
  MessageSquare,
  Zap,
  Users,
  Star,
  GitPullRequest
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useSEO } from '@/hooks/useSEO';

export default function ContributePage() {
  useSEO({
    title: 'Contribute',
    description: 'Join the Lyra open source community. Contribute code, documentation, tutorials, or translations. Every contribution makes a difference.',
    path: '/contribute'
  });

  const contributionTypes = [
    {
      icon: Code2,
      title: 'Code Contributions',
      description: 'Help improve the platform by fixing bugs, adding features, or optimizing performance.',
      color: 'blue',
      examples: [
        'Fix TypeScript errors or warnings',
        'Add new example components',
        'Improve the Solidity compiler integration',
        'Enhance the Monaco editor experience'
      ]
    },
    {
      icon: BookOpen,
      title: 'Documentation',
      description: 'Help make Lyra more accessible by improving docs, tutorials, and guides.',
      color: 'green',
      examples: [
        'Write new tutorials for beginners',
        'Improve existing documentation',
        'Add code comments and JSDoc',
        'Create video walkthroughs'
      ]
    },
    {
      icon: Bug,
      title: 'Bug Reports',
      description: 'Found something broken? Help us fix it by reporting detailed bug reports.',
      color: 'red',
      examples: [
        'Describe the expected vs actual behavior',
        'Include browser and OS information',
        'Provide steps to reproduce',
        'Share screenshots or recordings'
      ]
    },
    {
      icon: Lightbulb,
      title: 'Feature Ideas',
      description: 'Have ideas for new features? We\'d love to hear your suggestions!',
      color: 'yellow',
      examples: [
        'New smart contract templates',
        'Additional blockchain network support',
        'UI/UX improvements',
        'Learning path suggestions'
      ]
    }
  ];

  const getStartedSteps = [
    {
      step: 1,
      title: 'Fork the Repository',
      description: 'Create your own fork of the nirholas/lyra-web3-playground repository on GitHub.',
      code: 'gh repo fork nirholas/lyra-web3-playground --clone'
    },
    {
      step: 2,
      title: 'Install Dependencies',
      description: 'Navigate to the project and install all required dependencies.',
      code: 'cd play && npm install'
    },
    {
      step: 3,
      title: 'Start Development Server',
      description: 'Run the development server to see your changes live.',
      code: 'npm run dev'
    },
    {
      step: 4,
      title: 'Make Your Changes',
      description: 'Create a new branch and implement your feature or fix.',
      code: 'git checkout -b feature/my-awesome-feature'
    },
    {
      step: 5,
      title: 'Submit a Pull Request',
      description: 'Push your changes and open a PR for review.',
      code: 'git push origin feature/my-awesome-feature'
    }
  ];

  const guidelines = [
    'Follow the existing code style and patterns',
    'Write clear, descriptive commit messages',
    'Add tests for new features when applicable',
    'Update documentation for any changed functionality',
    'Keep PRs focused on a single change',
    'Be respectful and constructive in discussions'
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Hero */}
      <div className="bg-gradient-to-r from-green-600 via-teal-600 to-blue-600 text-white">
        <div className="max-w-6xl mx-auto px-4 py-16">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-white/20 rounded-xl">
              <Heart className="w-8 h-8" />
            </div>
            <h1 className="text-4xl font-bold">Contribute to Lyra</h1>
          </div>
          <p className="text-xl text-white/80 max-w-2xl mb-8">
            Lyra Web3 Playground is open source and community-driven. 
            Every contribution, big or small, helps make blockchain development more accessible.
          </p>
          
          <div className="flex flex-wrap gap-4">
            <a
              href="https://github.com/nirholas/lyra-web3-playground"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 bg-white text-gray-900 font-semibold rounded-lg hover:bg-gray-100 transition-colors"
            >
              <Github className="w-5 h-5" />
              View on GitHub
            </a>
            <a
              href="https://github.com/nirholas/lyra-web3-playground/issues"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 bg-white/20 text-white font-semibold rounded-lg hover:bg-white/30 transition-colors"
            >
              <Bug className="w-5 h-5" />
              View Issues
            </a>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-12">
            <div className="bg-white/10 rounded-xl p-4 text-center">
              <Star className="w-6 h-6 mx-auto mb-2 text-yellow-300" />
              <div className="text-2xl font-bold">Open Source</div>
              <div className="text-sm text-white/60">MIT License</div>
            </div>
            <div className="bg-white/10 rounded-xl p-4 text-center">
              <Users className="w-6 h-6 mx-auto mb-2 text-blue-300" />
              <div className="text-2xl font-bold">Community</div>
              <div className="text-sm text-white/60">Driven</div>
            </div>
            <div className="bg-white/10 rounded-xl p-4 text-center">
              <GitPullRequest className="w-6 h-6 mx-auto mb-2 text-green-300" />
              <div className="text-2xl font-bold">PRs Welcome</div>
              <div className="text-sm text-white/60">All skill levels</div>
            </div>
            <div className="bg-white/10 rounded-xl p-4 text-center">
              <MessageSquare className="w-6 h-6 mx-auto mb-2 text-purple-300" />
              <div className="text-2xl font-bold">Friendly</div>
              <div className="text-sm text-white/60">Community</div>
            </div>
          </div>
        </div>
      </div>

      {/* Ways to Contribute */}
      <div className="max-w-6xl mx-auto px-4 py-16">
        <h2 className="text-3xl font-bold text-center mb-4">Ways to Contribute</h2>
        <p className="text-center text-gray-600 dark:text-gray-400 mb-12 max-w-2xl mx-auto">
          There are many ways to contribute, and you don't need to be an expert to help!
        </p>

        <div className="grid md:grid-cols-2 gap-6">
          {contributionTypes.map((type, index) => (
            <div 
              key={index}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 hover:shadow-lg transition-shadow"
            >
              <div className={`inline-flex p-3 rounded-xl mb-4 ${
                type.color === 'blue' ? 'bg-blue-100 dark:bg-blue-900/30' :
                type.color === 'green' ? 'bg-green-100 dark:bg-green-900/30' :
                type.color === 'red' ? 'bg-red-100 dark:bg-red-900/30' :
                'bg-yellow-100 dark:bg-yellow-900/30'
              }`}>
                <type.icon className={`w-6 h-6 ${
                  type.color === 'blue' ? 'text-blue-600 dark:text-blue-400' :
                  type.color === 'green' ? 'text-green-600 dark:text-green-400' :
                  type.color === 'red' ? 'text-red-600 dark:text-red-400' :
                  'text-yellow-600 dark:text-yellow-400'
                }`} />
              </div>
              
              <h3 className="text-xl font-bold mb-2">{type.title}</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">{type.description}</p>
              
              <div className="space-y-2">
                {type.examples.map((example, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span>{example}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Getting Started */}
      <div className="bg-gray-100 dark:bg-gray-800/50 py-16">
        <div className="max-w-4xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-4">Getting Started</h2>
          <p className="text-center text-gray-600 dark:text-gray-400 mb-12">
            Follow these steps to set up your development environment
          </p>

          <div className="space-y-6">
            {getStartedSteps.map((step) => (
              <div 
                key={step.step}
                className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6"
              >
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-r from-green-500 to-teal-500 rounded-full flex items-center justify-center text-white font-bold">
                    {step.step}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-bold mb-1">{step.title}</h3>
                    <p className="text-gray-600 dark:text-gray-400 mb-3">{step.description}</p>
                    <pre className="bg-gray-900 text-green-400 p-3 rounded-lg text-sm overflow-x-auto">
                      <code>{step.code}</code>
                    </pre>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Guidelines */}
      <div className="max-w-4xl mx-auto px-4 py-16">
        <h2 className="text-3xl font-bold text-center mb-4">Contribution Guidelines</h2>
        <p className="text-center text-gray-600 dark:text-gray-400 mb-12">
          Please follow these guidelines to ensure smooth collaboration
        </p>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-8">
          <div className="grid md:grid-cols-2 gap-4">
            {guidelines.map((guideline, index) => (
              <div key={index} className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                <span className="text-gray-700 dark:text-gray-300">{guideline}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="bg-gradient-to-r from-green-600 to-teal-600 text-white py-16">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <Zap className="w-12 h-12 mx-auto mb-4" />
          <h2 className="text-3xl font-bold mb-4">Ready to Contribute?</h2>
          <p className="text-xl text-white/80 mb-8 max-w-2xl mx-auto">
            Your contributions help make blockchain development accessible to everyone. 
            Let's build something amazing together!
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <a
              href="https://github.com/nirholas/lyra-web3-playground/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 bg-white text-gray-900 font-semibold rounded-lg hover:bg-gray-100 transition-colors"
            >
              <GitBranch className="w-5 h-5" />
              Good First Issues
              <ArrowRight className="w-4 h-4" />
            </a>
            <Link
              to="/community"
              className="inline-flex items-center gap-2 px-6 py-3 bg-white/20 text-white font-semibold rounded-lg hover:bg-white/30 transition-colors"
            >
              <Users className="w-5 h-5" />
              Join the Community
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
