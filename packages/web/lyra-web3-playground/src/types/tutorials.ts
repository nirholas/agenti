/**
 * ✨ built by nich
 * 🌐 GitHub: github.com/nirholas
 * 💫 Crafting digital magic since day one ✨
 */

/**
 * Comprehensive TypeScript types for the Tutorial System
 */

/**
 * Tutorial difficulty levels
 */
export type TutorialDifficulty = 'beginner' | 'intermediate' | 'advanced' | 'expert';

/**
 * Tutorial category types covering all aspects of Web3 development
 */
export type TutorialCategory =
  | 'getting-started'
  | 'solidity-basics'
  | 'solidity-advanced'
  | 'web3-frontend'
  | 'defi'
  | 'nfts'
  | 'security'
  | 'testing'
  | 'deployment'
  | 'tooling'
  | 'chains';

/**
 * Category metadata for display and filtering
 */
export interface CategoryInfo {
  id: TutorialCategory;
  name: string;
  description: string;
  icon: string;
  color: string;
}

/**
 * Code example with multiple language support
 */
export interface CodeExample {
  language: string;
  code: string;
  editable: boolean;
  runnable: boolean;
  filename?: string;
}

/**
 * Checkpoint for knowledge verification within a step
 */
export interface Checkpoint {
  question: string;
  answer: string;
  hints?: string[];
}

/**
 * Challenge with solution for hands-on practice
 */
export interface StepChallenge {
  prompt: string;
  solution: string;
  hints: string[];
  difficulty?: TutorialDifficulty;
}

/**
 * Single step within a tutorial
 */
export interface TutorialStep {
  id: string;
  title: string;
  type: 'text' | 'code' | 'interactive' | 'video' | 'quiz';
  content: string; // Markdown content
  code?: CodeExample | Record<string, string>; // Can be single example or multi-language
  checkpoint?: Checkpoint;
  challenge?: StepChallenge;
  expectedOutput?: string;
  hints?: string[];
  explanation?: string;
  videoUrl?: string;
  duration?: string; // Estimated time for this step
}

/**
 * Quiz question types
 */
export type QuizQuestionType = 'multiple-choice' | 'true-false' | 'code-completion' | 'fill-blank';

/**
 * Quiz question structure
 */
export interface QuizQuestion {
  id: string;
  type: QuizQuestionType;
  question: string;
  options?: string[];
  correctAnswer: string | number;
  explanation: string;
  points: number;
  code?: string; // Optional code snippet for context
}

/**
 * Project specification for project-based tutorials
 */
export interface ProjectSpec {
  name: string;
  description: string;
  objectives: string[];
  starterCode?: Record<string, string>; // filename -> code
  solutionCode?: Record<string, string>;
  testCases?: Array<{
    name: string;
    input: string;
    expectedOutput: string;
  }>;
}

/**
 * Learning path definition
 */
export interface LearningPath {
  id: string;
  name: string;
  description: string;
  tutorialIds: string[];
  difficulty: TutorialDifficulty;
  estimatedDuration: string;
  icon: string;
  color: string;
}

/**
 * Complete tutorial structure
 */
export interface Tutorial {
  id: string;
  title: string;
  description: string;
  category: TutorialCategory;
  difficulty: TutorialDifficulty;
  duration: string; // e.g., "15 mins", "1 hour"
  chain?: string; // If chain-specific (ethereum, solana, base, etc.)
  prerequisites?: string[]; // Tutorial IDs
  tags: string[];
  author: string;
  lastUpdated: string; // ISO date string
  content: TutorialStep[];
  steps: TutorialStep[]; // Alias for content (backward compatibility)
  quiz?: QuizQuestion[];
  project?: ProjectSpec;
  languages: string[]; // ['solidity', 'typescript', 'javascript', 'react']
  estimatedTime?: string; // Backward compatibility
  featured?: boolean;
  order?: number; // For sorting within category
}

/**
 * User's progress on a single tutorial
 */
export interface TutorialProgress {
  tutorialId: string;
  completedSteps: string[];
  completedStepIds?: string[]; // Alias for backward compatibility
  currentStepIndex: number;
  startedAt: string; // ISO date string
  completedAt?: string; // ISO date string
  quizScore?: number;
  quizAttempts?: number;
  bookmarked: boolean;
  codeSnapshots?: Record<string, Record<string, string>>; // stepId -> language -> code
  activeLanguage?: string;
  notes?: string; // User notes for this tutorial
  timeSpent?: number; // Time in seconds
}

/**
 * User's overall learning progress
 */
export interface LearningProgress {
  completedTutorials: string[];
  bookmarkedTutorials: string[];
  currentPath?: string; // Learning path ID
  totalTimeSpent: number; // Seconds
  streakDays: number;
  lastActivityDate: string;
  achievements: Achievement[];
}

/**
 * Achievement/badge definition
 */
export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  unlockedAt?: string;
  criteria: {
    type: 'tutorials_completed' | 'category_mastered' | 'quiz_score' | 'streak';
    value: number;
    category?: TutorialCategory;
  };
}

/**
 * Filter options for tutorial browser
 */
export interface TutorialFilters {
  search: string;
  category: TutorialCategory | 'all';
  difficulty: TutorialDifficulty | 'all';
  chain: string | 'all';
  duration: 'short' | 'medium' | 'long' | 'all'; // <15min, 15-45min, >45min
  status: 'all' | 'not-started' | 'in-progress' | 'completed';
  bookmarked: boolean;
}

/**
 * Sort options for tutorial browser
 */
export type TutorialSortOption = 
  | 'difficulty-asc'
  | 'difficulty-desc'
  | 'duration-asc'
  | 'duration-desc'
  | 'newest'
  | 'oldest'
  | 'alphabetical'
  | 'popularity';

/**
 * Category information with metadata
 */
export const TUTORIAL_CATEGORIES: CategoryInfo[] = [
  {
    id: 'getting-started',
    name: 'Getting Started',
    description: 'Introduction to Web3 and blockchain fundamentals',
    icon: '🚀',
    color: 'blue'
  },
  {
    id: 'solidity-basics',
    name: 'Solidity Basics',
    description: 'Learn the fundamentals of Solidity smart contract development',
    icon: '📝',
    color: 'purple'
  },
  {
    id: 'solidity-advanced',
    name: 'Solidity Advanced',
    description: 'Advanced patterns and optimization techniques',
    icon: '⚡',
    color: 'indigo'
  },
  {
    id: 'web3-frontend',
    name: 'Web3 Frontend',
    description: 'Build dApp frontends with ethers.js and React',
    icon: '🎨',
    color: 'cyan'
  },
  {
    id: 'defi',
    name: 'DeFi',
    description: 'Decentralized finance protocols and concepts',
    icon: '💰',
    color: 'green'
  },
  {
    id: 'nfts',
    name: 'NFTs',
    description: 'Non-fungible tokens and digital collectibles',
    icon: '🖼️',
    color: 'pink'
  },
  {
    id: 'security',
    name: 'Security',
    description: 'Smart contract security and audit practices',
    icon: '🔒',
    color: 'red'
  },
  {
    id: 'testing',
    name: 'Testing & Deployment',
    description: 'Testing frameworks and deployment strategies',
    icon: '🧪',
    color: 'yellow'
  },
  {
    id: 'deployment',
    name: 'Deployment',
    description: 'Deploy and verify contracts on various networks',
    icon: '🚀',
    color: 'orange'
  },
  {
    id: 'tooling',
    name: 'Tooling',
    description: 'Development tools and workflow optimization',
    icon: '🔧',
    color: 'gray'
  },
  {
    id: 'chains',
    name: 'Chain-Specific',
    description: 'Tutorials for specific blockchain networks',
    icon: '⛓️',
    color: 'teal'
  }
];

/**
 * Predefined learning paths
 */
export const LEARNING_PATHS: LearningPath[] = [
  {
    id: 'web3-beginner',
    name: 'Web3 Beginner Path',
    description: 'Start your Web3 journey from zero to deploying your first smart contract',
    tutorialIds: [
      'intro-web3',
      'setup-environment',
      'first-wallet',
      'blockchain-basics',
      'ethereum-101',
      'first-transaction',
      'solidity-intro',
      'variables-types'
    ],
    difficulty: 'beginner',
    estimatedDuration: '4 hours',
    icon: '🌱',
    color: 'green'
  },
  {
    id: 'smart-contract-developer',
    name: 'Smart Contract Developer',
    description: 'Master Solidity development from basics to advanced patterns',
    tutorialIds: [
      'solidity-intro',
      'variables-types',
      'functions-modifiers',
      'control-flow',
      'arrays-mappings',
      'structs-enums',
      'events-logging',
      'inheritance',
      'error-handling',
      'gas-optimization',
      'design-patterns',
      'upgradeable'
    ],
    difficulty: 'intermediate',
    estimatedDuration: '8 hours',
    icon: '📜',
    color: 'purple'
  },
  {
    id: 'defi-developer',
    name: 'DeFi Developer',
    description: 'Build decentralized finance applications',
    tutorialIds: [
      'defi-concepts',
      'build-vault',
      'build-staking',
      'integrate-oracle',
      'flash-loans',
      'lp-tokens'
    ],
    difficulty: 'advanced',
    estimatedDuration: '6 hours',
    icon: '💎',
    color: 'cyan'
  },
  {
    id: 'nft-creator',
    name: 'NFT Creator Path',
    description: 'Create and launch your own NFT collection',
    tutorialIds: [
      'nft-basics',
      'build-collection',
      'nft-marketplace',
      'dynamic-nfts',
      'nft-gaming'
    ],
    difficulty: 'intermediate',
    estimatedDuration: '5 hours',
    icon: '🎨',
    color: 'pink'
  },
  {
    id: 'security-auditor',
    name: 'Security Auditor Path',
    description: 'Learn to identify and prevent smart contract vulnerabilities',
    tutorialIds: [
      'common-vulnerabilities',
      'reentrancy',
      'access-control',
      'audit-checklist',
      'formal-verification'
    ],
    difficulty: 'advanced',
    estimatedDuration: '5 hours',
    icon: '🛡️',
    color: 'red'
  },
  {
    id: 'fullstack-web3',
    name: 'Full-Stack Web3 Developer',
    description: 'Build complete dApps with frontend and smart contracts',
    tutorialIds: [
      'solidity-intro',
      'variables-types',
      'functions-modifiers',
      'ethers-intro',
      'wallet-connect',
      'read-contracts',
      'write-contracts',
      'react-hooks',
      'wagmi-tutorial',
      'transaction-ux'
    ],
    difficulty: 'intermediate',
    estimatedDuration: '10 hours',
    icon: '🏗️',
    color: 'blue'
  }
];

/**
 * Difficulty color mapping for UI
 */
export const DIFFICULTY_COLORS: Record<TutorialDifficulty, { bg: string; text: string; border: string }> = {
  beginner: {
    bg: 'bg-green-100 dark:bg-green-900/30',
    text: 'text-green-800 dark:text-green-200',
    border: 'border-green-200 dark:border-green-800'
  },
  intermediate: {
    bg: 'bg-yellow-100 dark:bg-yellow-900/30',
    text: 'text-yellow-800 dark:text-yellow-200',
    border: 'border-yellow-200 dark:border-yellow-800'
  },
  advanced: {
    bg: 'bg-orange-100 dark:bg-orange-900/30',
    text: 'text-orange-800 dark:text-orange-200',
    border: 'border-orange-200 dark:border-orange-800'
  },
  expert: {
    bg: 'bg-red-100 dark:bg-red-900/30',
    text: 'text-red-800 dark:text-red-200',
    border: 'border-red-200 dark:border-red-800'
  }
};

/**
 * Duration parsing utilities
 */
export function parseDuration(duration: string): number {
  const match = duration.match(/(\d+)\s*(min|hour|hr|h|m)/i);
  if (!match) return 0;
  
  const value = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();
  
  if (unit.startsWith('h')) {
    return value * 60;
  }
  return value;
}

/**
 * Get duration category for filtering
 */
export function getDurationCategory(duration: string): 'short' | 'medium' | 'long' {
  const minutes = parseDuration(duration);
  if (minutes <= 15) return 'short';
  if (minutes <= 45) return 'medium';
  return 'long';
}

/**
 * Format duration for display
 */
export function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMins = minutes % 60;
  if (remainingMins === 0) {
    return `${hours} hour${hours > 1 ? 's' : ''}`;
  }
  return `${hours}h ${remainingMins}m`;
}
