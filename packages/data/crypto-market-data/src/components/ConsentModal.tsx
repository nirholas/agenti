/**
 * ✨ built by nich
 * 🌐 GitHub: github.com/nirholas
 * 💫 Friendly consent for educational projects 🛡️
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Shield, 
  AlertTriangle, 
  FileText, 
  CheckCircle,
  ExternalLink,
  X,
  Sparkles,
  GraduationCap
} from 'lucide-react';

const CONSENT_KEY = 'lyra_terms_accepted';
const CONSENT_VERSION = '1.0.0';

export type ConsentTrigger = 'wallet' | 'project' | 'account';

interface ConsentModalProps {
  trigger: ConsentTrigger;
  onAccept: () => void;
  onCancel: () => void;
}

// Hook to check/set consent status
export function useConsent() {
  const [hasConsented, setHasConsented] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const stored = localStorage.getItem(CONSENT_KEY);
    if (!stored) return false;
    try {
      const parsed = JSON.parse(stored);
      return parsed.version === CONSENT_VERSION && parsed.accepted === true;
    } catch {
      return false;
    }
  });

  const acceptTerms = () => {
    localStorage.setItem(CONSENT_KEY, JSON.stringify({
      accepted: true,
      version: CONSENT_VERSION,
      timestamp: new Date().toISOString()
    }));
    setHasConsented(true);
  };

  const requireConsent = (callback: () => void): (() => void) | null => {
    if (hasConsented) {
      callback();
      return null;
    }
    return callback;
  };

  return { hasConsented, acceptTerms, requireConsent };
}

const triggerMessages: Record<ConsentTrigger, { title: string; description: string; icon: typeof Sparkles }> = {
  wallet: {
    title: 'Connect Your Wallet',
    description: 'Before connecting your wallet, please review our terms. Your security is important to us!',
    icon: Shield
  },
  project: {
    title: 'Create a Project',
    description: 'Awesome! Before sharing with the community, please review our terms.',
    icon: Sparkles
  },
  account: {
    title: 'Create Your Account',
    description: 'Welcome! Please review our terms before joining the community.',
    icon: GraduationCap
  }
};

export default function ConsentModal({ trigger, onAccept, onCancel }: ConsentModalProps) {
  const [accepted, setAccepted] = useState(false);
  const message = triggerMessages[trigger];
  const TriggerIcon = message.icon;

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl border border-gray-200 dark:border-gray-700 animate-in fade-in zoom-in-95 duration-200">
        {/* Header - Friendly gradient */}
        <div className="bg-gradient-to-r from-primary-500 to-secondary-500 p-5 text-white relative">
          <button
            onClick={onCancel}
            className="absolute top-4 right-4 p-1 hover:bg-white/20 rounded-lg transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3 mb-1">
            <TriggerIcon className="w-7 h-7" />
            <h2 className="text-xl font-bold">{message.title}</h2>
          </div>
          <p className="text-white/90 text-sm">
            {message.description}
          </p>
        </div>

        {/* Content - Simplified */}
        <div className="p-5 space-y-4">
          {/* Quick Summary Box */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <h3 className="font-semibold text-blue-800 dark:text-blue-200 mb-2 flex items-center gap-2">
              <GraduationCap className="w-4 h-4" />
              Quick Summary
            </h3>
            <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1.5">
              <li>✅ This is a <strong>free educational project</strong></li>
              <li>✅ Code examples are for <strong>learning only</strong></li>
              <li>✅ We <strong>never</strong> ask for your private keys</li>
              <li>✅ Your code stays in <strong>your browser</strong></li>
            </ul>
          </div>

          {/* Important Note */}
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="text-amber-700 dark:text-amber-300">
                  <strong>Please note:</strong> Code on this platform is not audited. 
                  Always review and test thoroughly before using in production.
                </p>
              </div>
            </div>
          </div>

          {/* Links */}
          <div className="flex gap-4 text-sm">
            <Link 
              to="/terms" 
              target="_blank"
              className="inline-flex items-center gap-1 text-primary-600 hover:underline"
            >
              <FileText className="w-4 h-4" />
              Terms of Service
              <ExternalLink className="w-3 h-3" />
            </Link>
            <Link 
              to="/privacy"
              target="_blank" 
              className="inline-flex items-center gap-1 text-primary-600 hover:underline"
            >
              <Shield className="w-4 h-4" />
              Privacy Policy
              <ExternalLink className="w-3 h-3" />
            </Link>
          </div>
        </div>

        {/* Checkbox & Button */}
        <div className="border-t border-gray-200 dark:border-gray-700 p-5 bg-gray-50 dark:bg-gray-800/50">
          <label className="flex items-start gap-3 cursor-pointer group mb-4">
            <input
              type="checkbox"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
              className="mt-0.5 w-5 h-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white">
              I agree to the <strong>Terms of Service</strong> and understand this is an educational platform
            </span>
          </label>

          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="flex-1 py-3 px-4 rounded-xl font-medium text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onAccept}
              disabled={!accepted}
              className={`flex-1 py-3 px-4 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 ${
                accepted
                  ? 'bg-gradient-to-r from-primary-600 to-secondary-600 text-white hover:from-primary-700 hover:to-secondary-700 shadow-lg hover:shadow-xl'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
              }`}
            >
              {accepted ? (
                <>
                  <CheckCircle className="w-5 h-5" />
                  Continue
                </>
              ) : (
                'Check the box above'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
