/**
 * ✨ built by nich
 * 🌐 GitHub: github.com/nirholas
 * 💫 Believe in your code, believe in yourself 💪
 */

/**
 * Visual progress tracking component showing completion percentage, 
 * completed steps, quiz scores, and achievements
 */

import { useState, useEffect } from 'react';
import {
  CheckCircle,
  Circle,
  Trophy,
  Flame,
  BookOpen,
  Clock,
  Target,
  Award,
  TrendingUp,
  Bookmark
} from 'lucide-react';
import { 
  getLearningStats, 
  getAllAchievements,
  getTutorialsInProgress,
  getBookmarkedTutorials,
  getProgress
} from '@/utils/tutorialProgress';
import type { Achievement } from '@/types/tutorials';

/**
 * Props for TutorialProgressWidget
 */
interface TutorialProgressWidgetProps {
  variant?: 'full' | 'compact' | 'minimal';
  className?: string;
}

/**
 * Main progress widget showing overall learning stats
 */
export function TutorialProgressWidget({ 
  variant = 'full', 
  className = '' 
}: TutorialProgressWidgetProps) {
  const [stats, setStats] = useState(() => getLearningStats());
  const [achievements, setAchievements] = useState<Achievement[]>([]);

  useEffect(() => {
    setStats(getLearningStats());
    setAchievements(getAllAchievements());
  }, []);

  if (variant === 'minimal') {
    return (
      <div className={`flex items-center gap-4 ${className}`}>
        <div className="flex items-center gap-1 text-sm">
          <CheckCircle className="w-4 h-4 text-green-500" />
          <span className="text-gray-700 dark:text-gray-300">{stats.totalCompleted} completed</span>
        </div>
        {stats.currentStreak > 0 && (
          <div className="flex items-center gap-1 text-sm">
            <Flame className="w-4 h-4 text-orange-500" />
            <span className="text-gray-700 dark:text-gray-300">{stats.currentStreak} day streak</span>
          </div>
        )}
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <div className={`bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700 ${className}`}>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalCompleted}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Completed</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-500">{stats.currentStreak}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Day Streak</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-primary-600">{stats.achievementsUnlocked}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Achievements</div>
          </div>
        </div>
      </div>
    );
  }

  // Full variant
  return (
    <div className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden ${className}`}>
      {/* Header */}
      <div className="px-6 py-4 bg-gradient-to-r from-primary-500 to-primary-600 text-white">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <TrendingUp className="w-5 h-5" />
          Your Learning Progress
        </h3>
      </div>

      {/* Stats Grid */}
      <div className="p-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatCard
            icon={<CheckCircle className="w-5 h-5 text-green-500" />}
            value={stats.totalCompleted.toString()}
            label="Completed"
            color="green"
          />
          <StatCard
            icon={<Flame className="w-5 h-5 text-orange-500" />}
            value={`${stats.currentStreak}`}
            label="Day Streak"
            color="orange"
          />
          <StatCard
            icon={<Clock className="w-5 h-5 text-blue-500" />}
            value={stats.totalTimeSpent}
            label="Time Spent"
            color="blue"
          />
          <StatCard
            icon={<Bookmark className="w-5 h-5 text-purple-500" />}
            value={stats.totalBookmarked.toString()}
            label="Bookmarked"
            color="purple"
          />
        </div>

        {/* Achievements Section */}
        <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
            <Trophy className="w-4 h-4 text-yellow-500" />
            Achievements ({stats.achievementsUnlocked}/{stats.totalAchievements})
          </h4>
          <div className="flex flex-wrap gap-2">
            {achievements.map((achievement) => (
              <AchievementBadge key={achievement.id} achievement={achievement} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Stat card component
 */
function StatCard({ 
  icon, 
  value, 
  label, 
  color 
}: { 
  icon: React.ReactNode; 
  value: string; 
  label: string; 
  color: string;
}) {
  return (
    <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 text-center">
      <div className="flex justify-center mb-2">{icon}</div>
      <div className="text-xl font-bold text-gray-900 dark:text-white">{value}</div>
      <div className="text-xs text-gray-500 dark:text-gray-400">{label}</div>
    </div>
  );
}

/**
 * Achievement badge component
 */
function AchievementBadge({ achievement }: { achievement: Achievement }) {
  const isUnlocked = !!achievement.unlockedAt;
  
  return (
    <div
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm ${
        isUnlocked
          ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200'
          : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500'
      }`}
      title={achievement.description}
    >
      <span>{achievement.icon}</span>
      <span className={isUnlocked ? '' : 'opacity-50'}>{achievement.name}</span>
      {!isUnlocked && <span className="opacity-40">🔒</span>}
    </div>
  );
}

/**
 * Props for StepProgress component
 */
interface StepProgressProps {
  tutorialId: string;
  steps: Array<{ id: string; title: string }>;
  currentStepIndex: number;
  onStepClick?: (index: number) => void;
  className?: string;
}

/**
 * Step-by-step progress indicator for a single tutorial
 */
export function StepProgress({
  tutorialId,
  steps,
  currentStepIndex,
  onStepClick,
  className = ''
}: StepProgressProps) {
  const progress = getProgress(tutorialId);
  const completedSteps = new Set(progress.completedSteps || progress.completedStepIds || []);

  return (
    <div className={`space-y-2 ${className}`}>
      {steps.map((step, index) => {
        const isCompleted = completedSteps.has(step.id);
        const isCurrent = index === currentStepIndex;
        const isClickable = !!onStepClick;

        return (
          <button
            key={step.id}
            onClick={() => onStepClick?.(index)}
            disabled={!isClickable}
            className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-all ${
              isCurrent
                ? 'bg-primary-50 dark:bg-primary-900/30 border-2 border-primary-500'
                : isCompleted
                ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                : 'bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-700'
            } ${isClickable ? 'hover:border-primary-300 dark:hover:border-primary-600 cursor-pointer' : ''}`}
          >
            <div className="flex-shrink-0">
              {isCompleted ? (
                <CheckCircle className="w-5 h-5 text-green-500" />
              ) : isCurrent ? (
                <div className="w-5 h-5 rounded-full border-2 border-primary-500 bg-primary-500 flex items-center justify-center">
                  <div className="w-2 h-2 bg-white rounded-full" />
                </div>
              ) : (
                <Circle className="w-5 h-5 text-gray-300 dark:text-gray-600" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <span className={`text-sm ${
                isCurrent
                  ? 'font-semibold text-primary-700 dark:text-primary-300'
                  : isCompleted
                  ? 'text-green-700 dark:text-green-300'
                  : 'text-gray-700 dark:text-gray-300'
              }`}>
                {index + 1}. {step.title}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

/**
 * Circular progress indicator
 */
interface CircularProgressProps {
  percent: number;
  size?: number;
  strokeWidth?: number;
  showLabel?: boolean;
  className?: string;
}

export function CircularProgress({
  percent,
  size = 60,
  strokeWidth = 6,
  showLabel = true,
  className = ''
}: CircularProgressProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (percent / 100) * circumference;

  return (
    <div className={`relative inline-flex items-center justify-center ${className}`}>
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="none"
          className="text-gray-200 dark:text-gray-700"
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="text-primary-500 transition-all duration-500"
        />
      </svg>
      {showLabel && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            {Math.round(percent)}%
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * Progress bar component
 */
interface ProgressBarProps {
  percent: number;
  height?: number;
  showLabel?: boolean;
  animated?: boolean;
  className?: string;
}

export function ProgressBar({
  percent,
  height = 8,
  showLabel = false,
  animated = true,
  className = ''
}: ProgressBarProps) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div 
        className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden"
        style={{ height }}
      >
        <div
          className={`h-full bg-gradient-to-r from-primary-500 to-primary-600 rounded-full ${
            animated ? 'transition-all duration-500' : ''
          }`}
          style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
        />
      </div>
      {showLabel && (
        <span className="text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap min-w-[3rem]">
          {Math.round(percent)}%
        </span>
      )}
    </div>
  );
}

/**
 * Tutorials in progress list
 */
interface InProgressListProps {
  onTutorialClick?: (tutorialId: string) => void;
  className?: string;
}

export function InProgressList({ onTutorialClick, className = '' }: InProgressListProps) {
  const [tutorialIds, setTutorialIds] = useState<string[]>([]);

  useEffect(() => {
    setTutorialIds(getTutorialsInProgress());
  }, []);

  if (tutorialIds.length === 0) {
    return (
      <div className={`text-center py-6 text-gray-500 dark:text-gray-400 ${className}`}>
        <Target className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No tutorials in progress</p>
        <p className="text-xs mt-1">Start a tutorial to track your progress!</p>
      </div>
    );
  }

  return (
    <div className={`space-y-2 ${className}`}>
      <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
        <BookOpen className="w-4 h-4" />
        Continue Learning ({tutorialIds.length})
      </h4>
      {tutorialIds.map((id) => {
        const progress = getProgress(id);
        const percent = progress.completedSteps?.length ? 
          Math.round((progress.completedSteps.length / 10) * 100) : 0; // Approximate

        return (
          <button
            key={id}
            onClick={() => onTutorialClick?.(id)}
            className="w-full flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-700 hover:border-primary-300 dark:hover:border-primary-600 transition-all text-left"
          >
            <CircularProgress percent={percent} size={40} strokeWidth={4} />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                {id.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {progress.completedSteps?.length || 0} steps completed
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

/**
 * Quiz score display
 */
interface QuizScoreProps {
  score: number;
  total: number;
  attempts?: number;
  className?: string;
}

export function QuizScore({ score, total, attempts = 1, className = '' }: QuizScoreProps) {
  const percent = Math.round((score / total) * 100);
  const isPassing = percent >= 70;

  return (
    <div className={`p-4 rounded-lg ${
      isPassing 
        ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800' 
        : 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800'
    } ${className}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Award className={`w-5 h-5 ${isPassing ? 'text-green-500' : 'text-yellow-500'}`} />
          <span className="font-semibold text-gray-900 dark:text-white">Quiz Results</span>
        </div>
        {attempts > 1 && (
          <span className="text-xs text-gray-500 dark:text-gray-400">
            Attempt #{attempts}
          </span>
        )}
      </div>
      <div className="flex items-center gap-4">
        <CircularProgress percent={percent} size={50} strokeWidth={5} />
        <div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {score}/{total}
          </div>
          <div className={`text-sm ${isPassing ? 'text-green-600' : 'text-yellow-600'}`}>
            {isPassing ? '✓ Passed' : 'Keep practicing!'}
          </div>
        </div>
      </div>
    </div>
  );
}

// Default export
export default TutorialProgressWidget;
