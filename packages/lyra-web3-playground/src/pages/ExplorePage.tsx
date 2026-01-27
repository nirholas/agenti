/**
 * ✨ built by nich
 * 🌐 GitHub: github.com/nirholas
 * 💫 Every bug fixed is a lesson learned 🎓
 */

/**
 * ExplorePage.tsx - Discover shared projects, templates, and tutorials
 */
import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useSEO } from '@/hooks/useSEO';
import {
  Search,
  Filter,
  Grid,
  List,
  Heart,
  Eye,
  GitFork,
  Clock,
  TrendingUp,
  Sparkles,
  Code2,
  FileCode,
  BookOpen,
  Layers,
  User,
  ChevronDown,
  ExternalLink,
  Loader2
} from 'lucide-react';
import { cn } from '@/utils/helpers';
import { getPublicProjects, SharedProject } from '@/services/community';
import { useAuthStore } from '@/stores/authStore';

type Category = 'all' | 'sandbox' | 'template' | 'tutorial' | 'example';
type SortBy = 'recent' | 'popular' | 'likes';
type ViewMode = 'grid' | 'list';

const categories: { id: Category; label: string; icon: any }[] = [
  { id: 'all', label: 'All', icon: Layers },
  { id: 'sandbox', label: 'Sandboxes', icon: Code2 },
  { id: 'template', label: 'Templates', icon: FileCode },
  { id: 'tutorial', label: 'Tutorials', icon: BookOpen },
  { id: 'example', label: 'Examples', icon: Sparkles },
];

const sortOptions: { id: SortBy; label: string; icon: any }[] = [
  { id: 'recent', label: 'Most Recent', icon: Clock },
  { id: 'popular', label: 'Most Viewed', icon: TrendingUp },
  { id: 'likes', label: 'Most Liked', icon: Heart },
];

export default function ExplorePage() {
  useSEO({
    title: 'Explore Projects',
    description: 'Discover community-built smart contracts, dApps, and tutorials. Browse, fork, and learn from real Web3 projects built on Lyra.',
    path: '/explore'
  });

  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuthStore();
  
  const [projects, setProjects] = useState<SharedProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  
  const [search, setSearch] = useState(searchParams.get('q') || '');
  const [category, setCategory] = useState<Category>((searchParams.get('category') as Category) || 'all');
  const [sortBy, setSortBy] = useState<SortBy>((searchParams.get('sort') as SortBy) || 'recent');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [showFilters, setShowFilters] = useState(false);
  
  const [page, setPage] = useState(1);
  const limit = 20;

  useEffect(() => {
    loadProjects();
  }, [category, sortBy, page]);

  const loadProjects = async () => {
    setLoading(true);
    
    const { data, total: totalCount } = await getPublicProjects({
      category: category === 'all' ? undefined : category,
      sortBy,
      limit,
      offset: (page - 1) * limit
    });
    
    setProjects(data);
    setTotal(totalCount);
    setLoading(false);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchParams({ q: search, category, sort: sortBy });
    // In a real implementation, this would filter projects
  };

  const handleCategoryChange = (newCategory: Category) => {
    setCategory(newCategory);
    setPage(1);
    setSearchParams({ category: newCategory, sort: sortBy });
  };

  const handleSortChange = (newSort: SortBy) => {
    setSortBy(newSort);
    setPage(1);
    setSearchParams({ category, sort: newSort });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return date.toLocaleDateString();
  };

  const getCategoryIcon = (cat: string) => {
    switch (cat) {
      case 'sandbox': return <Code2 className="w-4 h-4" />;
      case 'template': return <FileCode className="w-4 h-4" />;
      case 'tutorial': return <BookOpen className="w-4 h-4" />;
      case 'example': return <Sparkles className="w-4 h-4" />;
      default: return <Layers className="w-4 h-4" />;
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-black">
      {/* Hero */}
      <div className="bg-gray-900 dark:bg-gray-900 text-white py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-4xl md:text-5xl font-black mb-4 text-white">
              Explore the Community
            </h1>
            <p className="text-xl text-gray-300 mb-8">
              Discover shared projects, templates, and tutorials from developers around the world
            </p>
            
            {/* Search Bar */}
            <form onSubmit={handleSearch} className="max-w-2xl mx-auto">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search projects, templates, tutorials..."
                  className="w-full pl-12 pr-4 py-4 rounded-xl bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-600"
                />
                <button
                  type="submit"
                  className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-2 bg-white text-gray-900 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                >
                  Search
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="sticky top-16 z-20 bg-gray-100 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 shadow-sm">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between py-3">
            {/* Categories */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => handleCategoryChange(cat.id)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors",
                    category === cat.id
                      ? "bg-gray-900 dark:bg-white text-white dark:text-gray-900"
                      : "bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-700"
                  )}
                >
                  <cat.icon className="w-4 h-4" />
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Right side controls */}
            <div className="flex items-center gap-3">
              {/* Sort dropdown */}
              <div className="relative">
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className="flex items-center gap-2 px-3 py-2 bg-gray-200 dark:bg-gray-800 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  <Filter className="w-4 h-4" />
                  {sortOptions.find(s => s.id === sortBy)?.label}
                  <ChevronDown className="w-4 h-4" />
                </button>
                
                {showFilters && (
                  <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-900 rounded-lg shadow-xl border border-gray-200 dark:border-gray-800 py-1 z-30">
                    {sortOptions.map((option) => (
                      <button
                        key={option.id}
                        onClick={() => {
                          handleSortChange(option.id);
                          setShowFilters(false);
                        }}
                        className={cn(
                          "flex items-center gap-2 w-full px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-800",
                          sortBy === option.id && "text-gray-900 dark:text-white font-semibold"
                        )}
                      >
                        <option.icon className="w-4 h-4" />
                        {option.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* View mode toggle */}
              <div className="flex items-center bg-gray-200 dark:bg-gray-800 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('grid')}
                  className={cn(
                    "p-2 rounded text-gray-600 dark:text-gray-400",
                    viewMode === 'grid' && "bg-white dark:bg-gray-700 shadow text-gray-900 dark:text-white"
                  )}
                >
                  <Grid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={cn(
                    "p-2 rounded text-gray-600 dark:text-gray-400",
                    viewMode === 'list' && "bg-white dark:bg-gray-700 shadow text-gray-900 dark:text-white"
                  )}
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-gray-600 dark:text-gray-400" />
          </div>
        ) : projects.length === 0 ? (
          <div className="text-center py-20">
            <Layers className="w-16 h-16 mx-auto text-gray-400 mb-4" />
            <h3 className="text-xl font-semibold mb-2 text-gray-900 dark:text-white">No projects found</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              Be the first to share something!
            </p>
            <Link
              to="/ide"
              className="inline-flex items-center gap-2 px-6 py-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg font-medium hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors"
            >
              <Code2 className="w-5 h-5" />
              Create a Project
            </Link>
          </div>
        ) : (
          <>
            {/* Results count */}
            <div className="mb-6 text-sm text-gray-500 dark:text-gray-400">
              Showing {projects.length} of {total} projects
            </div>

            {/* Grid View */}
            {viewMode === 'grid' && (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {projects.map((project) => (
                  <Link
                    key={project.id}
                    to={`/shared/${project.share_token}`}
                    className="group bg-gray-50 dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden hover:shadow-lg hover:border-gray-400 dark:hover:border-gray-600 transition-all"
                  >
                    {/* Preview placeholder */}
                    <div className="aspect-video bg-gray-200 dark:from-gray-800 dark:to-gray-900 flex items-center justify-center relative overflow-hidden">
                      <div className="absolute inset-0 bg-gray-300 dark:bg-gray-700 group-hover:opacity-100 opacity-0 transition-opacity" />
                      {getCategoryIcon(project.category)}
                    </div>

                    {/* Content */}
                    <div className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="font-semibold text-gray-900 dark:text-white group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors line-clamp-1">
                          {project.title}
                        </h3>
                        <span className="flex items-center gap-1 text-xs text-gray-500 bg-gray-200 dark:bg-gray-800 px-2 py-0.5 rounded">
                          {getCategoryIcon(project.category)}
                        </span>
                      </div>

                      {project.description && (
                        <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 mb-3">
                          {project.description}
                        </p>
                      )}

                      {/* Tags */}
                      {project.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-3">
                          {project.tags.slice(0, 3).map((tag, i) => (
                            <span
                              key={i}
                              className="text-xs px-2 py-0.5 bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Footer */}
                      <div className="flex items-center justify-between pt-3 border-t border-gray-200 dark:border-gray-800">
                        <div className="flex items-center gap-2">
                          {project.author?.avatar_url ? (
                            <img
                              src={project.author.avatar_url}
                              alt={project.author.username || 'Author'}
                              className="w-6 h-6 rounded-full"
                            />
                          ) : (
                            <div className="w-6 h-6 rounded-full bg-gray-300 dark:bg-gray-700 flex items-center justify-center">
                              <User className="w-3 h-3 text-gray-500" />
                            </div>
                          )}
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {project.author?.username || 'Anonymous'}
                          </span>
                        </div>

                        <div className="flex items-center gap-3 text-xs text-gray-400">
                          <span className="flex items-center gap-1">
                            <Heart className="w-3 h-3" />
                            {project.likes_count}
                          </span>
                          <span className="flex items-center gap-1">
                            <Eye className="w-3 h-3" />
                            {project.views_count}
                          </span>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}

            {/* List View */}
            {viewMode === 'list' && (
              <div className="space-y-4">
                {projects.map((project) => (
                  <Link
                    key={project.id}
                    to={`/shared/${project.share_token}`}
                    className="flex items-center gap-4 bg-gray-50 dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-4 hover:shadow-lg hover:border-gray-400 dark:hover:border-gray-600 transition-all"
                  >
                    {/* Icon */}
                    <div className="w-16 h-16 bg-gray-200 dark:bg-gray-800 rounded-lg flex items-center justify-center flex-shrink-0">
                      {getCategoryIcon(project.category)}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                          {project.title}
                        </h3>
                        <span className="text-xs px-2 py-0.5 bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded capitalize">
                          {project.category}
                        </span>
                      </div>
                      {project.description && (
                        <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                          {project.description}
                        </p>
                      )}
                      <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {project.author?.username || 'Anonymous'}
                        </span>
                        <span>{formatDate(project.created_at)}</span>
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="flex items-center gap-4 text-sm text-gray-400">
                      <span className="flex items-center gap-1">
                        <Heart className="w-4 h-4" />
                        {project.likes_count}
                      </span>
                      <span className="flex items-center gap-1">
                        <Eye className="w-4 h-4" />
                        {project.views_count}
                      </span>
                      <span className="flex items-center gap-1">
                        <GitFork className="w-4 h-4" />
                        {project.forks_count}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}

            {/* Pagination */}
            {total > limit && (
              <div className="flex items-center justify-center gap-2 mt-8">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-4 py-2 rounded-lg bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 disabled:opacity-50"
                >
                  Previous
                </button>
                <span className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400">
                  Page {page} of {Math.ceil(total / limit)}
                </span>
                <button
                  onClick={() => setPage(p => p + 1)}
                  disabled={page * limit >= total}
                  className="px-4 py-2 rounded-lg bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
