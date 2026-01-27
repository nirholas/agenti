/**
 * ═══════════════════════════════════════════════════════════════════════════
 * LYRA WEB3 PLAYGROUND - Navigation Bar Component
 * ═══════════════════════════════════════════════════════════════════════════
 * ✨ Author: nich | 🐦 x.com/nichxbt | 🐙 github.com/nirholas
 * 📦 github.com/nirholas/lyra-web3-playground | 🌐 https://lyra.works
 * Copyright (c) 2024-2026 nirholas (nich) - MIT License
 * @preserve
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  Moon, Sun, Menu, X, Zap, BookOpen, Users, 
  Compass, ChevronDown, Code2, GraduationCap, Rocket,
  FileCode, Terminal, Layers, ArrowRight, Play, Sparkles,
  FlaskConical, Code
} from 'lucide-react';
import { useThemeStore } from '@/stores/themeStore';
import { useWalletStore } from '@/stores/walletStore';
import { truncateAddress } from '@/utils/helpers';
import WalletConnect from './WalletConnect';
import LanguageSelector from './LanguageSelector';
import UserButton from './UserButton';
import { useAnnounce } from './Accessibility';
import useI18n from '@/stores/i18nStore';

interface DropdownItem {
  label: string;
  href: string;
  icon?: React.ElementType;
  description?: string;
  badge?: string;
  iconColor?: string;
}

interface NavDropdownProps {
  label: string;
  items: DropdownItem[];
  icon?: React.ElementType;
}

function NavDropdown({ label, items, icon: Icon }: NavDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout>(null);

  const handleMouseEnter = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setIsOpen(true);
  };

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => setIsOpen(false), 150);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return (
    <div 
      ref={dropdownRef}
      className="relative"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button
        className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
          isOpen 
            ? 'text-gray-900 dark:text-white bg-gray-100/80 dark:bg-white/10' 
            : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100/60 dark:hover:bg-white/5'
        }`}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        {Icon && <Icon className="w-4 h-4" />}
        <span>{label}</span>
        <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown Panel */}
      <div 
        className={`absolute top-full left-0 mt-1 w-80 origin-top-left transition-all duration-200 ${
          isOpen 
            ? 'opacity-100 scale-100 translate-y-0' 
            : 'opacity-0 scale-95 -translate-y-2 pointer-events-none'
        }`}
      >
        <div className="bg-white dark:bg-black rounded-xl shadow-xl shadow-black/10 dark:shadow-[0_0_30px_rgba(255,255,255,0.05)] border border-gray-200/80 dark:border-white/10 overflow-hidden backdrop-blur-xl">
          <div className="p-2">
            {items.map((item) => (
              <Link
                key={item.href}
                to={item.href}
                className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-white/5 transition-colors group"
                onClick={() => setIsOpen(false)}
              >
                {item.icon && (
                  <div className={`flex-shrink-0 w-9 h-9 rounded-lg bg-gradient-to-br from-gray-100 to-gray-50 dark:from-white/5 dark:to-white/[0.02] flex items-center justify-center group-hover:from-violet-100 group-hover:to-violet-50 dark:group-hover:from-violet-900/30 dark:group-hover:to-violet-800/20 transition-colors`}>
                    <item.icon className={`w-4 h-4 ${item.iconColor || 'text-gray-600 dark:text-gray-400'} group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors`} />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900 dark:text-white group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors">
                      {item.label}
                    </span>
                    {item.badge && (
                      <span className="px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white">
                        {item.badge}
                      </span>
                    )}
                  </div>
                  {item.description && (
                    <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400 line-clamp-1">
                      {item.description}
                    </p>
                  )}
                </div>
                <ArrowRight className="w-4 h-4 mt-0.5 text-gray-300 dark:text-gray-600 group-hover:text-violet-500 group-hover:translate-x-0.5 transition-all opacity-0 group-hover:opacity-100" />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function NavBar() {
  const { mode, toggleTheme } = useThemeStore();
  const { address, isConnected } = useWalletStore();
  const { t } = useI18n();
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const { announce } = useAnnounce();

  // Handle scroll effect
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

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

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (isMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMenuOpen]);

  // Announce theme change
  const handleThemeToggle = () => {
    toggleTheme();
    announce(`Switched to ${mode === 'dark' ? 'light' : 'dark'} mode`, 'polite');
  };

  // Navigation items for dropdowns
  const learnItems: DropdownItem[] = [
    { label: 'Documentation', href: '/docs', icon: BookOpen, description: 'Comprehensive guides and API references', iconColor: 'text-blue-500' },
    { label: 'Tutorials', href: '/tutorials', icon: GraduationCap, description: 'Step-by-step learning paths', iconColor: 'text-emerald-500' },
    { label: 'Examples', href: '/playground', icon: FileCode, description: 'Ready-to-use code templates', iconColor: 'text-amber-500' },
  ];

  const buildItems: DropdownItem[] = [
    { label: 'AI Sandbox', href: '/sandbox', icon: Sparkles, description: 'AI-powered coding environment', badge: 'New', iconColor: 'text-violet-500' },
    { label: 'Web Sandbox', href: '/ide?type=web', icon: Terminal, description: 'HTML, CSS, JS, React, Vue', iconColor: 'text-blue-500' },
    { label: 'Solidity IDE', href: '/ide?type=solidity', icon: Code, description: 'Smart contract development', iconColor: 'text-purple-500' },
    { label: 'Full-Stack Playground', href: '/fullstack-demo', icon: Layers, description: 'Contract + Frontend builder', iconColor: 'text-green-500' },
    { label: 'Innovation Lab', href: '/innovation', icon: FlaskConical, description: 'AI tools & experimental features', badge: 'Beta', iconColor: 'text-pink-500' },
  ];

  const isActiveLink = (path: string) => location.pathname === path || location.pathname.startsWith(path + '/');

  return (
    <>
      <nav 
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          isScrolled 
            ? 'bg-white/80 dark:bg-black/80 backdrop-blur-xl border-b border-gray-200/50 dark:border-white/5 shadow-sm shadow-black/5 dark:shadow-[0_1px_20px_rgba(255,255,255,0.03)]' 
            : 'bg-white/60 dark:bg-black/60 backdrop-blur-md'
        }`}
        role="navigation"
        aria-label="Main navigation"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link 
              to="/" 
              className="flex items-center gap-2.5 group"
              aria-label="Lyra Web3 Playground - Home"
            >
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-violet-500 to-fuchsia-500 rounded-xl blur-lg opacity-40 group-hover:opacity-60 transition-opacity" />
                <div className="relative p-2 bg-gradient-to-br from-violet-500 to-fuchsia-500 rounded-xl group-hover:scale-105 transition-transform duration-200">
                  <Zap className="w-5 h-5 text-white" />
                </div>
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-lg tracking-tight text-gray-900 dark:text-white">
                  Lyra
                </span>
                <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400 -mt-0.5 tracking-wide hidden sm:block">
                  Web3 Playground
                </span>
              </div>
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden lg:flex items-center gap-1">
              <NavDropdown label="Learn" items={learnItems} icon={GraduationCap} />
              <NavDropdown label="Build" items={buildItems} icon={Code2} />
              
              <Link
                to="/explore"
                className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                  isActiveLink('/explore')
                    ? 'text-gray-900 dark:text-white bg-gray-100/80 dark:bg-white/10'
                    : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100/60 dark:hover:bg-white/5'
                }`}
              >
                <Compass className="w-4 h-4" />
                <span>Explore</span>
              </Link>

              <Link
                to="/community"
                className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                  isActiveLink('/community')
                    ? 'text-gray-900 dark:text-white bg-gray-100/80 dark:bg-white/10'
                    : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100/60 dark:hover:bg-white/5'
                }`}
              >
                <Users className="w-4 h-4" />
                <span>{t('nav.community')}</span>
              </Link>
            </div>

            {/* Right Side Actions */}
            <div className="hidden lg:flex items-center gap-2">
              <LanguageSelector compact />
              
              <button
                onClick={handleThemeToggle}
                className="p-2.5 rounded-lg text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100/60 dark:hover:bg-white/5 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:ring-offset-2 dark:focus:ring-offset-black"
                aria-label={mode === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
                aria-pressed={mode === 'dark'}
              >
                {mode === 'dark' ? (
                  <Sun className="w-5 h-5" />
                ) : (
                  <Moon className="w-5 h-5" />
                )}
              </button>

              <div className="w-px h-6 bg-gray-200 dark:bg-gray-700 mx-1" />

              <UserButton />

              <Link
                to="/sandbox"
                className="group relative flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
              >
                <Play className="w-4 h-4" />
                <span>Start Building</span>
                <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-violet-400 to-fuchsia-400 opacity-0 group-hover:opacity-100 blur-xl transition-opacity -z-10" />
              </Link>
            </div>

            {/* Mobile Menu Button */}
            <div className="flex lg:hidden items-center gap-2">
              <button
                onClick={handleThemeToggle}
                className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
                aria-label={mode === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
              >
                {mode === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
              
              <button
                ref={menuButtonRef}
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                aria-label={isMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
                aria-expanded={isMenuOpen}
                aria-controls="mobile-menu"
              >
                {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        <div 
          id="mobile-menu"
          ref={mobileMenuRef}
          role="dialog"
          aria-modal="true"
          aria-label="Navigation menu"
          className={`lg:hidden fixed inset-x-0 top-16 bottom-0 bg-white dark:bg-black transition-all duration-300 ease-out ${
            isMenuOpen 
              ? 'opacity-100 translate-y-0' 
              : 'opacity-0 -translate-y-4 pointer-events-none'
          }`}
          aria-hidden={!isMenuOpen}
        >
          <nav className="h-full overflow-y-auto overscroll-contain px-4 py-6 space-y-6">
            {/* Learn Section */}
            <div>
              <h3 className="px-3 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">
                Learn
              </h3>
              <div className="space-y-1">
                {learnItems.map((item) => (
                  <Link
                    key={item.href}
                    to={item.href}
                    onClick={() => setIsMenuOpen(false)}
                    className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors group"
                  >
                    {item.icon && (
                      <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center group-hover:bg-violet-100 dark:group-hover:bg-violet-900/30 transition-colors">
                        <item.icon className={`w-5 h-5 ${item.iconColor || 'text-gray-600 dark:text-gray-400'}`} />
                      </div>
                    )}
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">{item.label}</div>
                      {item.description && (
                        <div className="text-sm text-gray-500 dark:text-gray-400">{item.description}</div>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            {/* Build Section */}
            <div>
              <h3 className="px-3 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">
                Build
              </h3>
              <div className="space-y-1">
                {buildItems.map((item) => (
                  <Link
                    key={item.href}
                    to={item.href}
                    onClick={() => setIsMenuOpen(false)}
                    className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors group"
                  >
                    {item.icon && (
                      <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center group-hover:bg-violet-100 dark:group-hover:bg-violet-900/30 transition-colors">
                        <item.icon className={`w-5 h-5 ${item.iconColor || 'text-gray-600 dark:text-gray-400'}`} />
                      </div>
                    )}
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900 dark:text-white">{item.label}</span>
                        {item.badge && (
                          <span className="px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white">
                            {item.badge}
                          </span>
                        )}
                      </div>
                      {item.description && (
                        <div className="text-sm text-gray-500 dark:text-gray-400">{item.description}</div>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            {/* Quick Links */}
            <div>
              <h3 className="px-3 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">
                Explore
              </h3>
              <div className="space-y-1">
                <Link
                  to="/explore"
                  onClick={() => setIsMenuOpen(false)}
                  className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                >
                  <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                    <Compass className="w-5 h-5 text-cyan-500" />
                  </div>
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">Explore</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">Discover community projects</div>
                  </div>
                </Link>
                <Link
                  to="/community"
                  onClick={() => setIsMenuOpen(false)}
                  className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                >
                  <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                    <Users className="w-5 h-5 text-orange-500" />
                  </div>
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">Community</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">Connect with developers</div>
                  </div>
                </Link>
                <Link
                  to="/about"
                  onClick={() => setIsMenuOpen(false)}
                  className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                >
                  <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                    <Rocket className="w-5 h-5 text-red-500" />
                  </div>
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">About</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">Learn about Lyra</div>
                  </div>
                </Link>
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-gray-200 dark:border-gray-800" />

            {/* Actions */}
            <div className="space-y-3 pb-20">
              <LanguageSelector />
              
              <Link
                to="/sandbox"
                onClick={() => setIsMenuOpen(false)}
                className="flex items-center justify-center gap-2 w-full px-4 py-3.5 rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white font-semibold shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 transition-all"
              >
                <Play className="w-5 h-5" />
                <span>Start Building</span>
              </Link>

              <div className="flex items-center justify-center">
                <UserButton />
              </div>
            </div>
          </nav>
        </div>
      </nav>

      {/* Mobile menu backdrop */}
      {isMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 lg:hidden" 
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
