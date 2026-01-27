/**
 * ✨ built by nich
 * 🌐 GitHub: github.com/nirholas
 * 💫 Every expert was once a beginner 📚
 */

/**
 * Type definitions for smart contract templates and blockchain configurations
 */

// =============================================================================
// CHAIN CONFIGURATION TYPES
// =============================================================================

/**
 * Supported blockchain languages for smart contract development
 */
export type ContractLanguage = 'solidity' | 'rust' | 'vyper' | 'move';

/**
 * Native currency configuration for a blockchain
 */
export interface NativeCurrency {
  /** Display name of the currency (e.g., "Ether") */
  name: string;
  /** Currency symbol (e.g., "ETH") */
  symbol: string;
  /** Number of decimals (typically 18) */
  decimals: number;
}

/**
 * Testnet configuration for a blockchain
 */
export interface TestnetConfig {
  /** Testnet display name */
  name: string;
  /** Chain ID for the testnet */
  chainId: number;
  /** RPC URL for connecting to the testnet */
  rpcUrl: string;
  /** Faucet URL for obtaining test tokens */
  faucetUrl: string;
}

/**
 * Complete blockchain configuration
 */
export interface ChainConfig {
  /** Unique identifier for the chain (e.g., "ethereum", "base") */
  id: string;
  /** Display name of the chain */
  name: string;
  /** Emoji or icon identifier for the chain */
  icon: string;
  /** Chain ID for the mainnet */
  chainId: number;
  /** RPC URL for mainnet */
  rpcUrl: string;
  /** Block explorer URL */
  explorerUrl: string;
  /** Native currency configuration */
  nativeCurrency: NativeCurrency;
  /** Testnet configuration */
  testnet: TestnetConfig;
  /** Recommended compiler version for Solidity chains */
  compilerVersion: string;
  /** Primary smart contract language for this chain */
  language: ContractLanguage;
  /** Whether the chain is EVM-compatible */
  isEVM: boolean;
  /** Average block time in seconds */
  blockTime: number;
  /** Color for UI representation (hex code) */
  color: string;
  /** Short description of the chain */
  description: string;
  /** Whether this chain is currently active/supported */
  isActive: boolean;
}

// =============================================================================
// CONTRACT TEMPLATE TYPES
// =============================================================================

/**
 * Categories for organizing contract templates
 */
export type TemplateCategory = 
  | 'basic'
  | 'tokens'
  | 'nfts'
  | 'defi'
  | 'dao'
  | 'gaming'
  | 'security'
  | 'utility';

/**
 * Difficulty levels for templates
 */
export type TemplateDifficulty = 'beginner' | 'intermediate' | 'advanced' | 'expert';

/**
 * Audit status for contract templates
 */
export type AuditStatus = 'none' | 'community' | 'professional';

/**
 * A single file within a contract template
 */
export interface TemplateFile {
  /** Filename (e.g., "MyToken.sol") */
  name: string;
  /** Full source code */
  code: string;
  /** Programming language */
  language: string;
  /** Whether this is the main/entry file */
  isMain?: boolean;
}

/**
 * Complete contract template definition
 */
export interface ContractTemplate {
  /** Unique identifier for the template */
  id: string;
  /** Display name */
  name: string;
  /** Detailed description of what the contract does */
  description: string;
  /** Template category */
  category: TemplateCategory;
  /** Difficulty level */
  difficulty: TemplateDifficulty;
  /** Chain IDs this template is compatible with */
  chains: string[];
  /** Primary programming language */
  language: ContractLanguage;
  /** Source files included in the template */
  files: TemplateFile[];
  /** NPM dependencies required (e.g., "@openzeppelin/contracts") */
  dependencies?: string[];
  /** Searchable tags */
  tags: string[];
  /** Author name or handle */
  author: string;
  /** Template version */
  version: string;
  /** Audit status */
  audited: AuditStatus;
  /** Estimated gas for deployment (if applicable) */
  gasEstimate?: string;
  /** Link to related tutorial (tutorial ID) */
  tutorial?: string;
  /** Example prompts for AI generation */
  examplePrompts?: string[];
  /** Security considerations for this template */
  securityNotes?: string[];
  /** Gas optimization tips */
  gasOptimizations?: string[];
  /** Date when template was last updated */
  lastUpdated: string;
  /** Whether this template is featured */
  featured?: boolean;
  /** External documentation URL */
  docsUrl?: string;
}

// =============================================================================
// UI STATE TYPES
// =============================================================================

/**
 * View mode for template listing
 */
export type ViewMode = 'grid' | 'list';

/**
 * Sort options for templates
 */
export type SortOption = 'name' | 'difficulty' | 'category' | 'updated' | 'popularity';

/**
 * Filter state for template browser
 */
export interface TemplateFilters {
  /** Search query string */
  search: string;
  /** Selected categories (empty = all) */
  categories: TemplateCategory[];
  /** Selected difficulty levels (empty = all) */
  difficulties: TemplateDifficulty[];
  /** Selected chains (empty = all) */
  chains: string[];
  /** Selected language */
  language?: ContractLanguage;
  /** Show only audited templates */
  auditedOnly: boolean;
  /** Current sort option */
  sortBy: SortOption;
  /** Sort direction */
  sortDirection: 'asc' | 'desc';
}

/**
 * User preferences for templates (stored in localStorage)
 */
export interface TemplatePreferences {
  /** Favorite template IDs */
  favorites: string[];
  /** Recently used template IDs (most recent first) */
  recentlyUsed: string[];
  /** Preferred view mode */
  viewMode: ViewMode;
  /** Preferred chain for new templates */
  preferredChain?: string;
  /** Collapsed categories in sidebar */
  collapsedCategories: TemplateCategory[];
}

/**
 * Chain selector state
 */
export interface ChainSelectorState {
  /** Currently selected chain ID */
  selectedChain: string | null;
  /** Whether to show testnet or mainnet */
  showTestnet: boolean;
  /** Filter by language */
  languageFilter?: ContractLanguage;
}

// =============================================================================
// CATEGORY METADATA
// =============================================================================

/**
 * Metadata for a template category
 */
export interface CategoryInfo {
  /** Category ID */
  id: TemplateCategory;
  /** Display name */
  name: string;
  /** Category description */
  description: string;
  /** Emoji icon */
  icon: string;
  /** Number of templates in this category */
  count?: number;
}

/**
 * Metadata for difficulty levels
 */
export interface DifficultyInfo {
  /** Difficulty level */
  id: TemplateDifficulty;
  /** Display name */
  name: string;
  /** Description */
  description: string;
  /** Color class for badges */
  colorClass: string;
  /** Background color class */
  bgClass: string;
}

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * Category information for UI display
 */
export const CATEGORY_INFO: Record<TemplateCategory, CategoryInfo> = {
  basic: {
    id: 'basic',
    name: 'Basic',
    description: 'Fundamental patterns and starter contracts',
    icon: '📦',
  },
  tokens: {
    id: 'tokens',
    name: 'Tokens',
    description: 'ERC-20 and other fungible token standards',
    icon: '🪙',
  },
  nfts: {
    id: 'nfts',
    name: 'NFTs',
    description: 'ERC-721, ERC-1155 and NFT collections',
    icon: '🖼️',
  },
  defi: {
    id: 'defi',
    name: 'DeFi',
    description: 'Decentralized finance protocols',
    icon: '💰',
  },
  dao: {
    id: 'dao',
    name: 'DAO',
    description: 'Governance and voting systems',
    icon: '🏛️',
  },
  gaming: {
    id: 'gaming',
    name: 'Gaming',
    description: 'Game mechanics and virtual economies',
    icon: '🎮',
  },
  security: {
    id: 'security',
    name: 'Security',
    description: 'Security patterns and access control',
    icon: '🔒',
  },
  utility: {
    id: 'utility',
    name: 'Utility',
    description: 'Helper contracts and utilities',
    icon: '🔧',
  },
};

/**
 * Difficulty information for UI display
 */
export const DIFFICULTY_INFO: Record<TemplateDifficulty, DifficultyInfo> = {
  beginner: {
    id: 'beginner',
    name: 'Beginner',
    description: 'No prior Solidity experience needed',
    colorClass: 'text-green-700 dark:text-green-300',
    bgClass: 'bg-green-100 dark:bg-green-900/30',
  },
  intermediate: {
    id: 'intermediate',
    name: 'Intermediate',
    description: 'Familiarity with Solidity basics required',
    colorClass: 'text-yellow-700 dark:text-yellow-300',
    bgClass: 'bg-yellow-100 dark:bg-yellow-900/30',
  },
  advanced: {
    id: 'advanced',
    name: 'Advanced',
    description: 'Strong Solidity and Web3 knowledge needed',
    colorClass: 'text-orange-700 dark:text-orange-300',
    bgClass: 'bg-orange-100 dark:bg-orange-900/30',
  },
  expert: {
    id: 'expert',
    name: 'Expert',
    description: 'Deep expertise in smart contract architecture',
    colorClass: 'text-red-700 dark:text-red-300',
    bgClass: 'bg-red-100 dark:bg-red-900/30',
  },
};

/**
 * Default template filter state
 */
export const DEFAULT_TEMPLATE_FILTERS: TemplateFilters = {
  search: '',
  categories: [],
  difficulties: [],
  chains: [],
  auditedOnly: false,
  sortBy: 'name',
  sortDirection: 'asc',
};

/**
 * Default template preferences
 */
export const DEFAULT_TEMPLATE_PREFERENCES: TemplatePreferences = {
  favorites: [],
  recentlyUsed: [],
  viewMode: 'grid',
  collapsedCategories: [],
};

// =============================================================================
// UTILITY TYPES
// =============================================================================

/**
 * Result of searching/filtering templates
 */
export interface TemplateSearchResult {
  /** Matching templates */
  templates: ContractTemplate[];
  /** Total count before pagination */
  totalCount: number;
  /** Search/filter took this many ms */
  searchTime: number;
}

/**
 * Template usage analytics
 */
export interface TemplateUsage {
  templateId: string;
  usedAt: string;
  chainId?: string;
  deployed: boolean;
}

/**
 * Props for the ChainSelector component
 */
export interface ChainSelectorProps {
  /** Currently selected chain ID */
  selectedChain: string | null;
  /** Callback when chain selection changes */
  onChainSelect: (chainId: string | null) => void;
  /** Whether to show testnet toggle */
  showTestnetToggle?: boolean;
  /** Whether to show language filter */
  showLanguageFilter?: boolean;
  /** Optional CSS class */
  className?: string;
}

/**
 * Props for the TemplateSelector component
 */
export interface TemplateSelectorProps {
  /** Callback when template is selected */
  onTemplateSelect: (template: ContractTemplate) => void;
  /** Currently selected template */
  selectedTemplate?: ContractTemplate | null;
  /** Optional chain filter */
  chainFilter?: string;
  /** Optional category filter */
  categoryFilter?: TemplateCategory;
  /** Optional CSS class */
  className?: string;
  /** Whether to show as compact (for sidebar) */
  compact?: boolean;
}
