/**
 * ✨ built by nich
 * 🌐 GitHub: github.com/nirholas
 * 💫 Persistence beats perfection 🎖️
 */

/**
 * Lyra Branding Components
 * 
 * Custom Lyra branding components.
 * Logo, brand marks, and loading indicators.
 */

import React, { memo } from 'react';

// =============================================================================
// LYRA LOGO
// =============================================================================

interface LyraLogoProps {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Lyra Logo - Musical note + blockchain motif
 * Replace with your final designed logo
 */
export const LyraLogo = memo<LyraLogoProps>(({ size = 32, className, style }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 32 32"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    style={style}
  >
    {/* Placeholder Lyra logo - musical note with hexagon */}
    <circle cx="16" cy="16" r="14" stroke="currentColor" strokeWidth="2" fill="none" />
    <path
      d="M12 22V10L22 8V20"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle cx="10" cy="22" r="2" fill="currentColor" />
    <circle cx="20" cy="20" r="2" fill="currentColor" />
  </svg>
));

LyraLogo.displayName = 'LyraLogo';

// =============================================================================
// LYRA BRAND TEXT
// =============================================================================

interface LyraBrandProps {
  size?: 'sm' | 'md' | 'lg';
  showLogo?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

const sizeMap = {
  sm: { logo: 20, text: 14 },
  md: { logo: 28, text: 18 },
  lg: { logo: 40, text: 24 },
};

/**
 * Lyra Brand - Logo + Text combo
 */
export const LyraBrand = memo<LyraBrandProps>(({ 
  size = 'md', 
  showLogo = true, 
  className,
  style 
}) => {
  const sizes = sizeMap[size];
  
  return (
    <div 
      className={className}
      style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '8px',
        ...style 
      }}
    >
      {showLogo && <LyraLogo size={sizes.logo} />}
      <span style={{ 
        fontSize: sizes.text, 
        fontWeight: 700,
        letterSpacing: '-0.02em',
      }}>
        Lyra
      </span>
    </div>
  );
});

LyraBrand.displayName = 'LyraBrand';

// =============================================================================
// LYRA LOADING
// =============================================================================

interface LyraLoadingProps {
  size?: number;
  text?: string;
}

/**
 * Lyra Loading Spinner
 */
export const LyraLoading = memo<LyraLoadingProps>(({ size = 40, text = 'Loading...' }) => (
  <div style={{ 
    display: 'flex', 
    flexDirection: 'column', 
    alignItems: 'center', 
    gap: '12px' 
  }}>
    <div
      style={{
        width: size,
        height: size,
        border: '3px solid transparent',
        borderTopColor: 'currentColor',
        borderRadius: '50%',
        animation: 'lyra-spin 1s linear infinite',
      }}
    />
    {text && (
      <span style={{ fontSize: 14, opacity: 0.7 }}>{text}</span>
    )}
    <style>{`
      @keyframes lyra-spin {
        to { transform: rotate(360deg); }
      }
    `}</style>
  </div>
));

LyraLoading.displayName = 'LyraLoading';

// =============================================================================
// EXPORTS
// =============================================================================

export type { LyraLogoProps, LyraBrandProps, LyraLoadingProps };
