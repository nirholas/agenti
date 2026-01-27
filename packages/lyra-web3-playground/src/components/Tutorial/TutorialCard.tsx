/**
 * ✨ built by nich
 * 🌐 GitHub: github.com/nirholas
 * 💫 Trust the process, enjoy the journey 🎢
 */

/**
 * Reusable tutorial card component with difficulty badges, progress indicators, and bookmarking
 */

import { Link } from 'react-router-dom';
import {
  BookOpen,
  Clock,
  Code,
  Bookmark,
  BookmarkCheck,
  CheckCircle,
  PlayCircle,
  Lock,
  ChevronRight
} from 'lucide-react';
import type { Tutorial, TutorialDifficulty } from '@/types/tutorials';
import { DIFFICULTY_COLORS, TUTORIAL_CATEGORIES } from '@/types/tutorials';
import { 
  computeCompletionPercent, 
  isBookmarked, 
  toggleBookmark,
  getTutorialStatus
} from '@/utils/tutorialProgress';
import { useState, useCallback } from 'react';

/**
 * Props for TutorialCard component
 */
interface TutorialCardProps {
  tutorial: Tutorial;
  variant?: 'default' | 'compact' | 'featured';
  showProgress?: boolean;
  showBookmark?: boolean;
  showPrerequisites?: boolean;
  onBookmarkChange?: (tutorialId: string, bookmarked: boolean) => void;
}

/**
 * Get difficulty badge styling
 */
function getDifficultyBadge(difficulty: TutorialDifficulty) {
  const colors = DIFFICULTY_COLORS[difficulty];
  return `${colors.bg} ${colors.text} ${colors.border}`;
}

/**
 * Get category info
 */
function getCategoryInfo(categoryId: string) {
  return TUTORIAL_CATEGORIES.find(c => c.id === categoryId) ?? {
    id: categoryId,
    name: categoryId,
    icon: '📚',
    color: 'gray',
    description: ''
  };
}

/**
 * Format duration for display
 */
function formatDuration(duration: string): string {
  return duration || '15 min';
}

/**
 * TutorialCard component
 * Displays a single tutorial with progress, difficulty, and interactive features
 */
export default function TutorialCard({
  tutorial,
  variant = 'default',
  showProgress = true,
  showBookmark = true,
  showPrerequisites = false,
  onBookmarkChange
}: TutorialCardProps) {
  const [bookmarked, setBookmarked] = useState(() => isBookmarked(tutorial.id));
  
  const stepCount = tutorial.steps?.length || tutorial.content?.length || 0;
  const completionPercent = showProgress ? computeCompletionPercent(tutorial.id, stepCount) : 0;
  const status = getTutorialStatus(tutorial.id, stepCount);
  const categoryInfo = getCategoryInfo(tutorial.category);
  const difficultyClass = getDifficultyBadge(tutorial.difficulty);

  const handleBookmarkClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const newState = toggleBookmark(tutorial.id);
    setBookmarked(newState);
    onBookmarkChange?.(tutorial.id, newState);
  }, [tutorial.id, onBookmarkChange]);

  // Compact variant for sidebars and lists
  if (variant === 'compact') {
    return (
      <Link
        to={`/tutorial/${tutorial.id}`}
        className="flex items-center gap-3 p-3 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-primary-300 dark:hover:border-primary-600 transition-all group"
      >
        <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-lg">
          {categoryInfo.icon}
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-gray-900 dark:text-white truncate group-hover:text-primary-600 dark:group-hover:text-primary-400">
            {tutorial.title}
          </h4>
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <span className={`px-1.5 py-0.5 rounded ${difficultyClass}`}>
              {tutorial.difficulty}
            </span>
            <span>•</span>
            <span>{formatDuration(tutorial.duration || tutorial.estimatedTime || '')}</span>
          </div>
        </div>
        {status === 'completed' && (
          <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
        )}
        {status === 'in-progress' && completionPercent > 0 && (
          <div className="w-8 h-8 flex-shrink-0">
            <svg className="transform -rotate-90 w-8 h-8">
              <circle
                cx="16"
                cy="16"
                r="12"
                stroke="currentColor"
                strokeWidth="3"
                fill="none"
                className="text-gray-200 dark:text-gray-700"
              />
              <circle
                cx="16"
                cy="16"
                r="12"
                stroke="currentColor"
                strokeWidth="3"
                fill="none"
                strokeDasharray={75.4}
                strokeDashoffset={75.4 * (1 - completionPercent / 100)}
                className="text-primary-500"
              />
            </svg>
          </div>
        )}
      </Link>
    );
  }

  // Featured variant for hero sections
  if (variant === 'featured') {
    return (
      <Link
        to={`/tutorial/${tutorial.id}`}
        className="relative block overflow-hidden rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 text-white p-6 hover:shadow-xl transition-all group"
      >
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: 'url("data:image/svg+xml,%3Csvg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"%3E%3Cg fill="white" fill-opacity="1"%3E%3Cpolygon points="0 0 20 0 10 10"/%3E%3C/g%3E%3C/svg%3E")',
            backgroundSize: '20px 20px'
          }} />
        </div>

        {/* Bookmark button */}
        {showBookmark && (
          <button
            onClick={handleBookmarkClick}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/20 hover:bg-white/30 transition-colors z-10"
            aria-label={bookmarked ? 'Remove bookmark' : 'Add bookmark'}
          >
            {bookmarked ? (
              <BookmarkCheck className="w-5 h-5" />
            ) : (
              <Bookmark className="w-5 h-5" />
            )}
          </button>
        )}

        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-2xl">{categoryInfo.icon}</span>
            <span className="px-2 py-1 text-xs font-medium bg-white/20 rounded-full">
              {tutorial.difficulty}
            </span>
            {tutorial.featured && (
              <span className="px-2 py-1 text-xs font-medium bg-yellow-400/30 text-yellow-100 rounded-full">
                Featured
              </span>
            )}
          </div>

          <h3 className="text-2xl font-bold mb-2 group-hover:underline">
            {tutorial.title}
          </h3>

          <p className="text-white/80 mb-4 line-clamp-2">
            {tutorial.description}
          </p>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 text-sm text-white/70">
              <div className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                <span>{formatDuration(tutorial.duration || tutorial.estimatedTime || '')}</span>
              </div>
              <div className="flex items-center gap-1">
                <BookOpen className="w-4 h-4" />
                <span>{stepCount} steps</span>
              </div>
            </div>

            {status === 'completed' ? (
              <div className="flex items-center gap-1 text-green-300">
                <CheckCircle className="w-5 h-5" />
                <span className="text-sm font-medium">Completed</span>
              </div>
            ) : status === 'in-progress' ? (
              <div className="flex items-center gap-2">
                <div className="w-24 h-2 bg-white/30 rounded-full">
                  <div
                    className="h-full bg-white rounded-full transition-all"
                    style={{ width: `${completionPercent}%` }}
                  />
                </div>
                <span className="text-sm">{completionPercent}%</span>
              </div>
            ) : (
              <div className="flex items-center gap-1 text-white/90">
                <PlayCircle className="w-5 h-5" />
                <span className="text-sm font-medium">Start</span>
              </div>
            )}
          </div>
        </div>
      </Link>
    );
  }

  // Default variant
  return (
    <Link
      to={`/tutorial/${tutorial.id}`}
      className="group block bg-white dark:bg-gray-800 rounded-lg shadow-sm hover:shadow-md border border-gray-200 dark:border-gray-700 hover:border-primary-300 dark:hover:border-primary-600 transition-all overflow-hidden"
    >
      {/* Card Header */}
      <div className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-primary-50 dark:bg-primary-900/30 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
              {categoryInfo.icon}
            </div>
            <div>
              <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${difficultyClass}`}>
                {tutorial.difficulty}
              </span>
              {tutorial.chain && (
                <span className="ml-1.5 inline-block px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                  {tutorial.chain}
                </span>
              )}
            </div>
          </div>

          {showBookmark && (
            <button
              onClick={handleBookmarkClick}
              className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              aria-label={bookmarked ? 'Remove bookmark' : 'Add bookmark'}
            >
              {bookmarked ? (
                <BookmarkCheck className="w-5 h-5 text-primary-500" />
              ) : (
                <Bookmark className="w-5 h-5 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300" />
              )}
            </button>
          )}
        </div>

        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
          {tutorial.title}
        </h3>

        <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mb-4">
          {tutorial.description}
        </p>

        {/* Meta info */}
        <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400 mb-4">
          <div className="flex items-center gap-1">
            <Clock className="w-4 h-4" />
            <span>{formatDuration(tutorial.duration || tutorial.estimatedTime || '')}</span>
          </div>
          <div className="flex items-center gap-1">
            <BookOpen className="w-4 h-4" />
            <span>{stepCount} steps</span>
          </div>
          {tutorial.quiz && tutorial.quiz.length > 0 && (
            <div className="flex items-center gap-1">
              <Code className="w-4 h-4" />
              <span>Quiz</span>
            </div>
          )}
        </div>

        {/* Tags */}
        {tutorial.tags && tutorial.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {tutorial.tags.slice(0, 4).map((tag, index) => (
              <span
                key={index}
                className="px-2 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded"
              >
                {tag}
              </span>
            ))}
            {tutorial.tags.length > 4 && (
              <span className="text-xs text-gray-500 dark:text-gray-400">
                +{tutorial.tags.length - 4}
              </span>
            )}
          </div>
        )}

        {/* Languages */}
        {tutorial.languages && tutorial.languages.length > 0 && (
          <div className="flex items-center gap-2 mb-4">
            {tutorial.languages.slice(0, 3).map((lang, index) => (
              <span
                key={index}
                className="px-2 py-1 text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded"
              >
                {lang === 'solidity' ? '⚡ Solidity' :
                 lang === 'typescript' ? 'TS' :
                 lang === 'javascript' ? 'JS' :
                 lang === 'react' ? '⚛️ React' :
                 lang}
              </span>
            ))}
            {tutorial.languages.length > 3 && (
              <span className="text-xs text-gray-500 dark:text-gray-400">
                +{tutorial.languages.length - 3}
              </span>
            )}
          </div>
        )}

        {/* Prerequisites */}
        {showPrerequisites && tutorial.prerequisites && tutorial.prerequisites.length > 0 && (
          <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
              <Lock className="w-3 h-3" />
              <span>Requires: {tutorial.prerequisites.join(', ')}</span>
            </div>
          </div>
        )}
      </div>

      {/* Card Footer with Progress */}
      {showProgress && (
        <div className="px-5 py-3 bg-gray-50 dark:bg-gray-700/50 border-t border-gray-200 dark:border-gray-600">
          <div className="flex items-center justify-between">
            {status === 'completed' ? (
              <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                <CheckCircle className="w-4 h-4" />
                <span className="text-sm font-medium">Completed</span>
              </div>
            ) : status === 'in-progress' ? (
              <div className="flex items-center gap-3 flex-1">
                <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-600 rounded-full">
                  <div
                    className="h-full bg-primary-500 rounded-full transition-all"
                    style={{ width: `${completionPercent}%` }}
                  />
                </div>
                <span className="text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">
                  {completionPercent}%
                </span>
              </div>
            ) : (
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Not started
              </span>
            )}

            <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-primary-500 group-hover:translate-x-1 transition-all ml-2" />
          </div>
        </div>
      )}
    </Link>
  );
}

/**
 * Skeleton loader for TutorialCard
 */
export function TutorialCardSkeleton({ variant = 'default' }: { variant?: 'default' | 'compact' }) {
  if (variant === 'compact') {
    return (
      <div className="flex items-center gap-3 p-3 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 animate-pulse">
        <div className="w-10 h-10 rounded-lg bg-gray-200 dark:bg-gray-700" />
        <div className="flex-1">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2" />
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden animate-pulse">
      <div className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-gray-200 dark:bg-gray-700" />
            <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-20" />
          </div>
          <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700" />
        </div>
        <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2" />
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full mb-2" />
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3 mb-4" />
        <div className="flex gap-2 mb-4">
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-16" />
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-20" />
        </div>
      </div>
      <div className="px-5 py-3 bg-gray-50 dark:bg-gray-700/50 border-t border-gray-200 dark:border-gray-600">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
      </div>
    </div>
  );
}
