/**
 * ✨ built by nich
 * 🌐 GitHub: github.com/nirholas
 * 💫 Innovation starts with a single keystroke ⌨️
 */

import { useState } from 'react';
import { Code2, Trophy, Target, AlertCircle, CheckCircle, Play, RotateCcw, Circle } from 'lucide-react';

export interface Challenge {
  id: string;
  title: string;
  description: string;
  difficulty: 'easy' | 'medium' | 'hard';
  points: number;
  initialCode: string;
  solution: string;
  tests: {
    id: string;
    description: string;
    validate: (code: string) => boolean;
  }[];
  hints?: string[];
}

interface ChallengeSystemProps {
  challenge: Challenge;
  currentCode: string;
  onCodeChange: (code: string) => void;
  onComplete?: (points: number) => void;
}

export default function ChallengeSystem({
  challenge,
  currentCode,
  onCodeChange,
  onComplete
}: ChallengeSystemProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [testResults, setTestResults] = useState<Map<string, boolean>>(new Map());
  const [showHints, setShowHints] = useState(false);
  const [hintsRevealed, setHintsRevealed] = useState(0);
  const [attempts, setAttempts] = useState(0);

  const difficultyColors = {
    easy: 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20',
    medium: 'text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20',
    hard: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20'
  };

  const runTests = () => {
    setIsRunning(true);
    setAttempts(prev => prev + 1);

    // Simulate test execution delay
    setTimeout(() => {
      const results = new Map<string, boolean>();
      let allPassed = true;

      challenge.tests.forEach(test => {
        try {
          const passed = test.validate(currentCode);
          results.set(test.id, passed);
          if (!passed) allPassed = false;
        } catch (error) {
          results.set(test.id, false);
          allPassed = false;
        }
      });

      setTestResults(results);
      setIsRunning(false);

      if (allPassed && onComplete) {
        // Calculate points based on attempts and hints used
        const pointPenalty = (attempts * 5) + (hintsRevealed * 10);
        const finalPoints = Math.max(challenge.points - pointPenalty, Math.floor(challenge.points * 0.5));
        onComplete(finalPoints);
      }
    }, 1000);
  };

  const resetChallenge = () => {
    onCodeChange(challenge.initialCode);
    setTestResults(new Map());
    setAttempts(0);
    setHintsRevealed(0);
    setShowHints(false);
  };

  const revealNextHint = () => {
    if (challenge.hints && hintsRevealed < challenge.hints.length) {
      setHintsRevealed(prev => prev + 1);
      setShowHints(true);
    }
  };

  const showSolution = () => {
    onCodeChange(challenge.solution);
    setAttempts(prev => prev + 1);
  };

  const allTestsPassed = testResults.size > 0 && 
    Array.from(testResults.values()).every(result => result);

  const testsPassed = Array.from(testResults.values()).filter(r => r).length;
  const totalTests = challenge.tests.length;

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700">
      {/* Header */}
      <div className="flex-none px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
              {challenge.title}
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {challenge.description}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${difficultyColors[challenge.difficulty]}`}>
              {challenge.difficulty.toUpperCase()}
            </span>
            <div className="flex items-center gap-1 px-3 py-1 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400 rounded-full text-xs font-medium">
              <Trophy className="w-3 h-3" />
              {challenge.points} pts
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
          <span>Attempts: {attempts}</span>
          {challenge.hints && (
            <span>Hints used: {hintsRevealed}/{challenge.hints.length}</span>
          )}
          {testResults.size > 0 && (
            <span className={allTestsPassed ? 'text-green-600' : 'text-gray-600'}>
              Tests: {testsPassed}/{totalTests}
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {/* Success Message */}
        {allTestsPassed && (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-medium text-green-900 dark:text-green-100 mb-1">
                  Challenge Complete! 🎉
                </h4>
                <p className="text-sm text-green-700 dark:text-green-300">
                  You've successfully completed this challenge!
                  {attempts > 1 && ` (${attempts} attempts)`}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Test Results */}
        {testResults.size > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
              <Target className="w-4 h-4" />
              <span>Test Results</span>
            </div>
            <div className="space-y-2">
              {challenge.tests.map((test) => {
                const passed = testResults.get(test.id);
                return (
                  <div
                    key={test.id}
                    className={`
                      flex items-start gap-3 p-3 rounded-lg border
                      ${passed
                        ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                        : passed === false
                          ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                          : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                      }
                    `}
                  >
                    {passed ? (
                      <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    ) : passed === false ? (
                      <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    ) : (
                      <Circle className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
                    )}
                    <span className={`
                      text-sm
                      ${passed
                        ? 'text-green-700 dark:text-green-300'
                        : passed === false
                          ? 'text-red-700 dark:text-red-300'
                          : 'text-gray-600 dark:text-gray-400'
                      }
                    `}>
                      {test.description}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Hints */}
        {challenge.hints && challenge.hints.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                <Code2 className="w-4 h-4" />
                <span>Hints</span>
              </div>
              {hintsRevealed < challenge.hints.length && (
                <button
                  onClick={revealNextHint}
                  className="text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300"
                >
                  Reveal Next Hint (-10 pts)
                </button>
              )}
            </div>

            {showHints && hintsRevealed > 0 && (
              <div className="space-y-2">
                {challenge.hints.slice(0, hintsRevealed).map((hint, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg"
                  >
                    <p className="text-sm text-blue-800 dark:text-blue-200">
                      <strong>Hint {idx + 1}:</strong> {hint}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className="flex-none px-6 py-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3">
          <button
            onClick={runTests}
            disabled={isRunning}
            className="flex-1 flex items-center justify-center gap-2 py-2 px-4 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isRunning ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Running Tests...
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                Run Tests
              </>
            )}
          </button>

          <button
            onClick={resetChallenge}
            className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            title="Reset challenge"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>

        <button
          onClick={showSolution}
          className="w-full mt-2 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
        >
          Show Solution (forfeit points)
        </button>
      </div>
    </div>
  );
}
