/**
 * ✨ built by nich
 * 🌐 GitHub: github.com/nirholas
 * 🎨 SVG filters for color blindness simulation
 * 💫 Helping colorblind users see the web in their optimal colors
 */

import { useEffect } from 'react';

/**
 * ColorBlindFilters - Injects SVG filters for color blindness modes
 * These scientifically accurate filters simulate how colorblind users see colors
 */
export default function ColorBlindFilters() {
  // Inject the SVG once on mount
  useEffect(() => {
    // Check if already injected
    if (document.getElementById('colorblind-filters')) return;

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('id', 'colorblind-filters');
    svg.setAttribute('aria-hidden', 'true');
    svg.style.position = 'absolute';
    svg.style.width = '0';
    svg.style.height = '0';
    svg.style.overflow = 'hidden';

    svg.innerHTML = `
      <defs>
        <!-- Protanopia (Red-Blind) - ~1% of males -->
        <filter id="protanopia-filter">
          <feColorMatrix type="matrix" values="
            0.567, 0.433, 0.000, 0, 0
            0.558, 0.442, 0.000, 0, 0
            0.000, 0.242, 0.758, 0, 0
            0,     0,     0,     1, 0
          "/>
        </filter>

        <!-- Deuteranopia (Green-Blind) - ~1% of males -->
        <filter id="deuteranopia-filter">
          <feColorMatrix type="matrix" values="
            0.625, 0.375, 0.000, 0, 0
            0.700, 0.300, 0.000, 0, 0
            0.000, 0.300, 0.700, 0, 0
            0,     0,     0,     1, 0
          "/>
        </filter>

        <!-- Tritanopia (Blue-Blind) - ~0.001% of population -->
        <filter id="tritanopia-filter">
          <feColorMatrix type="matrix" values="
            0.950, 0.050, 0.000, 0, 0
            0.000, 0.433, 0.567, 0, 0
            0.000, 0.475, 0.525, 0, 0
            0,     0,     0,     1, 0
          "/>
        </filter>

        <!-- Protanomaly (Red-Weak) - ~1% of males -->
        <filter id="protanomaly-filter">
          <feColorMatrix type="matrix" values="
            0.817, 0.183, 0.000, 0, 0
            0.333, 0.667, 0.000, 0, 0
            0.000, 0.125, 0.875, 0, 0
            0,     0,     0,     1, 0
          "/>
        </filter>

        <!-- Deuteranomaly (Green-Weak) - ~5% of males -->
        <filter id="deuteranomaly-filter">
          <feColorMatrix type="matrix" values="
            0.800, 0.200, 0.000, 0, 0
            0.258, 0.742, 0.000, 0, 0
            0.000, 0.142, 0.858, 0, 0
            0,     0,     0,     1, 0
          "/>
        </filter>

        <!-- Tritanomaly (Blue-Weak) - rare -->
        <filter id="tritanomaly-filter">
          <feColorMatrix type="matrix" values="
            0.967, 0.033, 0.000, 0, 0
            0.000, 0.733, 0.267, 0, 0
            0.000, 0.183, 0.817, 0, 0
            0,     0,     0,     1, 0
          "/>
        </filter>
      </defs>
    `;

    document.body.appendChild(svg);

    return () => {
      const existing = document.getElementById('colorblind-filters');
      if (existing) {
        document.body.removeChild(existing);
      }
    };
  }, []);

  return null; // This component renders nothing visible
}
