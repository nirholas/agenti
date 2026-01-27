/**
 * ✨ built by nich
 * 🌐 GitHub: github.com/nirholas
 * ⌨️ Skip Links - Essential for keyboard navigation
 * 💫 Allow users to skip repetitive navigation and jump to content
 */

import { useState } from 'react';

interface SkipLink {
  id: string;
  label: string;
}

const defaultLinks: SkipLink[] = [
  { id: 'main-content', label: 'Skip to main content' },
  { id: 'main-navigation', label: 'Skip to navigation' },
  { id: 'search', label: 'Skip to search' },
  { id: 'footer', label: 'Skip to footer' },
];

interface SkipLinksProps {
  links?: SkipLink[];
}

export default function SkipLinks({ links = defaultLinks }: SkipLinksProps) {
  const [focusedIndex, setFocusedIndex] = useState(-1);

  const handleClick = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.tabIndex = -1;
      element.focus();
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <nav 
      aria-label="Skip links"
      className="sr-only focus-within:not-sr-only focus-within:fixed focus-within:top-0 focus-within:left-0 focus-within:right-0 focus-within:z-[10001] focus-within:bg-white focus-within:dark:bg-gray-900 focus-within:shadow-lg"
    >
      <ul className="flex gap-2 p-2">
        {links.map((link, index) => (
          <li key={link.id}>
            <a
              href={`#${link.id}`}
              onClick={(e) => {
                e.preventDefault();
                handleClick(link.id);
              }}
              onFocus={() => setFocusedIndex(index)}
              onBlur={() => setFocusedIndex(-1)}
              className={`
                inline-block px-4 py-2 font-medium rounded-lg
                bg-primary-600 text-white
                focus:ring-4 focus:ring-primary-300 focus:outline-none
                hover:bg-primary-700
                transform transition-all
                ${focusedIndex === index ? 'scale-100 opacity-100' : 'scale-95 opacity-0 focus:scale-100 focus:opacity-100'}
              `}
            >
              {link.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/**
 * Add these landmarks to your page for skip links to work:
 * 
 * <main id="main-content">...</main>
 * <nav id="main-navigation">...</nav>
 * <div id="search">...</div>
 * <footer id="footer">...</footer>
 */
