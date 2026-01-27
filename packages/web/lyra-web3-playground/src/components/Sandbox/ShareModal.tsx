/**
 * ✨ built by nich
 * 🌐 GitHub: github.com/nirholas
 * 💫 Keep calm and code on 🧘
 */

/**
 * ShareModal.tsx - Modal for sharing projects to the community
 */
import { useState } from 'react';
import {
  X,
  Share2,
  Globe,
  Lock,
  Link as LinkIcon,
  Copy,
  Check,
  Loader2,
  Tag,
  FileText,
  Code2,
  BookOpen,
  Sparkles,
  ExternalLink,
  Twitter,
  Github,
  Mail,
  AlertCircle
} from 'lucide-react';
import { cn } from '@/utils/helpers';
import { shareProject, generateEmbedCode, ProjectFile } from '@/services/community';
import { useWalletStore } from '@/stores/walletStore';
import WalletConnect from '@/components/WalletConnect';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectData: {
    title?: string;
    description?: string;
    files: { filename: string; content: string }[];
    category?: 'sandbox' | 'template' | 'tutorial' | 'example';
  };
  onShare?: (shareUrl: string) => void;
}

type Visibility = 'public' | 'unlisted' | 'private';

const categories = [
  { id: 'sandbox', label: 'Sandbox', icon: Code2, description: 'A code playground or experiment' },
  { id: 'template', label: 'Template', icon: FileText, description: 'Reusable starter code' },
  { id: 'tutorial', label: 'Tutorial', icon: BookOpen, description: 'Educational content' },
  { id: 'example', label: 'Example', icon: Sparkles, description: 'Demo or showcase' },
];

export default function ShareModal({ isOpen, onClose, projectData, onShare }: ShareModalProps) {
  const { address, isConnected } = useWalletStore();
  const [showWalletModal, setShowWalletModal] = useState(false);
  
  const [title, setTitle] = useState(projectData.title || '');
  const [description, setDescription] = useState(projectData.description || '');
  const [category, setCategory] = useState<'sandbox' | 'template' | 'tutorial' | 'example'>(projectData.category || 'sandbox');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [visibility, setVisibility] = useState<Visibility>('public');
  
  const [step, setStep] = useState<'form' | 'success'>('form');
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [shareUrl, setShareUrl] = useState('');
  const [embedCode, setEmbedCode] = useState('');
  const [copied, setCopied] = useState<'url' | 'embed' | null>(null);

  const handleAddTag = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const tag = tagInput.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
      if (tag && !tags.includes(tag) && tags.length < 5) {
        setTags([...tags, tag]);
        setTagInput('');
      }
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(t => t !== tagToRemove));
  };

  const handleShare = async () => {
    if (!isConnected || !address) {
      setError('Please connect your wallet to share');
      setShowWalletModal(true);
      return;
    }

    if (!title.trim()) {
      setError('Please enter a title for your project');
      return;
    }

    setSharing(true);
    setError(null);

    const files: ProjectFile[] = projectData.files.map((f) => ({
      name: f.filename,
      content: f.content,
      language: getLanguageFromFilename(f.filename)
    }));

    const result = await shareProject({
      title: title.trim(),
      description: description.trim(),
      files,
      category,
      tags
    });

    setSharing(false);

    if (result.shareUrl) {
      setShareUrl(result.shareUrl);
      setEmbedCode(generateEmbedCode(result.data?.share_token || ''));
      setStep('success');
      onShare?.(result.shareUrl);
    } else {
      setError(result.error || 'Failed to share project. Please try again.');
    }
  };

  const getLanguageFromFilename = (filename: string) => {
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

  const handleCopy = async (type: 'url' | 'embed') => {
    const text = type === 'url' ? shareUrl : embedCode;
    await navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <Share2 className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <h2 className="text-xl font-bold">
              {step === 'form' ? 'Share Project' : 'Shared Successfully!'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[70vh] overflow-y-auto">
          {step === 'form' ? (
            <div className="space-y-5">
              {/* Error */}
              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Title */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="My Awesome Project"
                  maxLength={100}
                  className="w-full px-4 py-3 bg-gray-100 dark:bg-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe what your project does..."
                  rows={3}
                  maxLength={500}
                  className="w-full px-4 py-3 bg-gray-100 dark:bg-gray-900 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              {/* Category */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Category
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {categories.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => setCategory(cat.id as any)}
                      className={cn(
                        "flex items-center gap-2 p-3 rounded-lg border-2 transition-colors text-left",
                        category === cat.id
                          ? "border-purple-500 bg-purple-50 dark:bg-purple-900/20"
                          : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                      )}
                    >
                      <cat.icon className={cn(
                        "w-5 h-5",
                        category === cat.id ? "text-purple-600" : "text-gray-400"
                      )} />
                      <div>
                        <div className="font-medium text-sm">{cat.label}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Tags */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Tags <span className="text-gray-400">(up to 5)</span>
                </label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {tags.map((tag) => (
                    <span
                      key={tag}
                      className="flex items-center gap-1 px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-full text-sm"
                    >
                      #{tag}
                      <button
                        onClick={() => handleRemoveTag(tag)}
                        className="p-0.5 hover:bg-purple-200 dark:hover:bg-purple-900/50 rounded-full"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={handleAddTag}
                  placeholder="Add tags (press Enter)"
                  disabled={tags.length >= 5}
                  className="w-full px-4 py-2 bg-gray-100 dark:bg-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
                />
              </div>

              {/* Visibility */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Visibility
                </label>
                <div className="space-y-2">
                  <button
                    onClick={() => setVisibility('public')}
                    className={cn(
                      "flex items-center gap-3 w-full p-3 rounded-lg border-2 transition-colors text-left",
                      visibility === 'public'
                        ? "border-purple-500 bg-purple-50 dark:bg-purple-900/20"
                        : "border-gray-200 dark:border-gray-700"
                    )}
                  >
                    <Globe className={cn(
                      "w-5 h-5",
                      visibility === 'public' ? "text-purple-600" : "text-gray-400"
                    )} />
                    <div>
                      <div className="font-medium text-sm">Public</div>
                      <div className="text-xs text-gray-500">Anyone can discover and view</div>
                    </div>
                  </button>
                  <button
                    onClick={() => setVisibility('unlisted')}
                    className={cn(
                      "flex items-center gap-3 w-full p-3 rounded-lg border-2 transition-colors text-left",
                      visibility === 'unlisted'
                        ? "border-purple-500 bg-purple-50 dark:bg-purple-900/20"
                        : "border-gray-200 dark:border-gray-700"
                    )}
                  >
                    <LinkIcon className={cn(
                      "w-5 h-5",
                      visibility === 'unlisted' ? "text-purple-600" : "text-gray-400"
                    )} />
                    <div>
                      <div className="font-medium text-sm">Unlisted</div>
                      <div className="text-xs text-gray-500">Only people with link can view</div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Files Preview */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Files ({projectData.files.length})
                </label>
                <div className="bg-gray-100 dark:bg-gray-900 rounded-lg p-3 space-y-1 max-h-32 overflow-y-auto">
                  {projectData.files.map((file, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <Code2 className="w-4 h-4 text-gray-400" />
                      {file.filename}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center">
              {/* Success illustration */}
              <div className="w-20 h-20 mx-auto mb-6 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                <Check className="w-10 h-10 text-green-500" />
              </div>

              <h3 className="text-lg font-semibold mb-2">Your project is live!</h3>
              <p className="text-gray-500 mb-6">Share it with the world</p>

              {/* Share URL */}
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2 text-left">
                  Share Link
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={shareUrl}
                    readOnly
                    className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-900 rounded-lg text-sm"
                  />
                  <button
                    onClick={() => handleCopy('url')}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                  >
                    {copied === 'url' ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {/* Embed Code */}
              <div className="mb-6">
                <label className="block text-sm font-medium mb-2 text-left">
                  Embed Code
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={embedCode}
                    readOnly
                    className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-900 rounded-lg text-sm font-mono text-xs"
                  />
                  <button
                    onClick={() => handleCopy('embed')}
                    className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                  >
                    {copied === 'embed' ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {/* Social Share */}
              <div className="flex items-center justify-center gap-3">
                <a
                  href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(`Check out my project "${title}" on Lyra Playground!`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 bg-[#1DA1F2] text-white rounded-lg hover:opacity-90 transition-opacity"
                >
                  <Twitter className="w-4 h-4" />
                  Tweet
                </a>
                <a
                  href={shareUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                  View
                </a>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {step === 'form' && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleShare}
              disabled={sharing || !title.trim()}
              className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-medium disabled:opacity-50 hover:opacity-90 transition-opacity"
            >
              {sharing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Share2 className="w-4 h-4" />
              )}
              Share
            </button>
          </div>
        )}
      </div>
      
      {/* Wallet Connect Modal */}
      {showWalletModal && (
        <WalletConnect onClose={() => setShowWalletModal(false)} />
      )}
    </div>
  );
}
