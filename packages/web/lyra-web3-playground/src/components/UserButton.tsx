/**
 * ✨ built by nich
 * 🌐 GitHub: github.com/nirholas
 * 💫 User profile button with Privy auth
 */

import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  User, 
  LogOut, 
  Settings, 
  Folder, 
  ChevronDown,
  Mail,
  Wallet,
  Github,
  Twitter,
  Loader2,
  ExternalLink
} from 'lucide-react';
import { cn, truncateAddress } from '@/utils/helpers';
import { isPrivyConfigured } from '@/providers/PrivyProvider';
import { useAuth } from '@/hooks/useAuth';

export default function UserButton() {
  const authState = useAuth();
  const { 
    ready, 
    isAuthenticated, 
    profile, 
    login, 
    logout,
    primaryWallet 
  } = authState;
  
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // If Privy is not configured, show a disabled button
  if (!isPrivyConfigured) {
    return (
      <button
        disabled
        className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-gray-400 cursor-not-allowed"
        title="Auth not configured"
      >
        <User className="w-4 h-4" />
        <span className="text-sm">Sign In</span>
      </button>
    );
  }

  // Loading state
  if (!ready) {
    return (
      <button className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-gray-500">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-sm">Loading...</span>
      </button>
    );
  }

  // Not authenticated - show login button
  if (!isAuthenticated) {
    return (
      <button
        onClick={() => login()}
        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-primary-500 to-secondary-500 hover:from-primary-600 hover:to-secondary-600 text-white rounded-lg font-medium transition-all shadow-lg shadow-primary-500/25"
      >
        <User className="w-4 h-4" />
        <span className="text-sm">Sign In</span>
      </button>
    );
  }

  // Authenticated - show profile button with dropdown
  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
      >
        {/* Avatar */}
        {profile?.avatar ? (
          <img 
            src={profile.avatar} 
            alt={profile.name || 'User'} 
            className="w-6 h-6 rounded-full"
          />
        ) : (
          <div className="w-6 h-6 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-full flex items-center justify-center">
            <User className="w-3 h-3 text-white" />
          </div>
        )}
        
        {/* Name/Address */}
        <span className="text-sm font-medium max-w-[100px] truncate">
          {profile?.name || (profile?.wallet ? truncateAddress(profile.wallet) : profile?.email?.split('@')[0] || 'User')}
        </span>
        
        <ChevronDown className={cn("w-4 h-4 transition-transform", isOpen && "rotate-180")} />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden z-50">
          {/* User Info */}
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              {profile?.avatar ? (
                <img 
                  src={profile.avatar} 
                  alt={profile.name || 'User'} 
                  className="w-10 h-10 rounded-full"
                />
              ) : (
                <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-full flex items-center justify-center">
                  <User className="w-5 h-5 text-white" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate">
                  {profile?.name || 'Lyra User'}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                  {profile?.email || (profile?.wallet ? truncateAddress(profile.wallet) : 'Anonymous')}
                </p>
              </div>
            </div>
            
            {/* Connected Accounts */}
            <div className="flex items-center gap-2 mt-3">
              {profile?.linkedAccounts.map((account, i) => (
                <div 
                  key={i}
                  className="p-1.5 bg-gray-100 dark:bg-gray-700 rounded-lg"
                  title={account.type}
                >
                  {account.type === 'email' && <Mail className="w-3 h-3" />}
                  {account.type === 'wallet' && <Wallet className="w-3 h-3" />}
                  {account.type === 'github' && <Github className="w-3 h-3" />}
                  {account.type === 'twitter' && <Twitter className="w-3 h-3" />}
                  {account.type === 'google' && (
                    <svg className="w-3 h-3" viewBox="0 0 24 24">
                      <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Menu Items */}
          <div className="p-2">
            <Link
              to="/projects"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <Folder className="w-4 h-4" />
              <span className="text-sm">My Projects</span>
            </Link>
            
            <Link
              to="/settings"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <Settings className="w-4 h-4" />
              <span className="text-sm">Settings</span>
            </Link>

            {primaryWallet && (
              <a
                href={`https://sepolia.etherscan.io/address/${primaryWallet.address}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                <span className="text-sm">View on Explorer</span>
              </a>
            )}
          </div>

          {/* Logout */}
          <div className="p-2 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={() => {
                logout();
                setIsOpen(false);
              }}
              className="flex items-center gap-3 w-full px-3 py-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span className="text-sm">Sign Out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
