/**
 * ✨ built by nich
 * 🌐 GitHub: github.com/nirholas
 * 💫 Crafting digital magic since day one ✨
 */

/**
 * Lyra UI Component Library
 * 
 * Exports Lyra-branded components and icons.
 * Uses Lucide for UI icons and Simple Icons for brand icons.
 */

// =============================================================================
// ICONS - Re-export from our icon wrapper
// =============================================================================
export * from './LyraIcons';

// =============================================================================
// LYRA BRANDING
// =============================================================================
export { LyraLogo, LyraBrand, LyraLoading } from './LyraBrand';

// =============================================================================
// LYRA CHAT (Custom implementation)
// =============================================================================
export { LyraChatMessage, LyraChatPanel } from './LyraChat';
export type { LyraChatMessageProps, LyraChatPanelProps } from './LyraChat';
