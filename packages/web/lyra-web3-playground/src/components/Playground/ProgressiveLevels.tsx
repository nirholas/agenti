/**
 * ✨ built by nich
 * 🌐 GitHub: github.com/nirholas
 * 💫 Every line of code is a step toward something amazing ✨
 */

import { useState } from 'react';
import { BookOpen, Code2, Lightbulb, Trophy, Star, Clock } from 'lucide-react';

export type DifficultyLevel = 'beginner' | 'intermediate' | 'advanced' | 'expert';

export interface LevelInfo {
  level: DifficultyLevel;
  title: string;
  description: string;
  estimatedTime: string;
  prerequisites?: string[];
  topics: string[];
  unlocked: boolean;
}

interface ProgressiveLevelsProps {
  levels: LevelInfo[];
  currentLevel: DifficultyLevel;
  onLevelChange: (level: DifficultyLevel) => void;
  userProgress?: {
    completedLevels: DifficultyLevel[];
    currentStreak: number;
    totalPoints: number;
  };
}

export default function ProgressiveLevels({
  levels,
  currentLevel,
  onLevelChange,
  userProgress
}: ProgressiveLevelsProps) {
  const [expandedLevel, setExpandedLevel] = useState<DifficultyLevel | null>(currentLevel);

  const levelColors: Record<DifficultyLevel, { bg: string; border: string; text: string; badge: string }> = {
    beginner: {
      bg: 'bg-green-50 dark:bg-green-900/20',
      border: 'border-green-200 dark:border-green-800',
      text: 'text-green-700 dark:text-green-300',
      badge: 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300'
    },
    intermediate: {
      bg: 'bg-blue-50 dark:bg-blue-900/20',
      border: 'border-blue-200 dark:border-blue-800',
      text: 'text-blue-700 dark:text-blue-300',
      badge: 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
    },
    advanced: {
      bg: 'bg-purple-50 dark:bg-purple-900/20',
      border: 'border-purple-200 dark:border-purple-800',
      text: 'text-purple-700 dark:text-purple-300',
      badge: 'bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300'
    },
    expert: {
      bg: 'bg-orange-50 dark:bg-orange-900/20',
      border: 'border-orange-200 dark:border-orange-800',
      text: 'text-orange-700 dark:text-orange-300',
      badge: 'bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300'
    }
  };

  const getLevelIcon = (level: DifficultyLevel) => {
    switch (level) {
      case 'beginner':
        return <BookOpen className="w-5 h-5" />;
      case 'intermediate':
        return <Code2 className="w-5 h-5" />;
      case 'advanced':
        return <Lightbulb className="w-5 h-5" />;
      case 'expert':
        return <Trophy className="w-5 h-5" />;
    }
  };

  const isLevelCompleted = (level: DifficultyLevel) => {
    return userProgress?.completedLevels.includes(level) || false;
  };

  return (
    <div className="space-y-4">
      {/* Progress Header */}
      {userProgress && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-gradient-to-br from-primary-50 to-primary-100 dark:from-primary-900/20 dark:to-primary-800/20 p-4 rounded-lg border border-primary-200 dark:border-primary-800">
            <div className="flex items-center gap-2 mb-1">
              <Trophy className="w-4 h-4 text-primary-600 dark:text-primary-400" />
              <span className="text-xs font-medium text-primary-700 dark:text-primary-300">Points</span>
            </div>
            <p className="text-2xl font-bold text-primary-900 dark:text-primary-100">
              {userProgress.totalPoints}
            </p>
          </div>

          <div className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 p-4 rounded-lg border border-orange-200 dark:border-orange-800">
            <div className="flex items-center gap-2 mb-1">
              <Star className="w-4 h-4 text-orange-600 dark:text-orange-400" />
              <span className="text-xs font-medium text-orange-700 dark:text-orange-300">Streak</span>
            </div>
            <p className="text-2xl font-bold text-orange-900 dark:text-orange-100">
              {userProgress.currentStreak} days
            </p>
          </div>

          <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
            <div className="flex items-center gap-2 mb-1">
              <BookOpen className="w-4 h-4 text-green-600 dark:text-green-400" />
              <span className="text-xs font-medium text-green-700 dark:text-green-300">Completed</span>
            </div>
            <p className="text-2xl font-bold text-green-900 dark:text-green-100">
              {userProgress.completedLevels.length}/{levels.length}
            </p>
          </div>
        </div>
      )}

      {/* Level Cards */}
      <div className="space-y-3">
        {levels.map((levelInfo) => {
          const colors = levelColors[levelInfo.level];
          const isCompleted = isLevelCompleted(levelInfo.level);
          const isCurrent = currentLevel === levelInfo.level;
          const isExpanded = expandedLevel === levelInfo.level;

          return (
            <div
              key={levelInfo.level}
              className={`
                border-2 rounded-lg overflow-hidden transition-all
                ${isCurrent ? colors.border + ' shadow-lg' : 'border-gray-200 dark:border-gray-700'}
                ${!levelInfo.unlocked ? 'opacity-60' : ''}
              `}
            >
              {/* Header */}
              <button
                onClick={() => {
                  if (levelInfo.unlocked) {
                    setExpandedLevel(isExpanded ? null : levelInfo.level);
                  }
                }}
                disabled={!levelInfo.unlocked}
                className={`
                  w-full px-4 py-3 flex items-center justify-between
                  ${isCurrent ? colors.bg : 'bg-white dark:bg-gray-800'}
                  hover:bg-gray-50 dark:hover:bg-gray-700/50
                  transition-colors disabled:cursor-not-allowed
                `}
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${colors.badge}`}>
                    {getLevelIcon(levelInfo.level)}
                  </div>

                  <div className="text-left">
                    <div className="flex items-center gap-2">
                      <h3 className={`font-semibold ${isCurrent ? colors.text : 'text-gray-900 dark:text-white'}`}>
                        {levelInfo.title}
                      </h3>
                      {isCompleted && (
                        <span className="flex items-center gap-1 px-2 py-0.5 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 text-xs font-medium rounded">
                          <Trophy className="w-3 h-3" />
                          Completed
                        </span>
                      )}
                      {isCurrent && !isCompleted && (
                        <span className="px-2 py-0.5 bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300 text-xs font-medium rounded">
                          In Progress
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {levelInfo.description}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400">
                    <Clock className="w-4 h-4" />
                    {levelInfo.estimatedTime}
                  </div>
                </div>
              </button>

              {/* Expanded Content */}
              {isExpanded && levelInfo.unlocked && (
                <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                  <div className="space-y-3">
                    {/* Topics */}
                    <div>
                      <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                        What you'll learn:
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {levelInfo.topics.map((topic, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-xs text-gray-700 dark:text-gray-300 rounded"
                          >
                            {topic}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Prerequisites */}
                    {levelInfo.prerequisites && levelInfo.prerequisites.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                          Prerequisites:
                        </h4>
                        <ul className="space-y-1">
                          {levelInfo.prerequisites.map((prereq, idx) => (
                            <li key={idx} className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-2">
                              <span className="w-1 h-1 bg-gray-400 rounded-full" />
                              {prereq}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Action Button */}
                    {!isCurrent && (
                      <button
                        onClick={() => onLevelChange(levelInfo.level)}
                        className="w-full py-2 px-4 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg transition-colors"
                      >
                        {isCompleted ? 'Review Level' : 'Start Learning'}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
