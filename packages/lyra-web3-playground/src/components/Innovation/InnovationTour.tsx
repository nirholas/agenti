/**
 * ✨ built by nich
 * 🌐 GitHub: github.com/nirholas
 * 💫 Your creativity knows no bounds 🎨
 */

import { useState } from 'react';
import { X, ArrowRight, ArrowLeft, Sparkles, Rocket } from 'lucide-react';
import { Link } from 'react-router-dom';

interface TourStep {
  title: string;
  description: string;
  feature: string;
  emoji: string;
  gradient: string;
  preview: string;
}

export default function InnovationTour({ onClose }: { onClose: () => void }) {
  const [currentStep, setCurrentStep] = useState(0);

  const steps: TourStep[] = [
    {
      title: 'Welcome to Innovation Mode!',
      description: 'Experience the future of Web3 development with AI-powered tools that make learning smart contracts feel like magic.',
      feature: 'Overview',
      emoji: '🚀',
      gradient: 'from-purple-600 to-pink-600',
      preview: '6 revolutionary features await you'
    },
    {
      title: 'AI Code Whisperer',
      description: 'Get real-time vulnerability detection, gas optimization suggestions, and security insights as you type. Voice control included!',
      feature: 'Real-time AI Analysis',
      emoji: '🧠',
      gradient: 'from-purple-600 to-blue-600',
      preview: 'Detects 94% of vulnerabilities instantly'
    },
    {
      title: 'Contract Time Machine',
      description: 'Travel through your code history, fork realities to explore alternatives, and simulate future executions. Never lose progress again!',
      feature: 'Time Travel & Forking',
      emoji: '⏰',
      gradient: 'from-indigo-600 to-purple-600',
      preview: 'Explore infinite parallel realities'
    },
    {
      title: 'Ethical Exploit Laboratory',
      description: 'Learn security by attacking your own contracts. Test reentrancy, overflows, and 6 other attack vectors in a safe sandbox.',
      feature: 'Security Testing',
      emoji: '🛡️',
      gradient: 'from-red-600 to-orange-600',
      preview: 'Hack yourself before hackers do'
    },
    {
      title: 'Collaborative Arena',
      description: 'Code with AI teammates! Summon CodePilot, Professor AI, or Security Auditor. Compete in challenges and earn bounties.',
      feature: 'AI Collaboration',
      emoji: '👥',
      gradient: 'from-violet-600 to-fuchsia-600',
      preview: 'Real-time coding with AI mentors'
    },
    {
      title: 'Neural Gas Oracle',
      description: 'ML models trained on 100k+ contracts predict and optimize gas costs. 3 neural networks with 94% accuracy.',
      feature: 'ML-Powered Optimization',
      emoji: '🔮',
      gradient: 'from-cyan-600 to-blue-600',
      preview: 'Save up to 70% on gas costs'
    },
    {
      title: 'Cross-Chain Dream Weaver',
      description: 'Deploy to 8 blockchains with one click. Smart AI deployment, auto-bridge setup, and cost optimization included.',
      feature: 'Multi-Chain Deployment',
      emoji: '🌐',
      gradient: 'from-emerald-600 to-teal-600',
      preview: 'One contract, infinite chains'
    },
    {
      title: 'Ready to Build?',
      description: 'Click the "Activate Innovation" button in the sandbox to unlock all these revolutionary features. The future of Web3 development is here!',
      feature: 'Get Started',
      emoji: '✨',
      gradient: 'from-pink-600 to-purple-600',
      preview: 'Let\'s change the game together'
    }
  ];

  const currentStepData = steps[currentStep];

  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onClose();
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-2xl bg-gradient-to-br from-gray-900 to-purple-900 rounded-2xl shadow-2xl overflow-hidden">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-all"
        >
          <X className="w-5 h-5 text-white" />
        </button>

        {/* Header */}
        <div className={`p-8 bg-gradient-to-r ${currentStepData.gradient} text-white`}>
          <div className="text-6xl mb-4 animate-bounce">{currentStepData.emoji}</div>
          <h2 className="text-3xl font-black mb-2">{currentStepData.title}</h2>
          <p className="text-lg text-white/90">{currentStepData.description}</p>
        </div>

        {/* Content */}
        <div className="p-8 text-white">
          <div className="mb-6">
            <div className="inline-flex items-center space-x-2 px-4 py-2 bg-white/10 rounded-full mb-4">
              <Sparkles className="w-4 h-4 text-yellow-400" />
              <span className="text-sm font-bold">{currentStepData.feature}</span>
            </div>
            <div className="text-2xl font-bold text-purple-200">
              {currentStepData.preview}
            </div>
          </div>

          {/* Feature Highlights */}
          {currentStep === 0 && (
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="p-4 bg-white/5 rounded-lg text-center">
                <div className="text-3xl font-black bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent mb-2">
                  6
                </div>
                <div className="text-xs text-purple-200">Revolutionary Features</div>
              </div>
              <div className="p-4 bg-white/5 rounded-lg text-center">
                <div className="text-3xl font-black bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent mb-2">
                  94%
                </div>
                <div className="text-xs text-purple-200">AI Accuracy</div>
              </div>
              <div className="p-4 bg-white/5 rounded-lg text-center">
                <div className="text-3xl font-black bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent mb-2">
                  8
                </div>
                <div className="text-xs text-purple-200">Blockchain Networks</div>
              </div>
            </div>
          )}

          {/* Progress */}
          <div className="mb-6">
            <div className="flex items-center justify-between text-sm text-purple-200 mb-2">
              <span>Step {currentStep + 1} of {steps.length}</span>
              <span>{Math.round(((currentStep + 1) / steps.length) * 100)}% Complete</span>
            </div>
            <div className="w-full bg-white/10 rounded-full h-2">
              <div
                className={`bg-gradient-to-r ${currentStepData.gradient} h-2 rounded-full transition-all duration-500`}
                style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
              />
            </div>
          </div>

          {/* Dots Navigation */}
          <div className="flex items-center justify-center space-x-2 mb-6">
            {steps.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentStep(index)}
                className={`w-2 h-2 rounded-full transition-all ${
                  index === currentStep
                    ? 'w-8 bg-white'
                    : index < currentStep
                    ? 'bg-white/50'
                    : 'bg-white/20'
                }`}
              />
            ))}
          </div>

          {/* Navigation Buttons */}
          <div className="flex items-center justify-between">
            <button
              onClick={prevStep}
              disabled={currentStep === 0}
              className="flex items-center space-x-2 px-6 py-3 bg-white/10 hover:bg-white/20 rounded-lg font-medium transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>Previous</span>
            </button>

            {currentStep === steps.length - 1 ? (
              <Link
                to="/sandbox"
                onClick={onClose}
                className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 rounded-lg font-bold transition-all shadow-lg"
              >
                <Rocket className="w-5 h-5" />
                <span>Start Building</span>
              </Link>
            ) : (
              <button
                onClick={nextStep}
                className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 rounded-lg font-bold transition-all shadow-lg"
              >
                <span>Next</span>
                <ArrowRight className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Skip Button */}
        <button
          onClick={onClose}
          className="absolute bottom-4 left-1/2 transform -translate-x-1/2 text-sm text-purple-300 hover:text-white transition-all"
        >
          Skip Tour
        </button>
      </div>
    </div>
  );
}
