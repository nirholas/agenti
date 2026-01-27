/**
 * SharedProjectPage.tsx - View a shared project with full details
 */
import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import Editor from '@monaco-editor/react';
import {
  ArrowLeft,
  Heart,
  Eye,
  GitFork,
  MessageCircle,
  Share2,
  Code2,
  Play,
  ExternalLink,
  Copy,
  Check,
  Loader2,
  User,
  Clock,
  Send,
  Wallet
} from 'lucide-react';
import { cn, truncateAddress } from '@/utils/helpers';
import {
  getSharedProject,
  likeProject,
  hasLikedProject,
  addComment,
  getComments,
  forkProject,
  generateEmbedCode,
  SharedProject,
  ProjectComment
} from '@/services/community';
import { useWalletStore } from '@/stores/walletStore';
import { useThemeStore } from '@/stores/themeStore';
import WalletConnect from '@/components/WalletConnect';

export default function SharedProjectPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { address, isConnected } = useWalletStore();
  const { mode } = useThemeStore();
  
  const [project, setProject] = useState<SharedProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [activeFile, setActiveFile] = useState(0);
  const [liked, setLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  
  const [comments, setComments] = useState<ProjectComment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [forking, setForking] = useState(false);

  // Load project
  useEffect(() => {
    if (token) {
      loadProject();
    }
  }, [token]);

  const loadProject = async () => {
    if (!token) return;
    
    setLoading(true);
    const result = await getSharedProject(token);
    
    if (result.data) {
      setProject(result.data);
      setLikesCount(result.data.likes_count);
      
      // Load comments
      const commentsResult = await getComments(result.data.id);
      setComments(commentsResult.data);
      
      // Check if wallet has liked
      if (isConnected && address) {
        const walletLiked = await hasLikedProject(result.data.id, address);
        setLiked(walletLiked);
      }
    } else {
      setError(result.error || 'Project not found');
    }
    
    setLoading(false);
  };

  const handleLike = async () => {
    if (!isConnected || !address) {
      setShowWalletModal(true);
      return;
    }
    
    if (!project) return;
    
    const result = await likeProject(project.id, address);
    if (!result.error) {
      setLiked(result.liked);
      setLikesCount(prev => result.liked ? prev + 1 : prev - 1);
    }
  };

  const handleFork = async () => {
    if (!isConnected || !address) {
      setShowWalletModal(true);
      return;
    }
    
    if (!project) return;
    
    setForking(true);
    const result = await forkProject(project.share_token, address);
    setForking(false);
    
    if (result.data) {
      navigate(`/shared/${result.data.share_token}`);
    }
  };

  const handleComment = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isConnected || !address) {
      setShowWalletModal(true);
      return;
    }
    
    if (!project || !commentText.trim()) return;
    
    setSubmittingComment(true);
    const result = await addComment(project.id, commentText.trim(), address);
    
    if (result.data) {
      setComments(prev => [result.data!, ...prev]);
      setCommentText('');
    }
    
    setSubmittingComment(false);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyEmbed = () => {
    if (!project) return;
    const code = generateEmbedCode(project.share_token);
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getLanguage = (filename: string) => {
    const ext = filename.split('.').pop()?.toLowerCase();
    const langMap: Record<string, string> = {
      'js': 'javascript',
      'jsx': 'javascript',
      'ts': 'typescript',
      'tsx': 'typescript',
      'html': 'html',
      'css': 'css',
      'scss': 'scss',
      'json': 'json',
      'md': 'markdown',
      'sol': 'solidity',
      'py': 'python'
    };
    return langMap[ext || ''] || 'plaintext';
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Project Not Found</h2>
          <p className="text-gray-500 mb-4">This project may have been deleted or the link is invalid.</p>
          <Link
            to="/explore"
            className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
          >
            <ArrowLeft className="w-4 h-4" />
            Browse Projects
          </Link>
        </div>
      </div>
    );
  }

  const currentFile = project.files[activeFile];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                to="/explore"
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              
              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                  {project.title}
                </h1>
                <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
                  <span className="flex items-center gap-1">
                    {project.author?.avatar_url ? (
                      <img
                        src={project.author.avatar_url}
                        alt=""
                        className="w-5 h-5 rounded-full"
                      />
                    ) : (
                      <User className="w-4 h-4" />
                    )}
                    {project.author?.username || 'Anonymous'}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    {formatDate(project.created_at)}
                  </span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleLike}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors",
                  liked
                    ? "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400"
                    : "bg-gray-100 dark:bg-gray-700 hover:bg-red-100 dark:hover:bg-red-900/30"
                )}
              >
                <Heart className={cn("w-4 h-4", liked && "fill-current")} />
                {likesCount}
              </button>

              <button
                onClick={handleFork}
                disabled={forking}
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg font-medium hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors"
              >
                {forking ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <GitFork className="w-4 h-4" />
                )}
                Fork
              </button>

              <div className="relative">
                <button
                  onClick={() => setShowShareMenu(!showShareMenu)}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition-colors"
                >
                  <Share2 className="w-4 h-4" />
                  Share
                </button>

                {showShareMenu && (
                  <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 py-2 z-20">
                    <button
                      onClick={handleCopyLink}
                      className="flex items-center gap-3 w-full px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                      <span>Copy Link</span>
                    </button>
                    <button
                      onClick={handleCopyEmbed}
                      className="flex items-center gap-3 w-full px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      <Code2 className="w-4 h-4" />
                      <span>Copy Embed Code</span>
                    </button>
                    <a
                      href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(window.location.href)}&text=${encodeURIComponent(`Check out "${project.title}" on Lyra Playground!`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 w-full px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      <ExternalLink className="w-4 h-4" />
                      <span>Share on Twitter</span>
                    </a>
                  </div>
                )}
              </div>

              <Link
                to={`/ide?fork=${project.share_token}`}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-medium hover:opacity-90 transition-opacity"
              >
                <Play className="w-4 h-4" />
                Open in IDE
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-6">
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Code Editor */}
          <div className="lg:col-span-2">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
              {/* File tabs */}
              <div className="flex items-center gap-1 px-2 py-2 bg-gray-100 dark:bg-gray-900 overflow-x-auto">
                {project.files.map((file, index) => (
                  <button
                    key={index}
                    onClick={() => setActiveFile(index)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors",
                      activeFile === index
                        ? "bg-white dark:bg-gray-800 shadow"
                        : "hover:bg-gray-200 dark:hover:bg-gray-700"
                    )}
                  >
                    {file.name}
                  </button>
                ))}
              </div>

              {/* Editor */}
              <div className="h-[500px]">
                <Editor
                  height="100%"
                  language={getLanguage(currentFile?.name || '')}
                  value={currentFile?.content || ''}
                  theme={mode === 'dark' ? 'vs-dark' : 'light'}
                  options={{
                    readOnly: true,
                    minimap: { enabled: false },
                    fontSize: 14,
                    lineNumbers: 'on',
                    scrollBeyondLastLine: false,
                    wordWrap: 'on',
                    padding: { top: 16 }
                  }}
                />
              </div>
            </div>

            {/* Comments Section */}
            <div className="mt-6 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                <MessageCircle className="w-5 h-5" />
                Comments ({comments.length})
              </h3>

              {/* Comment Form */}
              <form onSubmit={handleComment} className="mb-6">
                <div className="flex gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0">
                    {isConnected && address ? (
                      <span className="text-white text-xs font-bold">
                        {address.slice(2, 4).toUpperCase()}
                      </span>
                    ) : (
                      <Wallet className="w-5 h-5 text-white" />
                    )}
                  </div>
                  <div className="flex-1">
                    <textarea
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      placeholder={isConnected ? "Add a comment..." : "Connect wallet to comment"}
                      disabled={!isConnected}
                      rows={3}
                      className="w-full px-4 py-3 bg-gray-100 dark:bg-gray-900 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                    <div className="flex justify-end mt-2">
                      <button
                        type="submit"
                        disabled={!isConnected || !commentText.trim() || submittingComment}
                        className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg font-medium disabled:opacity-50 hover:bg-purple-700 transition-colors"
                      >
                        {submittingComment ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Send className="w-4 h-4" />
                        )}
                        Post
                      </button>
                    </div>
                  </div>
                </div>
              </form>

              {/* Comments List */}
              <div className="space-y-4">
                {comments.map((comment) => (
                  <div key={comment.id} className="flex gap-3">
                    <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
                      {comment.author?.avatar_url ? (
                        <img
                          src={comment.author.avatar_url}
                          alt=""
                          className="w-10 h-10 rounded-full"
                        />
                      ) : (
                        <User className="w-5 h-5 text-gray-400" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium">
                          {comment.author?.username || 'Anonymous'}
                        </span>
                        <span className="text-sm text-gray-500">
                          {formatDate(comment.created_at)}
                        </span>
                      </div>
                      <p className="text-gray-700 dark:text-gray-300">
                        {comment.content}
                      </p>
                    </div>
                  </div>
                ))}

                {comments.length === 0 && (
                  <p className="text-center text-gray-500 py-8">
                    No comments yet. Be the first to comment!
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Description */}
            {project.description && (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="font-semibold mb-3">About</h3>
                <p className="text-gray-600 dark:text-gray-300">
                  {project.description}
                </p>
              </div>
            )}

            {/* Stats */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="font-semibold mb-4">Stats</h3>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-purple-600">{likesCount}</div>
                  <div className="text-sm text-gray-500">Likes</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-purple-600">{project.views_count}</div>
                  <div className="text-sm text-gray-500">Views</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-purple-600">{project.forks_count}</div>
                  <div className="text-sm text-gray-500">Forks</div>
                </div>
              </div>
            </div>

            {/* Tags */}
            {project.tags.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="font-semibold mb-3">Tags</h3>
                <div className="flex flex-wrap gap-2">
                  {project.tags.map((tag, i) => (
                    <Link
                      key={i}
                      to={`/explore?tag=${tag}`}
                      className="px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-full text-sm hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors"
                    >
                      #{tag}
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Files */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="font-semibold mb-3">Files ({project.files.length})</h3>
              <div className="space-y-2">
                {project.files.map((file, index) => (
                  <button
                    key={index}
                    onClick={() => setActiveFile(index)}
                    className={cn(
                      "flex items-center gap-2 w-full px-3 py-2 rounded-lg text-left transition-colors",
                      activeFile === index
                        ? "bg-purple-100 dark:bg-purple-900/30 text-purple-600"
                        : "hover:bg-gray-100 dark:hover:bg-gray-700"
                    )}
                  >
                    <Code2 className="w-4 h-4" />
                    {file.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Author */}
            {project.author && (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="font-semibold mb-4">Author</h3>
                <div className="flex items-center gap-3">
                  {project.author.avatar_url ? (
                    <img
                      src={project.author.avatar_url}
                      alt=""
                      className="w-12 h-12 rounded-full"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                      <User className="w-6 h-6 text-gray-400" />
                    </div>
                  )}
                  <div>
                    <div className="font-medium">{project.author.username || 'Anonymous'}</div>
                  </div>
                </div>
              </div>
            )}

            {/* Embed Code */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="font-semibold mb-3">Embed</h3>
              <div className="bg-gray-100 dark:bg-gray-900 rounded-lg p-3 text-xs font-mono break-all">
                {generateEmbedCode(project.share_token)}
              </div>
              <button
                onClick={handleCopyEmbed}
                className="mt-3 flex items-center gap-2 text-sm text-purple-600 hover:text-purple-700"
              >
                <Copy className="w-4 h-4" />
                Copy embed code
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Wallet Connect Modal */}
      {showWalletModal && (
        <WalletConnect onClose={() => setShowWalletModal(false)} />
      )}
    </div>
  );
}
