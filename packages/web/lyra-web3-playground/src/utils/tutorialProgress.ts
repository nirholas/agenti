/**
 * ✨ built by nich
 * 🌐 GitHub: github.com/nirholas
 * 💫 Together we build, together we grow 🤝
 */

/**
 * Comprehensive tutorial progress tracking system with localStorage persistence
 */

import type { TutorialProgress, LearningProgress, Achievement, TutorialCategory } from '@/types/tutorials';

/**
 * Tutorial progress interface (re-exported for backward compatibility)
 */
export type { TutorialProgress };

/**
 * Storage keys for different data types
 */
const STORAGE_KEYS = {
  TUTORIAL_PROGRESS: 'lyra-tutorial-progress-v2',
  LEARNING_PROGRESS: 'lyra-learning-progress-v1',
  BOOKMARKS: 'lyra-tutorial-bookmarks-v1',
  ACHIEVEMENTS: 'lyra-achievements-v1'
} as const;

/**
 * Check if we're in a browser environment
 */
const isBrowser = typeof window !== 'undefined';

/**
 * Safe JSON parse with fallback
 */
function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    const data = JSON.parse(raw);
    return typeof data === 'object' && data !== null ? (data as T) : fallback;
  } catch (err) {
    console.warn('JSON parse error:', err);
    return fallback;
  }
}

/**
 * Safe localStorage getter
 */
function getStorage<T>(key: string, fallback: T): T {
  if (!isBrowser) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return safeParse(raw, fallback);
  } catch (err) {
    console.warn('localStorage read error:', err);
    return fallback;
  }
}

/**
 * Safe localStorage setter
 */
function setStorage<T>(key: string, data: T): void {
  if (!isBrowser) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(data));
  } catch (err) {
    console.warn('localStorage write error:', err);
  }
}

/**
 * Progress map type
 */
type ProgressMap = Record<string, TutorialProgress>;

/**
 * Read all tutorial progress records
 */
function readAllProgress(): ProgressMap {
  return getStorage<ProgressMap>(STORAGE_KEYS.TUTORIAL_PROGRESS, {});
}

/**
 * Write all tutorial progress records
 */
function writeAllProgress(data: ProgressMap): void {
  setStorage(STORAGE_KEYS.TUTORIAL_PROGRESS, data);
}

/**
 * Create default progress state for a tutorial
 */
function createDefaultProgress(tutorialId: string): TutorialProgress {
  return {
    tutorialId,
    completedSteps: [],
    completedStepIds: [], // backward compatibility
    currentStepIndex: 0,
    startedAt: new Date().toISOString(),
    completedAt: undefined,
    quizScore: undefined,
    quizAttempts: 0,
    bookmarked: false,
    codeSnapshots: {},
    activeLanguage: undefined,
    notes: '',
    timeSpent: 0
  };
}

/**
 * Get progress for a specific tutorial
 * @param tutorialId - The tutorial ID
 * @returns TutorialProgress object
 */
export function getProgress(tutorialId: string): TutorialProgress {
  const all = readAllProgress();
  if (all[tutorialId]) {
    // Ensure backward compatibility
    const progress = all[tutorialId];
    return {
      ...createDefaultProgress(tutorialId),
      ...progress,
      completedSteps: progress.completedSteps || progress.completedStepIds || [],
      completedStepIds: progress.completedStepIds || progress.completedSteps || []
    };
  }
  return createDefaultProgress(tutorialId);
}

/**
 * Save progress for a specific tutorial
 * @param tutorialId - The tutorial ID
 * @param partial - Partial progress update
 * @returns Updated TutorialProgress object
 */
export function saveProgress(tutorialId: string, partial: Partial<TutorialProgress>): TutorialProgress {
  const all = readAllProgress();
  const existing = all[tutorialId] ?? createDefaultProgress(tutorialId);

  // Sync completedSteps and completedStepIds for backward compatibility
  const completedSteps = partial.completedSteps ?? partial.completedStepIds ?? existing.completedSteps ?? [];
  
  const merged: TutorialProgress = {
    ...existing,
    ...partial,
    tutorialId,
    completedSteps,
    completedStepIds: completedSteps, // Keep in sync
    codeSnapshots: partial.codeSnapshots ?? existing.codeSnapshots ?? {}
  };

  // Update completedAt if all steps completed and not already set
  if (partial.completedAt) {
    merged.completedAt = partial.completedAt as string;
  }

  all[tutorialId] = merged;
  writeAllProgress(all);
  
  // Update learning progress if tutorial completed
  if (merged.completedAt && !existing.completedAt) {
    markTutorialCompleted(tutorialId);
  }

  return merged;
}

/**
 * Clear progress for a specific tutorial
 * @param tutorialId - The tutorial ID to clear
 */
export function clearProgress(tutorialId: string): void {
  const all = readAllProgress();
  if (all[tutorialId]) {
    delete all[tutorialId];
    writeAllProgress(all);
  }
}

/**
 * Clear all tutorial progress
 */
export function clearAllProgress(): void {
  if (isBrowser) {
    Object.values(STORAGE_KEYS).forEach(key => {
      try {
        window.localStorage.removeItem(key);
      } catch (err) {
        console.warn('Failed to clear storage:', err);
      }
    });
  }
}

/**
 * Compute completion percentage for a tutorial
 * @param tutorialId - The tutorial ID
 * @param stepCount - Total number of steps
 * @returns Percentage (0-100)
 */
export function computeCompletionPercent(tutorialId: string, stepCount: number): number {
  if (!stepCount || stepCount <= 0) return 0;
  const progress = getProgress(tutorialId);
  const completed = progress.completedSteps?.length ?? progress.completedStepIds?.length ?? 0;
  return Math.min(100, Math.round((completed / stepCount) * 100));
}

/**
 * Get completion status for a tutorial
 */
export function getTutorialStatus(tutorialId: string, stepCount: number): 'not-started' | 'in-progress' | 'completed' {
  const progress = getProgress(tutorialId);
  const completedCount = progress.completedSteps?.length ?? 0;
  
  if (progress.completedAt || completedCount >= stepCount) {
    return 'completed';
  }
  if (completedCount > 0 || progress.currentStepIndex > 0) {
    return 'in-progress';
  }
  return 'not-started';
}

// ============================================
// Bookmark Management
// ============================================

/**
 * Get all bookmarked tutorial IDs
 */
export function getBookmarkedTutorials(): string[] {
  return getStorage<string[]>(STORAGE_KEYS.BOOKMARKS, []);
}

/**
 * Check if a tutorial is bookmarked
 */
export function isBookmarked(tutorialId: string): boolean {
  const bookmarks = getBookmarkedTutorials();
  return bookmarks.includes(tutorialId);
}

/**
 * Toggle bookmark status for a tutorial
 */
export function toggleBookmark(tutorialId: string): boolean {
  const bookmarks = getBookmarkedTutorials();
  const index = bookmarks.indexOf(tutorialId);
  
  if (index >= 0) {
    bookmarks.splice(index, 1);
    setStorage(STORAGE_KEYS.BOOKMARKS, bookmarks);
    
    // Also update progress
    const progress = getProgress(tutorialId);
    saveProgress(tutorialId, { ...progress, bookmarked: false });
    return false;
  } else {
    bookmarks.push(tutorialId);
    setStorage(STORAGE_KEYS.BOOKMARKS, bookmarks);
    
    // Also update progress
    const progress = getProgress(tutorialId);
    saveProgress(tutorialId, { ...progress, bookmarked: true });
    return true;
  }
}

/**
 * Add a bookmark
 */
export function addBookmark(tutorialId: string): void {
  const bookmarks = getBookmarkedTutorials();
  if (!bookmarks.includes(tutorialId)) {
    bookmarks.push(tutorialId);
    setStorage(STORAGE_KEYS.BOOKMARKS, bookmarks);
    
    const progress = getProgress(tutorialId);
    saveProgress(tutorialId, { ...progress, bookmarked: true });
  }
}

/**
 * Remove a bookmark
 */
export function removeBookmark(tutorialId: string): void {
  const bookmarks = getBookmarkedTutorials();
  const index = bookmarks.indexOf(tutorialId);
  if (index >= 0) {
    bookmarks.splice(index, 1);
    setStorage(STORAGE_KEYS.BOOKMARKS, bookmarks);
    
    const progress = getProgress(tutorialId);
    saveProgress(tutorialId, { ...progress, bookmarked: false });
  }
}

// ============================================
// Learning Progress Management
// ============================================

/**
 * Get default learning progress
 */
function createDefaultLearningProgress(): LearningProgress {
  return {
    completedTutorials: [],
    bookmarkedTutorials: [],
    currentPath: undefined,
    totalTimeSpent: 0,
    streakDays: 0,
    lastActivityDate: new Date().toISOString(),
    achievements: []
  };
}

/**
 * Get overall learning progress
 */
export function getLearningProgress(): LearningProgress {
  return getStorage<LearningProgress>(STORAGE_KEYS.LEARNING_PROGRESS, createDefaultLearningProgress());
}

/**
 * Save learning progress
 */
export function saveLearningProgress(partial: Partial<LearningProgress>): LearningProgress {
  const existing = getLearningProgress();
  const merged: LearningProgress = {
    ...existing,
    ...partial,
    lastActivityDate: new Date().toISOString()
  };
  setStorage(STORAGE_KEYS.LEARNING_PROGRESS, merged);
  return merged;
}

/**
 * Mark a tutorial as completed in learning progress
 */
export function markTutorialCompleted(tutorialId: string): void {
  const progress = getLearningProgress();
  if (!progress.completedTutorials.includes(tutorialId)) {
    progress.completedTutorials.push(tutorialId);
    saveLearningProgress(progress);
    
    // Check for achievements
    checkAchievements(progress);
  }
}

/**
 * Update streak tracking
 */
export function updateStreak(): void {
  const progress = getLearningProgress();
  const today = new Date().toDateString();
  const lastActivity = progress.lastActivityDate ? new Date(progress.lastActivityDate).toDateString() : null;
  
  if (lastActivity === today) {
    // Already recorded today
    return;
  }
  
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  
  if (lastActivity === yesterday.toDateString()) {
    // Continuing streak
    progress.streakDays += 1;
  } else if (lastActivity !== today) {
    // Streak broken
    progress.streakDays = 1;
  }
  
  saveLearningProgress(progress);
}

/**
 * Add time spent on tutorials
 */
export function addTimeSpent(seconds: number): void {
  const progress = getLearningProgress();
  progress.totalTimeSpent += seconds;
  saveLearningProgress(progress);
}

/**
 * Set current learning path
 */
export function setCurrentPath(pathId: string | undefined): void {
  saveLearningProgress({ currentPath: pathId });
}

// ============================================
// Achievements
// ============================================

/**
 * Default achievements list
 */
const DEFAULT_ACHIEVEMENTS: Achievement[] = [
  {
    id: 'first-tutorial',
    name: 'First Steps',
    description: 'Complete your first tutorial',
    icon: '🎯',
    criteria: { type: 'tutorials_completed', value: 1 }
  },
  {
    id: 'five-tutorials',
    name: 'Getting Serious',
    description: 'Complete 5 tutorials',
    icon: '📚',
    criteria: { type: 'tutorials_completed', value: 5 }
  },
  {
    id: 'ten-tutorials',
    name: 'Dedicated Learner',
    description: 'Complete 10 tutorials',
    icon: '🏆',
    criteria: { type: 'tutorials_completed', value: 10 }
  },
  {
    id: 'twenty-tutorials',
    name: 'Web3 Expert',
    description: 'Complete 20 tutorials',
    icon: '👑',
    criteria: { type: 'tutorials_completed', value: 20 }
  },
  {
    id: 'week-streak',
    name: 'Week Warrior',
    description: 'Maintain a 7-day learning streak',
    icon: '🔥',
    criteria: { type: 'streak', value: 7 }
  },
  {
    id: 'month-streak',
    name: 'Monthly Master',
    description: 'Maintain a 30-day learning streak',
    icon: '⭐',
    criteria: { type: 'streak', value: 30 }
  },
  {
    id: 'quiz-master',
    name: 'Quiz Master',
    description: 'Score 100% on any quiz',
    icon: '🧠',
    criteria: { type: 'quiz_score', value: 100 }
  }
];

/**
 * Check and unlock achievements
 */
export function checkAchievements(progress: LearningProgress): Achievement[] {
  const newlyUnlocked: Achievement[] = [];
  const now = new Date().toISOString();
  
  DEFAULT_ACHIEVEMENTS.forEach(achievement => {
    // Skip if already unlocked
    const existing = progress.achievements.find(a => a.id === achievement.id);
    if (existing?.unlockedAt) return;
    
    let unlocked = false;
    
    switch (achievement.criteria.type) {
      case 'tutorials_completed':
        unlocked = progress.completedTutorials.length >= achievement.criteria.value;
        break;
      case 'streak':
        unlocked = progress.streakDays >= achievement.criteria.value;
        break;
      default:
        break;
    }
    
    if (unlocked) {
      const unlockedAchievement = { ...achievement, unlockedAt: now };
      progress.achievements.push(unlockedAchievement);
      newlyUnlocked.push(unlockedAchievement);
    }
  });
  
  if (newlyUnlocked.length > 0) {
    saveLearningProgress(progress);
  }
  
  return newlyUnlocked;
}

/**
 * Get all achievements with unlock status
 */
export function getAllAchievements(): Achievement[] {
  const progress = getLearningProgress();
  
  return DEFAULT_ACHIEVEMENTS.map(achievement => {
    const unlocked = progress.achievements.find(a => a.id === achievement.id);
    return unlocked ? { ...achievement, unlockedAt: unlocked.unlockedAt } : achievement;
  });
}

// ============================================
// Quiz Progress
// ============================================

/**
 * Save quiz attempt result
 */
export function saveQuizResult(tutorialId: string, score: number, totalQuestions: number): void {
  const progress = getProgress(tutorialId);
  const percentage = Math.round((score / totalQuestions) * 100);
  
  saveProgress(tutorialId, {
    quizScore: percentage,
    quizAttempts: (progress.quizAttempts ?? 0) + 1
  });
  
  // Check for quiz achievement
  if (percentage === 100) {
    const learningProgress = getLearningProgress();
    const quizAchievement = DEFAULT_ACHIEVEMENTS.find(a => a.id === 'quiz-master');
    if (quizAchievement && !learningProgress.achievements.find(a => a.id === 'quiz-master')) {
      learningProgress.achievements.push({
        ...quizAchievement,
        unlockedAt: new Date().toISOString()
      });
      saveLearningProgress(learningProgress);
    }
  }
}

// ============================================
// Statistics
// ============================================

/**
 * Get learning statistics
 */
export function getLearningStats(): {
  totalCompleted: number;
  totalBookmarked: number;
  totalTimeSpent: string;
  currentStreak: number;
  achievementsUnlocked: number;
  totalAchievements: number;
} {
  const progress = getLearningProgress();
  const bookmarks = getBookmarkedTutorials();
  
  // Format time spent
  const hours = Math.floor(progress.totalTimeSpent / 3600);
  const minutes = Math.floor((progress.totalTimeSpent % 3600) / 60);
  const timeSpent = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  
  return {
    totalCompleted: progress.completedTutorials.length,
    totalBookmarked: bookmarks.length,
    totalTimeSpent: timeSpent,
    currentStreak: progress.streakDays,
    achievementsUnlocked: progress.achievements.filter(a => a.unlockedAt).length,
    totalAchievements: DEFAULT_ACHIEVEMENTS.length
  };
}

/**
 * Get tutorials in progress (started but not completed)
 */
export function getTutorialsInProgress(): string[] {
  const all = readAllProgress();
  const completed = getLearningProgress().completedTutorials;
  
  return Object.keys(all).filter(tutorialId => {
    const progress = all[tutorialId];
    const hasProgress = (progress.completedSteps?.length ?? 0) > 0 || progress.currentStepIndex > 0;
    return hasProgress && !completed.includes(tutorialId);
  });
}

/**
 * Get recently accessed tutorials
 */
export function getRecentTutorials(limit: number = 5): string[] {
  const all = readAllProgress();
  
  return Object.entries(all)
    .sort((a, b) => {
      const dateA = a[1].startedAt ? new Date(a[1].startedAt).getTime() : 0;
      const dateB = b[1].startedAt ? new Date(b[1].startedAt).getTime() : 0;
      return dateB - dateA;
    })
    .slice(0, limit)
    .map(([id]) => id);
}
