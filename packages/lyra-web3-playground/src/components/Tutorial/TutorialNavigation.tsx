/**
 * ✨ built by nich
 * 🌐 GitHub: github.com/nirholas
 * 💫 Code with kindness, deploy with confidence 🎪
 */

/**
 * Navigation component with table of contents, next/previous tutorials,
 * and learning path suggestions
 */

import { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  List,
  Map,
  Home,
  Bookmark,
  BookmarkCheck,
  Share2,
  Twitter,
  Linkedin,
  Link as LinkIcon,
  Check,
  ArrowRight,
  CheckCircle,
  Circle,
  GraduationCap
} from 'lucide-react';
import type { Tutorial, TutorialStep, LearningPath } from '@/types/tutorials';
import { LEARNING_PATHS, TUTORIAL_CATEGORIES } from '@/types/tutorials';
import { 
  isBookmarked, 
  toggleBookmark,
  getProgress 
} from '@/utils/tutorialProgress';

/**
 * Props for TutorialNavigation component
 */
interface TutorialNavigationProps {
  tutorial: Tutorial;
  allTutorials: Tutorial[];
  currentStepIndex: number;
  onStepChange: (index: number) => void;
  onBookmarkChange?: (bookmarked: boolean) => void;
  className?: string;
}

/**
 * Main tutorial navigation sidebar
 */
export default function TutorialNavigation({
  tutorial,
  allTutorials,
  currentStepIndex,
  onStepChange,
  onBookmarkChange,
  className = ''
}: TutorialNavigationProps) {
  const [bookmarked, setBookmarked] = useState(() => isBookmarked(tutorial.id));
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [copied, setCopied] = useState(false);
  const navigate = useNavigate();

  const steps = tutorial.steps || tutorial.content || [];
  const progress = getProgress(tutorial.id);
  const completedSteps = new Set(progress.completedSteps || progress.completedStepIds || []);

  // Find related tutorials
  const relatedTutorials = useMemo(() => {
    return allTutorials
      .filter(t => 
        t.id !== tutorial.id && 
        (t.category === tutorial.category || 
         t.tags?.some(tag => tutorial.tags?.includes(tag)))
      )
      .slice(0, 3);
  }, [tutorial, allTutorials]);

  // Find next tutorial in sequence
  const nextTutorial = useMemo(() => {
    const sameCategory = allTutorials.filter(t => t.category === tutorial.category);
    const currentIndex = sameCategory.findIndex(t => t.id === tutorial.id);
    return currentIndex >= 0 && currentIndex < sameCategory.length - 1 
      ? sameCategory[currentIndex + 1] 
      : null;
  }, [tutorial, allTutorials]);

  // Find learning paths containing this tutorial
  const relevantPaths = useMemo(() => {
    return LEARNING_PATHS.filter(path => path.tutorialIds.includes(tutorial.id));
  }, [tutorial.id]);

  const handleBookmark = () => {
    const newState = toggleBookmark(tutorial.id);
    setBookmarked(newState);
    onBookmarkChange?.(newState);
  };

  const handleCopyLink = async () => {
    const url = window.location.href;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareUrl = typeof window !== 'undefined' ? window.location.href : '';
  const shareText = `Check out this Web3 tutorial: ${tutorial.title}`;

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Header Actions */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <Link
          to="/tutorials"
          className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400"
        >
          <Home className="w-4 h-4" />
          <span>All Tutorials</span>
        </Link>
        
        <div className="flex items-center gap-2">
          {/* Bookmark button */}
          <button
            onClick={handleBookmark}
            className={`p-2 rounded-lg transition-colors ${
              bookmarked 
                ? 'text-primary-600 bg-primary-50 dark:bg-primary-900/30' 
                : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
            aria-label={bookmarked ? 'Remove bookmark' : 'Add bookmark'}
          >
            {bookmarked ? (
              <BookmarkCheck className="w-5 h-5" />
            ) : (
              <Bookmark className="w-5 h-5" />
            )}
          </button>

          {/* Share button */}
          <div className="relative">
            <button
              onClick={() => setShowShareMenu(!showShareMenu)}
              className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              aria-label="Share tutorial"
            >
              <Share2 className="w-5 h-5" />
            </button>

            {showShareMenu && (
              <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-2 z-50">
                <a
                  href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <Twitter className="w-4 h-4" />
                  Share on Twitter
                </a>
                <a
                  href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <Linkedin className="w-4 h-4" />
                  Share on LinkedIn
                </a>
                <button
                  onClick={handleCopyLink}
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4 text-green-500" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <LinkIcon className="w-4 h-4" />
                      Copy Link
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Table of Contents */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="mb-6">
          <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <List className="w-4 h-4" />
            Contents
          </h3>
          <nav className="space-y-1">
            {steps.map((step, index) => {
              const isCompleted = completedSteps.has(step.id);
              const isCurrent = index === currentStepIndex;

              return (
                <button
                  key={step.id}
                  onClick={() => onStepChange(index)}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm transition-all ${
                    isCurrent
                      ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 font-medium'
                      : isCompleted
                      ? 'text-green-700 dark:text-green-300 hover:bg-green-50 dark:hover:bg-green-900/20'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  <span className="flex-shrink-0">
                    {isCompleted ? (
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    ) : isCurrent ? (
                      <div className="w-4 h-4 rounded-full border-2 border-primary-500 flex items-center justify-center">
                        <div className="w-1.5 h-1.5 bg-primary-500 rounded-full" />
                      </div>
                    ) : (
                      <Circle className="w-4 h-4 text-gray-300 dark:text-gray-600" />
                    )}
                  </span>
                  <span className="truncate">{step.title}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Learning Paths */}
        {relevantPaths.length > 0 && (
          <div className="mb-6">
            <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Map className="w-4 h-4" />
              Learning Path
            </h3>
            {relevantPaths.map(path => (
              <LearningPathCard key={path.id} path={path} currentTutorialId={tutorial.id} />
            ))}
          </div>
        )}

        {/* Related Tutorials */}
        {relatedTutorials.length > 0 && (
          <div className="mb-6">
            <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
              Related Tutorials
            </h3>
            <div className="space-y-2">
              {relatedTutorials.map(related => (
                <Link
                  key={related.id}
                  to={`/tutorial/${related.id}`}
                  className="block p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {related.title}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2 mt-1">
                    <span className="capitalize">{related.difficulty}</span>
                    <span>•</span>
                    <span>{related.duration || related.estimatedTime}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Next Tutorial Footer */}
      {nextTutorial && (
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Up Next</p>
          <Link
            to={`/tutorial/${nextTutorial.id}`}
            className="flex items-center justify-between p-3 rounded-lg bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 hover:border-primary-300 dark:hover:border-primary-600 transition-all group"
          >
            <div className="min-w-0">
              <div className="text-sm font-medium text-gray-900 dark:text-white truncate group-hover:text-primary-600">
                {nextTutorial.title}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {nextTutorial.duration || nextTutorial.estimatedTime}
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-primary-500 group-hover:translate-x-1 transition-all flex-shrink-0" />
          </Link>
        </div>
      )}
    </div>
  );
}

/**
 * Learning path card showing progress through a path
 */
function LearningPathCard({ 
  path, 
  currentTutorialId 
}: { 
  path: LearningPath; 
  currentTutorialId: string;
}) {
  const currentIndex = path.tutorialIds.indexOf(currentTutorialId);
  const progress = Math.round(((currentIndex + 1) / path.tutorialIds.length) * 100);

  return (
    <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-700">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lg">{path.icon}</span>
        <span className="text-sm font-medium text-gray-900 dark:text-white">
          {path.name}
        </span>
      </div>
      <div className="flex items-center gap-2 mb-2">
        <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-600 rounded-full">
          <div
            className="h-full bg-primary-500 rounded-full transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {currentIndex + 1}/{path.tutorialIds.length}
        </span>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400">
        {path.description}
      </p>
    </div>
  );
}

/**
 * Step navigation buttons (prev/next)
 */
interface StepNavigationButtonsProps {
  currentStepIndex: number;
  totalSteps: number;
  onPrev: () => void;
  onNext: () => void;
  isLastStep: boolean;
  onComplete?: () => void;
  className?: string;
}

export function StepNavigationButtons({
  currentStepIndex,
  totalSteps,
  onPrev,
  onNext,
  isLastStep,
  onComplete,
  className = ''
}: StepNavigationButtonsProps) {
  return (
    <div className={`flex items-center justify-between ${className}`}>
      <button
        onClick={onPrev}
        disabled={currentStepIndex === 0}
        className="btn-secondary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <ChevronLeft className="w-4 h-4" />
        <span>Previous</span>
      </button>

      <span className="text-sm text-gray-500 dark:text-gray-400">
        Step {currentStepIndex + 1} of {totalSteps}
      </span>

      {isLastStep ? (
        <button
          onClick={onComplete}
          className="btn-primary flex items-center gap-2"
        >
          <GraduationCap className="w-4 h-4" />
          <span>Complete</span>
        </button>
      ) : (
        <button
          onClick={onNext}
          className="btn-primary flex items-center gap-2"
        >
          <span>Next</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

/**
 * Breadcrumb navigation
 */
interface TutorialBreadcrumbProps {
  tutorial: Tutorial;
  className?: string;
}

export function TutorialBreadcrumb({ tutorial, className = '' }: TutorialBreadcrumbProps) {
  const category = TUTORIAL_CATEGORIES.find(c => c.id === tutorial.category);

  return (
    <nav className={`flex items-center gap-2 text-sm ${className}`}>
      <Link
        to="/tutorials"
        className="text-gray-500 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400"
      >
        Tutorials
      </Link>
      <ChevronRight className="w-4 h-4 text-gray-400" />
      <Link
        to={`/tutorials?category=${tutorial.category}`}
        className="text-gray-500 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400"
      >
        {category?.name || tutorial.category}
      </Link>
      <ChevronRight className="w-4 h-4 text-gray-400" />
      <span className="text-gray-900 dark:text-white font-medium truncate">
        {tutorial.title}
      </span>
    </nav>
  );
}

/**
 * Quick navigation dropdown for mobile
 */
interface QuickNavProps {
  steps: TutorialStep[];
  currentStepIndex: number;
  onStepChange: (index: number) => void;
  className?: string;
}

export function QuickNav({ steps, currentStepIndex, onStepChange, className = '' }: QuickNavProps) {
  return (
    <div className={`relative ${className}`}>
      <select
        value={currentStepIndex}
        onChange={(e) => onStepChange(parseInt(e.target.value, 10))}
        className="w-full px-4 py-2 pr-8 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white appearance-none cursor-pointer focus:ring-2 focus:ring-primary-500 focus:border-transparent"
      >
        {steps.map((step, index) => (
          <option key={step.id} value={index}>
            {index + 1}. {step.title}
          </option>
        ))}
      </select>
      <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 rotate-90 pointer-events-none" />
    </div>
  );
}
