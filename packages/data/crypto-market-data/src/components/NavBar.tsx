/**
 * ✨ built by nich
 * 🌐 GitHub: github.com/nirholas
 * 💫 Code with purpose, build with passion 🔥
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Moon, Sun, Wallet, Menu, X, Zap, Sparkles, BookOpen, Users, Rocket, Compass } from 'lucide-react';
import { useThemeStore } from '@/stores/themeStore';
import { useWalletStore } from '@/stores/walletStore';
import { truncateAddress } from '@/utils/helpers';
import WalletConnect from './WalletConnect';
import LanguageSelector from './LanguageSelector';
import { useAnnounce } from './Accessibility';
import useI18n from '@/stores/i18nStore';

export default function NavBar() {
  const { mode, toggleTheme } = useThemeStore();
  const { address, isConnected } = useWalletStore();
  const { t } = useI18n();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const { announce } = useAnnounce();

  // Close menu on Escape key
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape' && isMenuOpen) {
      setIsMenuOpen(false);
      menuButtonRef.current?.focus();
      announce('Navigation menu closed', 'polite');
    }
  }, [isMenuOpen, announce]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Trap focus in mobile menu when open
  useEffect(() => {
    if (isMenuOpen && mobileMenuRef.current) {
      const focusableElements = mobileMenuRef.current.querySelectorAll<HTMLElement>(
        'a, button, input, [tabindex]:not([tabindex="-1"])'
      );
      if (focusableElements.length > 0) {
        focusableElements[0].focus();
      }
      announce('Navigation menu opened. Use arrow keys or Tab to navigate.', 'polite');
    }
  }, [isMenuOpen, announce]);

  // Announce theme change
  const handleThemeToggle = () => {
    toggleTheme();
    announce(`Switched to ${mode === 'dark' ? 'light' : 'dark'} mode`, 'polite');
  };

  return (
    <>
      <nav 
        className="fixed top-0 left-0 right-0 z-50 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm"
        role="navigation"
        aria-label="Main navigation"
      >
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link to="/" className="flex items-center space-x-2 group" aria-label="Lyra Web3 Playground - Home">
              <div className="p-2 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-lg group-hover:scale-110 transition-transform" aria-hidden="true">
                <Zap className="w-5 h-5 text-white" />
              </div>
              <span className="font-bold text-xl bg-gradient-to-r from-primary-600 to-secondary-600 bg-clip-text text-transparent">
                Lyra
              </span>
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-4" role="menubar">
              <Link
                to="/docs"
                className="px-4 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center space-x-2"
                role="menuitem"
              >
                <BookOpen className="w-4 h-4" aria-hidden="true" />
                <span>{t('nav.docs')}</span>
              </Link>

              <Link
                to="/tutorials"
                className="px-4 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                role="menuitem"
              >
                {t('nav.tutorials')}
              </Link>
              
              <Link
                to="/playground"
                className="px-4 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                {t('nav.playground')}
              </Link>

              {/* Innovation features are experimental and currently not exposed */}

              <Link
                to="/community"
                className="px-4 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center space-x-2"
              >
                <Users className="w-4 h-4" />
                <span>{t('nav.community')}</span>
              </Link>

              <Link
                to="/explore"
                className="px-4 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center space-x-2"
              >
                <Compass className="w-4 h-4" />
                <span>Explore</span>
              </Link>

              <Link
                to="/about"
                className="px-4 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                {t('nav.about')}
              </Link>

              <Link
                to="/projects"
                className="px-4 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                role="menuitem"
              >
                Projects
              </Link>
              
              <Link
                to="/sandbox"
                className="flex items-center space-x-2 px-4 py-2 rounded-lg bg-gradient-to-r from-primary-500 to-secondary-500 text-white hover:from-primary-600 hover:to-secondary-600 transition-all font-medium"
                role="menuitem"
              >
                <Sparkles className="w-4 h-4" aria-hidden="true" />
                <span>{t('nav.sandbox')}</span>
              </Link>

              <LanguageSelector compact />
              
              <button
                onClick={handleThemeToggle}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
                aria-label={mode === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
                aria-pressed={mode === 'dark'}
              >
                {mode === 'dark' ? (
                  <Sun className="w-5 h-5" aria-hidden="true" />
                ) : (
                  <Moon className="w-5 h-5" aria-hidden="true" />
                )}
              </button>

              <button
                onClick={() => setShowWalletModal(true)}
                className="btn-primary flex items-center space-x-2"
                aria-label={isConnected && address ? `Wallet connected: ${truncateAddress(address)}` : 'Connect wallet'}
              >
                <Wallet className="w-4 h-4" aria-hidden="true" />
                <span className={isConnected ? 'status-indicator status-success status-active' : ''}>
                  {isConnected && address
                    ? truncateAddress(address)
                    : 'Connect Wallet'}
                </span>
              </button>
            </div>

            {/* Mobile Menu Button */}
            <button
              ref={menuButtonRef}
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="md:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
              aria-label={isMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={isMenuOpen}
              aria-controls="mobile-menu"
            >
              {isMenuOpen ? (
                <X className="w-6 h-6" aria-hidden="true" />
              ) : (
                <Menu className="w-6 h-6" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        <div 
          id="mobile-menu"
          ref={mobileMenuRef}
          role="dialog"
          aria-modal="true"
          aria-label="Navigation menu"
          className={`md:hidden border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden transition-all duration-300 ease-out ${
            isMenuOpen ? 'max-h-[80vh] opacity-100' : 'max-h-0 opacity-0'
          }`}
          aria-hidden={!isMenuOpen}
        >
          <nav className="container mx-auto px-4 py-4 space-y-1 overflow-y-auto max-h-[calc(80vh-2rem)]" role="navigation" aria-label="Mobile navigation">
              <Link
                to="/docs"
                onClick={() => setIsMenuOpen(false)}
                className="w-full block px-4 py-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors active:bg-gray-200 dark:active:bg-gray-600 min-h-[48px] flex items-center"
              >
                Docs
              </Link>

              <Link
                to="/tutorials"
                onClick={() => setIsMenuOpen(false)}
                className="w-full block px-4 py-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors active:bg-gray-200 dark:active:bg-gray-600 min-h-[48px] flex items-center"
              >
                Tutorials
              </Link>
              
              <Link
                to="/playground"
                onClick={() => setIsMenuOpen(false)}
                className="w-full block px-4 py-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors active:bg-gray-200 dark:active:bg-gray-600 min-h-[48px] flex items-center"
              >
                Templates
              </Link>

              {/* Innovation removed until features available */}

              <Link
                to="/community"
                onClick={() => setIsMenuOpen(false)}
                className="w-full block px-4 py-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors active:bg-gray-200 dark:active:bg-gray-600 min-h-[48px] flex items-center"
              >
                Community
              </Link>

              <Link
                to="/explore"
                onClick={() => setIsMenuOpen(false)}
                className="w-full flex items-center space-x-2 px-4 py-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors active:bg-gray-200 dark:active:bg-gray-600 min-h-[48px]"
              >
                <Compass className="w-4 h-4" />
                <span>Explore</span>
              </Link>

              <Link
                to="/about"
                onClick={() => setIsMenuOpen(false)}
                className="w-full block px-4 py-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors active:bg-gray-200 dark:active:bg-gray-600 min-h-[48px] flex items-center"
              >
                About
              </Link>

              <Link
                to="/projects"
                onClick={() => setIsMenuOpen(false)}
                className="w-full block px-4 py-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors active:bg-gray-200 dark:active:bg-gray-600 min-h-[48px] flex items-center"
              >
                Projects
              </Link>
              
              <Link
                to="/sandbox"
                onClick={() => setIsMenuOpen(false)}
                className="w-full flex items-center justify-center space-x-2 px-4 py-3 rounded-lg bg-gradient-to-r from-primary-500 to-secondary-500 text-white hover:from-primary-600 hover:to-secondary-600 transition-all font-medium min-h-[48px] mt-2"
              >
                <Sparkles className="w-4 h-4" />
                <span>Interactive Sandbox</span>
              </Link>
              
              <div className="border-t border-gray-200 dark:border-gray-700 my-2 pt-2 space-y-2">
                <button
                  onClick={handleThemeToggle}
                  className="w-full btn-secondary justify-start space-x-2 min-h-[48px] focus:outline-none focus:ring-2 focus:ring-primary-500"
                  aria-label={mode === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
                  aria-pressed={mode === 'dark'}
                >
                  {mode === 'dark' ? (
                    <>
                      <Sun className="w-4 h-4" aria-hidden="true" />
                      <span>Light Mode</span>
                    </>
                  ) : (
                    <>
                      <Moon className="w-4 h-4" aria-hidden="true" />
                      <span>Dark Mode</span>
                    </>
                  )}
                </button>

                <div className="w-full">
                  <LanguageSelector />
                </div>

                <button
                  onClick={() => {
                    setShowWalletModal(true);
                    setIsMenuOpen(false);
                  }}
                  className="w-full btn-primary flex items-center justify-center space-x-2 min-h-[48px]"
                  aria-label={isConnected && address ? `Wallet connected: ${truncateAddress(address)}. Click to manage.` : 'Connect your wallet'}
                >
                  <Wallet className="w-4 h-4" aria-hidden="true" />
                  <span>
                    {isConnected && address
                      ? truncateAddress(address)
                      : 'Connect Wallet'}
                  </span>
                </button>
              </div>
            </nav>
          </div>
      </nav>

      {/* Mobile menu backdrop */}
      {isMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/20 z-40 md:hidden" 
          onClick={() => setIsMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Wallet Modal */}
      {showWalletModal && (
        <WalletConnect onClose={() => setShowWalletModal(false)} />
      )}
    </>
  );
}
