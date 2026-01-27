/**
 * ✨ built by nich
 * 🌐 GitHub: github.com/nirholas
 * 💫 Never stop learning, never stop growing 🌱
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useSEO } from '@/hooks/useSEO';
import { 
  BookOpen, 
  Clock, 
  Code, 
  Zap,
  CheckCircle,
  Search,
  Filter
} from 'lucide-react';
import { tutorials } from '@/data/tutorials';
import { computeCompletionPercent } from '@/utils/tutorialProgress';

export default function TutorialBrowser() {
  useSEO({
    title: 'Tutorials',
    description: 'Learn blockchain development with 50+ interactive tutorials. From Solidity basics to advanced DeFi and NFT development, all levels welcome.',
    path: '/tutorials'
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const difficulties = ['all', 'beginner', 'intermediate', 'advanced'];
  const categories = ['all', ...new Set(tutorials.map(t => t.category))];

  const filteredTutorials = tutorials.filter(tutorial => {
    const matchesSearch = 
      tutorial.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tutorial.description.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesDifficulty = 
      selectedDifficulty === 'all' || tutorial.difficulty === selectedDifficulty;
    
    const matchesCategory = 
      selectedCategory === 'all' || tutorial.category === selectedCategory;
    
    return matchesSearch && matchesDifficulty && matchesCategory;
  });

  const getDifficultyColor = (difficulty: string) => {
    const colors = {
      beginner: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      intermediate: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      advanced: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
    };
    return colors[difficulty as keyof typeof colors] || '';
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12">
      <div className="container">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Interactive Tutorials
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-400 max-w-3xl mx-auto">
            Learn Web3 development through hands-on, step-by-step tutorials with live code examples
          </p>
        </div>

        {/* Search & Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 mb-8">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search tutorials..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                />
              </div>
            </div>

            {/* Difficulty Filter */}
            <div className="flex items-center space-x-2">
              <Filter className="w-5 h-5 text-gray-400" />
              <select
                value={selectedDifficulty}
                onChange={(e) => setSelectedDifficulty(e.target.value)}
                className="px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-white"
              >
                {difficulties.map(diff => (
                  <option key={diff} value={diff}>
                    {diff.charAt(0).toUpperCase() + diff.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            {/* Category Filter */}
            <div>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-white"
              >
                {categories.map(cat => (
                  <option key={cat} value={cat}>
                    {cat.charAt(0).toUpperCase() + cat.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Tutorial Grid */}
        {filteredTutorials.length === 0 ? (
          <div className="text-center py-16">
            <BookOpen className="w-16 h-16 mx-auto mb-4 text-gray-400" />
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              No tutorials found
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              Try adjusting your search or filters
            </p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTutorials.map((tutorial) => (
              <Link
                key={tutorial.id}
                to={`/tutorial/${tutorial.id}`}
                className="bg-white dark:bg-gray-800 rounded-lg shadow-sm hover:shadow-md transition-shadow overflow-hidden group"
              >
                {/* Tutorial Card Header */}
                <div className="p-6">
                  <div className="flex items-start justify-between mb-3">
                    <div className="p-3 bg-primary-100 dark:bg-primary-900 rounded-lg group-hover:bg-primary-200 dark:group-hover:bg-primary-800 transition-colors">
                      <Code className="w-6 h-6 text-primary-600 dark:text-primary-400" />
                    </div>
                    <div className="flex flex-col items-end space-y-1">
                      <span className={`px-3 py-1 text-xs font-medium rounded-full ${getDifficultyColor(tutorial.difficulty)}`}>
                        {tutorial.difficulty}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {computeCompletionPercent(tutorial.id, tutorial.steps.length)}% complete
                      </span>
                    </div>
                  </div>

                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                    {tutorial.title}
                  </h3>

                  <p className="text-gray-600 dark:text-gray-400 text-sm mb-4 line-clamp-2">
                    {tutorial.description}
                  </p>

                  {/* Meta Info */}
                  <div className="flex items-center space-x-4 text-sm text-gray-500 dark:text-gray-400 mb-4">
                    <div className="flex items-center space-x-1">
                      <Clock className="w-4 h-4" />
                      <span>{tutorial.estimatedTime}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <BookOpen className="w-4 h-4" />
                      <span>{tutorial.steps.length} steps</span>
                    </div>
                  </div>

                  {/* Languages */}
                  <div className="flex items-center space-x-2 mb-4">
                    {tutorial.languages.slice(0, 3).map((lang, index) => (
                      <span
                        key={index}
                        className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded"
                      >
                        {lang}
                      </span>
                    ))}
                    {tutorial.languages.length > 3 && (
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        +{tutorial.languages.length - 3} more
                      </span>
                    )}
                  </div>

                  {/* Prerequisites */}
                  {tutorial.prerequisites && tutorial.prerequisites.length > 0 && (
                    <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                        Prerequisites:
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {tutorial.prerequisites.map((prereq, index) => (
                          <span
                            key={index}
                            className="text-xs text-gray-600 dark:text-gray-300"
                          >
                            {index > 0 && '• '}
                            {prereq}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Card Footer */}
                <div className="px-6 py-3 bg-gray-50 dark:bg-gray-700 border-t border-gray-200 dark:border-gray-600">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">
                      Start learning
                    </span>
                    <Zap className="w-4 h-4 text-primary-600 dark:text-primary-400 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Stats Section */}
        <div className="mt-12 grid md:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 text-center">
            <div className="w-12 h-12 bg-primary-100 dark:bg-primary-900 rounded-full flex items-center justify-center mx-auto mb-3">
              <BookOpen className="w-6 h-6 text-primary-600 dark:text-primary-400" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
              {tutorials.length}
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              Interactive Tutorials
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 text-center">
            <div className="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mx-auto mb-3">
              <Code className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
              {tutorials.reduce((sum, t) => sum + t.languages.length, 0)}
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              Language Examples
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 text-center">
            <div className="w-12 h-12 bg-yellow-100 dark:bg-yellow-900 rounded-full flex items-center justify-center mx-auto mb-3">
              <CheckCircle className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
              {tutorials.reduce((sum, t) => sum + t.steps.length, 0)}
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              Learning Steps
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
