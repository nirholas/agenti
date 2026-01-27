/**
 * ✨ built by nich
 * 🌐 GitHub: github.com/nirholas
 * 💫 Every semicolon has a purpose 😊
 */

import { useState, useEffect, useRef } from 'react';
import {
  Users,
  Radio,
  MessageSquare,
  Code2,
  Zap,
  Crown,
  Trophy,
  Target,
  Timer,
  Sparkles,
  TrendingUp,
  Award,
  Star,
  Rocket
} from 'lucide-react';

interface Participant {
  id: string;
  name: string;
  avatar: string;
  cursor: { line: number; column: number };
  color: string;
  score: number;
  rank: 'novice' | 'intermediate' | 'expert' | 'master';
  isAI: boolean;
  status: 'typing' | 'thinking' | 'idle';
}

interface CodeChallenge {
  id: string;
  title: string;
  description: string;
  difficulty: 'easy' | 'medium' | 'hard' | 'insane';
  timeLimit: number;
  bounty: number;
  testCases: Array<{ input: any; expected: any }>;
  hints: string[];
}

interface LiveEdit {
  participantId: string;
  line: number;
  change: string;
  timestamp: number;
}

export default function CollaborativeArena({
  code,
  onCodeChange,
  onLog
}: {
  code: string;
  onCodeChange: (code: string) => void;
  onLog: (type: 'info' | 'success' | 'error' | 'warning', message: string) => void;
}) {
  const [participants, setParticipants] = useState<Participant[]>([
    {
      id: 'user-1',
      name: 'You',
      avatar: '👤',
      cursor: { line: 1, column: 1 },
      color: '#3B82F6',
      score: 0,
      rank: 'intermediate',
      isAI: false,
      status: 'idle'
    }
  ]);

  const [aiAssistants, setAiAssistants] = useState<Participant[]>([]);
  const [liveEdits, setLiveEdits] = useState<LiveEdit[]>([]);
  const [challenge, setChallenge] = useState<CodeChallenge | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [messages, setMessages] = useState<Array<{
    id: string;
    sender: string;
    message: string;
    timestamp: number;
    type: 'chat' | 'system' | 'hint' | 'achievement';
  }>>([]);
  const [showChat, setShowChat] = useState(true);
  const [competitiveMode, setCompetitiveMode] = useState(false);
  const [collaborationScore, setCollaborationScore] = useState(0);

  const challenges: CodeChallenge[] = [
    {
      id: 'defi-swap',
      title: '💱 DeFi Token Swap',
      description: 'Build a secure token swap function with slippage protection',
      difficulty: 'hard',
      timeLimit: 300,
      bounty: 500,
      testCases: [
        { input: { tokenA: 100, tokenB: 200 }, expected: { success: true } }
      ],
      hints: [
        'Consider using the constant product formula',
        'Add slippage tolerance checks',
        'Protect against reentrancy'
      ]
    },
    {
      id: 'nft-auction',
      title: '🎨 NFT Auction Contract',
      description: 'Create an English auction for NFTs with auto-refunds',
      difficulty: 'medium',
      timeLimit: 240,
      bounty: 350,
      testCases: [
        { input: { bid: 1000 }, expected: { highestBid: 1000 } }
      ],
      hints: [
        'Track highest bidder and amount',
        'Implement withdrawal pattern',
        'Add time-based auction end'
      ]
    },
    {
      id: 'multisig-wallet',
      title: '🔐 Multi-Signature Wallet',
      description: 'Build a wallet requiring M-of-N signatures',
      difficulty: 'insane',
      timeLimit: 420,
      bounty: 1000,
      testCases: [
        { input: { required: 2, total: 3 }, expected: { success: true } }
      ],
      hints: [
        'Use arrays to track approvals',
        'Implement execute only when threshold met',
        'Consider replay attack protection'
      ]
    }
  ];

  // Spawn AI Assistants
  const spawnAIAssistant = (type: 'copilot' | 'mentor' | 'critic') => {
    const aiProfiles = {
      copilot: {
        name: '🤖 CodePilot',
        avatar: '🤖',
        color: '#8B5CF6',
        rank: 'expert' as const,
        personality: 'writes clean, efficient code'
      },
      mentor: {
        name: '👨‍🏫 Professor AI',
        avatar: '👨‍🏫',
        color: '#10B981',
        rank: 'master' as const,
        personality: 'explains concepts and best practices'
      },
      critic: {
        name: '🔍 Security Auditor',
        avatar: '🔍',
        color: '#EF4444',
        rank: 'expert' as const,
        personality: 'finds vulnerabilities and suggests fixes'
      }
    };

    const profile = aiProfiles[type];
    const newAI: Participant = {
      id: `ai-${Date.now()}`,
      ...profile,
      cursor: { line: 1, column: 1 },
      score: 0,
      isAI: true,
      status: 'idle'
    };

    setAiAssistants(prev => [...prev, newAI]);
    setParticipants(prev => [...prev, newAI]);
    
    addMessage('system', `${profile.name} joined the arena!`, 'system');
    onLog('success', `✨ ${profile.name} is now assisting you!`);

    // AI starts contributing
    setTimeout(() => aiContribute(newAI, type), 2000);
  };

  const aiContribute = (ai: Participant, type: 'copilot' | 'mentor' | 'critic') => {
    const contributions = {
      copilot: [
        '💡 I can optimize this loop for better gas efficiency',
        '🔧 Let me add error handling here',
        '✨ I\'ll implement the missing function'
      ],
      mentor: [
        '📚 This pattern is called "Checks-Effects-Interactions"',
        '🎓 Consider using OpenZeppelin\'s implementation',
        '💭 Here\'s why we use this approach...'
      ],
      critic: [
        '⚠️ This could be vulnerable to reentrancy',
        '🔒 Missing access control on this function',
        '🛡️ Add input validation here'
      ]
    };

    const contribution = contributions[type][Math.floor(Math.random() * contributions[type].length)];
    addMessage(ai.name, contribution, 'hint');

    // Simulate AI typing
    setParticipants(prev =>
      prev.map(p => p.id === ai.id ? { ...p, status: 'typing' as const } : p)
    );

    setTimeout(() => {
      setParticipants(prev =>
        prev.map(p => p.id === ai.id ? { ...p, status: 'idle' as const } : p)
      );
    }, 2000);
  };

  const startChallenge = (challengeId: string) => {
    const selectedChallenge = challenges.find(c => c.id === challengeId);
    if (!selectedChallenge) return;

    setChallenge(selectedChallenge);
    setTimeRemaining(selectedChallenge.timeLimit);
    addMessage('system', `🎯 Challenge Started: ${selectedChallenge.title}`, 'system');
    addMessage('system', selectedChallenge.description, 'system');
    onLog('info', `⏱️ You have ${selectedChallenge.timeLimit} seconds!`);
  };

  // Timer
  useEffect(() => {
    if (timeRemaining !== null && timeRemaining > 0) {
      const timer = setTimeout(() => setTimeRemaining(timeRemaining - 1), 1000);
      return () => clearTimeout(timer);
    } else if (timeRemaining === 0) {
      endChallenge(false);
    }
  }, [timeRemaining]);

  const endChallenge = (success: boolean) => {
    if (success) {
      const earnedScore = challenge?.bounty || 0;
      setCollaborationScore(prev => prev + earnedScore);
      addMessage('system', `🎉 Challenge Complete! +${earnedScore} points`, 'achievement');
      onLog('success', `🏆 Earned ${earnedScore} points!`);
    } else {
      addMessage('system', '⏰ Time\'s up! Better luck next time.', 'system');
      onLog('warning', '⏰ Challenge expired');
    }
    setChallenge(null);
    setTimeRemaining(null);
  };

  const addMessage = (sender: string, message: string, type: 'chat' | 'system' | 'hint' | 'achievement') => {
    setMessages(prev => [
      ...prev,
      {
        id: `msg-${Date.now()}`,
        sender,
        message,
        timestamp: Date.now(),
        type
      }
    ].slice(-50)); // Keep last 50 messages
  };

  const submitSolution = () => {
    if (!challenge) return;

    // Simulate testing
    onLog('info', '🧪 Testing solution...');
    
    setTimeout(() => {
      const success = Math.random() > 0.3; // 70% success rate for demo
      
      if (success) {
        endChallenge(true);
        
        // Award points to all participants
        setParticipants(prev =>
          prev.map(p => ({ ...p, score: p.score + 50 }))
        );
      } else {
        addMessage('system', '❌ Tests failed. Check the hints!', 'system');
        onLog('error', '❌ Solution doesn\'t pass all test cases');
      }
    }, 1500);
  };

  const getDifficultyColor = (diff: string) => {
    switch (diff) {
      case 'easy': return 'text-green-600 bg-green-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'hard': return 'text-orange-600 bg-orange-100';
      case 'insane': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getRankBadge = (rank: string) => {
    const badges = {
      novice: '🌱',
      intermediate: '⚡',
      expert: '🔥',
      master: '👑'
    };
    return badges[rank as keyof typeof badges] || '🌱';
  };

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-violet-50 to-fuchsia-50 dark:from-gray-900 dark:to-violet-900/20">
      {/* Header */}
      <div className="p-4 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <Users className="w-6 h-6" />
            <h3 className="font-bold text-lg">Collaborative Arena</h3>
            <span className="px-2 py-0.5 text-xs bg-amber-400/20 text-amber-200 rounded border border-amber-400/30">
              Concept Demo
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="px-3 py-1 bg-white/20 rounded-full text-sm">
              <Trophy className="w-4 h-4 inline mr-1" />
              {collaborationScore} pts
            </div>
          </div>
        </div>

        {/* Mode Toggle */}
        <div className="flex items-center space-x-4 text-sm">
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={competitiveMode}
              onChange={(e) => setCompetitiveMode(e.target.checked)}
              className="rounded"
            />
            <span>⚔️ Competitive Mode</span>
          </label>
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showChat}
              onChange={(e) => setShowChat(e.target.checked)}
              className="rounded"
            />
            <span>💬 Show Chat</span>
          </label>
        </div>
      </div>

      {/* Active Challenge Banner */}
      {challenge && (
        <div className="p-4 bg-gradient-to-r from-amber-100 to-orange-100 dark:from-amber-900/30 dark:to-orange-900/30 border-b border-amber-300 dark:border-amber-800">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-bold text-amber-900 dark:text-amber-100">{challenge.title}</h4>
              <p className="text-xs text-amber-700 dark:text-amber-300">{challenge.description}</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-amber-900 dark:text-amber-100">
                <Timer className="w-5 h-5 inline mr-1" />
                {Math.floor((timeRemaining || 0) / 60)}:{String((timeRemaining || 0) % 60).padStart(2, '0')}
              </div>
              <div className="text-xs text-amber-700 dark:text-amber-300">
                🏆 {challenge.bounty} points
              </div>
            </div>
          </div>
          <button
            onClick={submitSolution}
            className="mt-3 w-full px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg font-medium hover:from-green-700 hover:to-emerald-700 transition-all"
          >
            <Rocket className="w-4 h-4 inline mr-2" />
            Submit Solution
          </button>
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        {/* Participants Panel */}
        <div className="w-64 border-r border-violet-200 dark:border-violet-800 bg-white/50 dark:bg-gray-800/50 overflow-y-auto">
          <div className="p-4">
            <h4 className="text-sm font-bold mb-3 flex items-center">
              <Users className="w-4 h-4 mr-2" />
              Active Coders ({participants.length})
            </h4>

            <div className="space-y-2 mb-4">
              {participants.map((participant) => (
                <div
                  key={participant.id}
                  className="p-3 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
                  style={{ borderLeft: `4px solid ${participant.color}` }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <span className="text-2xl">{participant.avatar}</span>
                      <div>
                        <div className="font-semibold text-sm">{participant.name}</div>
                        <div className="text-xs text-gray-500 flex items-center space-x-1">
                          <span>{getRankBadge(participant.rank)}</span>
                          <span>{participant.rank}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-600 dark:text-gray-400">
                      {participant.status === 'typing' ? '✍️ typing...' : 
                       participant.status === 'thinking' ? '🤔 thinking...' : '💤 idle'}
                    </span>
                    <span className="font-bold text-violet-600">
                      <Star className="w-3 h-3 inline" /> {participant.score}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Spawn AI Helpers */}
            <div className="space-y-2">
              <h5 className="text-xs font-bold text-gray-600 dark:text-gray-400 mb-2">
                ✨ Summon AI Helpers
              </h5>
              <button
                onClick={() => spawnAIAssistant('copilot')}
                disabled={aiAssistants.some(ai => ai.name.includes('CodePilot'))}
                className="w-full px-3 py-2 bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 rounded-lg text-xs font-medium hover:bg-violet-200 dark:hover:bg-violet-900/50 transition-all disabled:opacity-50"
              >
                🤖 Code Copilot
              </button>
              <button
                onClick={() => spawnAIAssistant('mentor')}
                disabled={aiAssistants.some(ai => ai.name.includes('Professor'))}
                className="w-full px-3 py-2 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-lg text-xs font-medium hover:bg-green-200 dark:hover:bg-green-900/50 transition-all disabled:opacity-50"
              >
                👨‍🏫 AI Mentor
              </button>
              <button
                onClick={() => spawnAIAssistant('critic')}
                disabled={aiAssistants.some(ai => ai.name.includes('Auditor'))}
                className="w-full px-3 py-2 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg text-xs font-medium hover:bg-red-200 dark:hover:bg-red-900/50 transition-all disabled:opacity-50"
              >
                🔍 Security Critic
              </button>
            </div>
          </div>
        </div>

        {/* Chat/Activity Feed */}
        {showChat && (
          <div className="flex-1 flex flex-col">
            {/* Challenges */}
            {!challenge && (
              <div className="p-4 bg-gradient-to-r from-violet-100 to-fuchsia-100 dark:from-violet-900/20 dark:to-fuchsia-900/20 border-b border-violet-200 dark:border-violet-800">
                <h4 className="text-sm font-bold mb-3 flex items-center">
                  <Target className="w-4 h-4 mr-2" />
                  Available Challenges
                </h4>
                <div className="space-y-2">
                  {challenges.map((ch) => (
                    <button
                      key={ch.id}
                      onClick={() => startChallenge(ch.id)}
                      className="w-full p-3 bg-white dark:bg-gray-800 rounded-lg text-left hover:shadow-lg transition-all border border-violet-200 dark:border-violet-700"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold text-sm">{ch.title}</span>
                        <span className={`px-2 py-1 text-xs rounded-full ${getDifficultyColor(ch.difficulty)}`}>
                          {ch.difficulty}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">{ch.description}</p>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-500">
                          <Timer className="w-3 h-3 inline" /> {ch.timeLimit}s
                        </span>
                        <span className="text-amber-600 font-bold">
                          <Trophy className="w-3 h-3 inline" /> {ch.bounty} pts
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`p-3 rounded-lg ${
                    msg.type === 'system'
                      ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200'
                      : msg.type === 'achievement'
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200'
                      : msg.type === 'hint'
                      ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200'
                      : 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200'
                  }`}
                >
                  <div className="flex items-start space-x-2">
                    <span className="font-semibold text-sm">{msg.sender}:</span>
                    <span className="text-sm flex-1">{msg.message}</span>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {new Date(msg.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              ))}
            </div>

            {/* Input */}
            <div className="p-4 border-t border-violet-200 dark:border-violet-800 bg-white dark:bg-gray-800">
              <div className="flex space-x-2">
                <input
                  type="text"
                  placeholder="Send a message..."
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && e.currentTarget.value) {
                      addMessage('You', e.currentTarget.value, 'chat');
                      e.currentTarget.value = '';
                    }
                  }}
                />
                <button className="px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-all">
                  <MessageSquare className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Leaderboard Footer */}
      <div className="p-3 bg-gradient-to-r from-violet-100 to-fuchsia-100 dark:from-violet-900/30 dark:to-fuchsia-900/30 border-t border-violet-200 dark:border-violet-800">
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-600 dark:text-gray-400">
            🎯 {participants.length} active • {messages.filter(m => m.type === 'chat').length} messages
          </span>
          <span className="text-gray-600 dark:text-gray-400 flex items-center space-x-1">
            <TrendingUp className="w-3 h-3" />
            <span>Collaboration Score: {collaborationScore}</span>
          </span>
        </div>
      </div>
    </div>
  );
}
