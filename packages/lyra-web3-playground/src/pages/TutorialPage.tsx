/**
 * ✨ built by nich
 * 🌐 GitHub: github.com/nirholas
 * 💫 Keep shining, keep coding 🌞
 */

import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import InteractiveTutorial from '@/components/Tutorial/InteractiveTutorial';
import { tutorials } from '@/data/tutorials';

export default function TutorialPage() {
  const { tutorialId } = useParams<{ tutorialId: string }>();
  const tutorial = tutorials.find(t => t.id === tutorialId) || tutorials[0];
  const isFallback = !tutorialId || tutorial.id !== tutorialId;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {isFallback && (
        <div className="container pt-6">
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 text-amber-900 px-4 py-3 text-sm dark:border-amber-700 dark:bg-amber-900/40 dark:text-amber-100">
            Requested tutorial was not found; showing the first available tutorial instead.
          </div>
        </div>
      )}
      <InteractiveTutorial 
        tutorial={tutorial}
        onComplete={() => {
          alert('🎉 Congratulations! You completed the tutorial!');
        }}
      />
    </div>
  );
}
