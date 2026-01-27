/**
 * Trust Score Algorithm - Ported from SperaxOS
 * 
 * This module calculates trust scores for tools in the Lyra Registry.
 * Original source: SperaxOS/src/features/MCP/calculateScore.ts
 * 
 * Grades:
 * - A: 80%+ with all required items
 * - B: 60-79% with all required items  
 * - F: <60% or missing required items
 */

export interface ScoreItem {
  check: boolean;
  required?: boolean;
  weight?: number;
}

export interface ScoreResult {
  grade: 'a' | 'b' | 'f';
  maxRequiredScore: number;
  maxScore: number;
  percentage: number;
  requiredPercentage: number;
  requiredScore: number;
  totalScore: number;
}

export interface ScoreListItem extends ScoreItem {
  desc: string;
  key: string;
  title: string;
}

export interface ScoreFlags {
  hasClaimed: boolean;
  hasDeployMoreThanManual: boolean;
  hasDeployment: boolean;
  hasLicense: boolean;
  hasPrompts: boolean;
  hasReadme: boolean;
  hasResources: boolean;
  hasTools: boolean;
  hasValidated: boolean;
}

/**
 * Default weights for scoring - from SperaxOS
 * Higher weight = more important for trust score
 */
export const DEFAULT_WEIGHTS: Record<string, number> = {
  validated: 20,      // Is validated/verified - highest priority
  tools: 15,          // Has tools defined
  deployment: 15,     // Has deployment options
  deployMoreThanManual: 12,  // Has automated deployment
  readme: 10,         // Has documentation
  license: 8,         // Has license
  prompts: 8,         // Has prompts
  resources: 8,       // Has resources
  claimed: 4,         // Is claimed by developer
};

/**
 * Calculate score flags from tool data
 */
export function calculateScoreFlags(data: {
  isValidated?: boolean;
  hasTools?: boolean;
  hasDeployment?: boolean;
  hasDeployMoreThanManual?: boolean;
  hasReadme?: boolean;
  hasLicense?: boolean;
  hasPrompts?: boolean;
  hasResources?: boolean;
  isClaimed?: boolean;
}): ScoreFlags {
  return {
    hasValidated: Boolean(data.isValidated),
    hasTools: Boolean(data.hasTools),
    hasDeployment: Boolean(data.hasDeployment),
    hasDeployMoreThanManual: Boolean(data.hasDeployMoreThanManual),
    hasReadme: Boolean(data.hasReadme),
    hasLicense: Boolean(data.hasLicense),
    hasPrompts: Boolean(data.hasPrompts),
    hasResources: Boolean(data.hasResources),
    hasClaimed: Boolean(data.isClaimed),
  };
}

/**
 * Create score items from score flags
 */
export function createScoreItems(flags: ScoreFlags): Record<string, ScoreItem> {
  return {
    validated: { check: flags.hasValidated, required: true },
    tools: { check: flags.hasTools, required: true },
    deployment: { check: flags.hasDeployment, required: true },
    readme: { check: flags.hasReadme, required: true },
    deployMoreThanManual: { check: flags.hasDeployMoreThanManual },
    license: { check: flags.hasLicense },
    prompts: { check: flags.hasPrompts },
    resources: { check: flags.hasResources },
    claimed: { check: flags.hasClaimed },
  };
}

/**
 * Calculate the total score and grade
 * Ported from SperaxOS calculateScore function
 */
export function calculateScore(
  items: Record<string, ScoreItem>,
  weights: Record<string, number> = DEFAULT_WEIGHTS
): ScoreResult {
  let totalScore = 0;
  let maxScore = 0;
  let requiredScore = 0;
  let maxRequiredScore = 0;

  // Calculate actual score and maximum possible score
  Object.entries(items).forEach(([key, item]) => {
    const weight = weights[key] || 5; // Default weight is 5
    maxScore += weight;

    if (item.required) {
      maxRequiredScore += weight;
      if (item.check) {
        requiredScore += weight;
      }
    }

    if (item.check) {
      totalScore += weight;
    }
  });

  const percentage = maxScore > 0 ? (totalScore / maxScore) * 100 : 0;
  const requiredPercentage = maxRequiredScore > 0 ? (requiredScore / maxRequiredScore) * 100 : 0;

  // Grade calculation logic
  let grade: 'a' | 'b' | 'f';

  // If required items are not all met, grade is F
  if (requiredPercentage < 100) {
    grade = 'f';
  } else {
    // All required items met - grade based on total percentage
    if (percentage >= 80) {
      grade = 'a'; // 80% or above = A
    } else if (percentage >= 60) {
      grade = 'b'; // 60-79% = B
    } else {
      grade = 'f'; // Below 60% = F
    }
  }

  return {
    grade,
    maxRequiredScore,
    maxScore,
    percentage: Math.round(percentage),
    requiredPercentage: Math.round(requiredPercentage),
    requiredScore,
    totalScore,
  };
}

/**
 * Get color for grade display
 */
export function getGradeColor(grade: string): string {
  switch (grade) {
    case 'a':
      return '#52c41a'; // Green
    case 'b':
      return '#faad14'; // Orange/Yellow
    case 'f':
      return '#ff4d4f'; // Red
    default:
      return '#8c8c8c'; // Gray
  }
}

/**
 * Get display label for grade
 */
export function getGradeLabel(grade: string): string {
  switch (grade) {
    case 'a':
      return 'Excellent';
    case 'b':
      return 'Good';
    case 'f':
      return 'Needs Improvement';
    default:
      return 'Unknown';
  }
}

/**
 * Calculate tool score from raw tool data
 * Convenience wrapper for registry tools
 */
export function calculateToolScore(tool: {
  isValidated?: boolean;
  hasTools?: boolean;
  hasDeployment?: boolean;
  hasDeployMoreThanManual?: boolean;
  hasReadme?: boolean;
  hasLicense?: boolean;
  hasPrompts?: boolean;
  hasResources?: boolean;
  isClaimed?: boolean;
}): ScoreResult {
  const flags = calculateScoreFlags(tool);
  const scoreItems = createScoreItems(flags);
  return calculateScore(scoreItems);
}

/**
 * Create a detailed score breakdown for display
 */
export function createScoreBreakdown(flags: ScoreFlags): ScoreListItem[] {
  const items = createScoreItems(flags);
  
  const descriptions: Record<string, { title: string; desc: string }> = {
    validated: {
      title: 'Validated',
      desc: 'Tool has been verified by the Lyra team',
    },
    tools: {
      title: 'Has Tools',
      desc: 'Tool definitions are properly specified',
    },
    deployment: {
      title: 'Has Deployment',
      desc: 'Deployment options are available',
    },
    deployMoreThanManual: {
      title: 'Automated Deployment',
      desc: 'Has automated deployment options beyond manual',
    },
    readme: {
      title: 'Documentation',
      desc: 'README or documentation is provided',
    },
    license: {
      title: 'License',
      desc: 'Open source license is specified',
    },
    prompts: {
      title: 'Prompts',
      desc: 'Prompt templates are included',
    },
    resources: {
      title: 'Resources',
      desc: 'Additional resources are provided',
    },
    claimed: {
      title: 'Claimed',
      desc: 'Tool is claimed by its developer',
    },
  };

  return Object.entries(items).map(([key, item]) => ({
    key,
    ...item,
    weight: DEFAULT_WEIGHTS[key] || 5,
    title: descriptions[key]?.title || key,
    desc: descriptions[key]?.desc || '',
  }));
}
