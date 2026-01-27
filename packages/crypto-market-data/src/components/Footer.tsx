/**
 * ✨ built by nich
 * 🌐 GitHub: github.com/nirholas
 * 💫 Your potential is limitless 🌌
 */

import { Link } from 'react-router-dom';
import { Github, Twitter, Mail, Heart, Globe2 } from 'lucide-react';
import LanguageSelector from './LanguageSelector';
import useI18n from '@/stores/i18nStore';

export default function Footer() {
  const { t } = useI18n();
  
  return (
    <footer className="bg-gray-900 text-gray-200 pt-12 pb-24 md:pb-8 mt-16" role="contentinfo">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center space-x-2 mb-3">
              <div className="p-2 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-lg" aria-hidden="true">
                <Globe2 className="w-5 h-5 text-white" />
              </div>
              <span className="font-bold text-lg md:text-xl">Lyra Web3 Playground</span>
            </div>
            <p className="text-gray-400 text-sm leading-relaxed">
              {t('hero.description')}
            </p>
            <div className="flex items-center space-x-3 mt-4 text-pink-400">
              <Heart className="w-4 h-4" aria-hidden="true" />
              <span className="text-sm">Built for Web3</span>
            </div>
          </div>

          <nav aria-label="Product links">
            <h3 className="font-semibold mb-3 text-sm md:text-base">Product</h3>
            <ul className="space-y-2 text-sm text-gray-300">
              <li><Link to="/sandbox" className="hover:text-white py-1 inline-block">{t('nav.sandbox')}</Link></li>
              <li><Link to="/playground" className="hover:text-white py-1 inline-block">{t('nav.playground')}</Link></li>
              <li><Link to="/docs" className="hover:text-white py-1 inline-block">{t('nav.docs')}</Link></li>
            </ul>
          </nav>

          <nav aria-label="Company links">
            <h3 className="font-semibold mb-3 text-sm md:text-base">Company</h3>
            <ul className="space-y-2 text-sm text-gray-300">
              <li><Link to="/about" className="hover:text-white py-1 inline-block">{t('nav.about')}</Link></li>
              <li><Link to="/projects" className="hover:text-white py-1 inline-block">Projects</Link></li>
              <li><Link to="/changelog" className="hover:text-white py-1 inline-block">Changelog</Link></li>
              <li><Link to="/faq" className="hover:text-white py-1 inline-block">{t('nav.faq')}</Link></li>
            </ul>
          </nav>

          <div className="col-span-2 md:col-span-1">
            <h3 className="font-semibold mb-3 text-sm md:text-base">Stay in touch</h3>
            <div className="flex space-x-4 mb-3 text-gray-300">
              <a 
                href="https://github.com/nirholas/crypto-market-data" 
                className="hover:text-white p-2 -ml-2 touch-target" 
                aria-label="Visit our GitHub repository (opens in new tab)"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Github className="w-5 h-5" aria-hidden="true" />
              </a>
              <a 
                href="https://x.com/nichxbt" 
                className="hover:text-white p-2 touch-target" 
                aria-label="Follow us on Twitter (opens in new tab)"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Twitter className="w-5 h-5" aria-hidden="true" />
              </a>
            </div>
            <div className="flex items-center space-x-2 text-sm text-gray-300 mb-4">
              <Mail className="w-4 h-4" aria-hidden="true" />
              <span>Open Source Project</span>
            </div>
            <LanguageSelector compact />
          </div>
        </div>

        <div className="border-t border-gray-800 mt-8 pt-4 flex flex-col md:flex-row items-center justify-between text-sm text-gray-500 text-center md:text-left">
          <span>© {new Date().getFullYear()} Crypto Market Data. {t('footer.rights')}.</span>
          <nav aria-label="Legal links" className="space-x-6 mt-3 md:mt-0">
            <Link to="/privacy" className="hover:text-white py-2 inline-block">{t('footer.privacy')}</Link>
            <Link to="/terms" className="hover:text-white py-2 inline-block">{t('footer.terms')}</Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
