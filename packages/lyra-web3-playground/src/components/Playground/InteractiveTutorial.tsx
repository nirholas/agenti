/**
 * ✨ built by nich
 * 🌐 GitHub: github.com/nirholas
 * 💫 Code is poetry written for machines 📝
 */

import { useState, useEffect } from 'react';
import { CheckCircle, Circle, ChevronRight, ChevronLeft, Lightbulb, Target, Code2 } from 'lucide-react';

export interface TutorialStep {
  id: string;
  title: string;
  description: string;
  code: string;
  language: string;
  explanation: string;
  hints?: string[];
  challenge?: {
    task: string;
    solution: string;
    validation?: (code: string) => boolean;
  };
  checkpoints?: {
    label: string;
    check: (code: string) => boolean;
  }[];
}

interface InteractiveTutorialProps {
  steps: TutorialStep[];
  currentCode: string;
  onCodeChange: (code: string) => void;
  onStepChange: (stepIndex: number) => void;
  onComplete?: () => void;
}

export default function InteractiveTutorial({
  steps,
  currentCode,
  onCodeChange,
  onStepChange,
  onComplete
}: InteractiveTutorialProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [showHints, setShowHints] = useState(false);
  const [showExplanation] = useState(true);
  const [checkpointsPassed, setCheckpointsPassed] = useState<Set<string>>(new Set());

  const currentStep = steps[currentStepIndex];
  const isLastStep = currentStepIndex === steps.length - 1;
  const isFirstStep = currentStepIndex === 0;

  useEffect(() => {
    // Validate checkpoints
    if (currentStep.checkpoints) {
      const passed = new Set<string>();
      currentStep.checkpoints.forEach((checkpoint) => {
        if (checkpoint.check(currentCode)) {
          passed.add(checkpoint.label);
        }
      });
      setCheckpointsPassed(passed);
    }
  }, [currentCode, currentStep]);

  const handleNextStep = () => {
    if (currentStepIndex < steps.length - 1) {
      setCompletedSteps(prev => new Set(prev).add(currentStepIndex));
      const nextIndex = currentStepIndex + 1;
      setCurrentStepIndex(nextIndex);
      onStepChange(nextIndex);
      onCodeChange(steps[nextIndex].code);
      setShowHints(false);
    } else if (isLastStep && onComplete) {
      setCompletedSteps(prev => new Set(prev).add(currentStepIndex));
      onComplete();
    }
  };

  const handlePrevStep = () => {
    if (currentStepIndex > 0) {
      const prevIndex = currentStepIndex - 1;
      setCurrentStepIndex(prevIndex);
      onStepChange(prevIndex);
      onCodeChange(steps[prevIndex].code);
      setShowHints(false);
    }
  };

  const handleLoadStepCode = () => {
    onCodeChange(currentStep.code);
  };

  const allCheckpointsPassed = currentStep.checkpoints 
    ? currentStep.checkpoints.every(cp => checkpointsPassed.has(cp.label))
    : true;

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700">
      {/* Header */}
      <div className="flex-none px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
          Interactive Tutorial
        </h2>
        <div className="flex items-center gap-2">
          {steps.map((step, idx) => (
            <button
              key={step.id}
              onClick={() => {
                if (completedSteps.has(idx) || idx === currentStepIndex) {
                  setCurrentStepIndex(idx);
                  onStepChange(idx);
                  onCodeChange(steps[idx].code);
                }
              }}
              disabled={!completedSteps.has(idx) && idx !== currentStepIndex}
              className={`
                flex items-center justify-center w-8 h-8 rounded-full text-xs font-medium
                transition-all
                ${idx === currentStepIndex 
                  ? 'bg-primary-600 text-white ring-2 ring-primary-300 dark:ring-primary-700' 
                  : completedSteps.has(idx)
                    ? 'bg-green-600 text-white hover:bg-green-700'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                }
              `}
            >
              {completedSteps.has(idx) ? <CheckCircle className="w-4 h-4" /> : idx + 1}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
        {/* Step Title & Description */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Step {currentStepIndex + 1}: {currentStep.title}
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            {currentStep.description}
          </p>
        </div>

        {/* Checkpoints */}
        {currentStep.checkpoints && currentStep.checkpoints.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
              <Target className="w-4 h-4" />
              <span>Learning Objectives</span>
            </div>
            <div className="space-y-2">
              {currentStep.checkpoints.map((checkpoint, idx) => (
                <div
                  key={idx}
                  className={`
                    flex items-start gap-3 p-3 rounded-lg border
                    ${checkpointsPassed.has(checkpoint.label)
                      ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                      : 'bg-gray-50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-700'
                    }
                  `}
                >
                  {checkpointsPassed.has(checkpoint.label) ? (
                    <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  ) : (
                    <Circle className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
                  )}
                  <span className={`
                    text-sm
                    ${checkpointsPassed.has(checkpoint.label)
                      ? 'text-green-700 dark:text-green-300'
                      : 'text-gray-600 dark:text-gray-400'
                    }
                  `}>
                    {checkpoint.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Explanation */}
        {showExplanation && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Lightbulb className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
                  What's Happening?
                </h4>
                <div className="text-sm text-blue-800 dark:text-blue-200 prose prose-sm dark:prose-invert">
                  {currentStep.explanation}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Challenge */}
        {currentStep.challenge && (
          <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Code2 className="w-5 h-5 text-purple-600 dark:text-purple-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h4 className="font-medium text-purple-900 dark:text-purple-100 mb-2">
                  Challenge: Now You Try!
                </h4>
                <p className="text-sm text-purple-800 dark:text-purple-200 mb-3">
                  {currentStep.challenge.task}
                </p>
                {showHints && currentStep.hints && (
                  <div className="mt-3 space-y-2">
                    <p className="text-xs font-medium text-purple-700 dark:text-purple-300">
                      Hints:
                    </p>
                    {currentStep.hints.map((hint, idx) => (
                      <p key={idx} className="text-sm text-purple-700 dark:text-purple-300 pl-4 border-l-2 border-purple-300">
                        {hint}
                      </p>
                    ))}
                  </div>
                )}
                <button
                  onClick={() => setShowHints(!showHints)}
                  className="mt-3 text-sm text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300"
                >
                  {showHints ? 'Hide' : 'Show'} Hints
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Load Code Button */}
        <button
          onClick={handleLoadStepCode}
          className="w-full py-2 px-4 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium transition-colors"
        >
          Load Step Code
        </button>
      </div>

      {/* Footer Navigation */}
      <div className="flex-none px-6 py-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <button
            onClick={handlePrevStep}
            disabled={isFirstStep}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Previous
          </button>

          <div className="text-sm text-gray-500 dark:text-gray-400">
            {currentStepIndex + 1} / {steps.length}
          </div>

          <button
            onClick={handleNextStep}
            disabled={!allCheckpointsPassed}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-primary-600 text-white hover:bg-primary-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLastStep ? 'Complete' : 'Next'}
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
