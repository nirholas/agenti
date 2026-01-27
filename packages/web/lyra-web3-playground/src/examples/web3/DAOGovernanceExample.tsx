/**
 * ✨ built by nich
 * 🌐 GitHub: github.com/nirholas
 * 💫 Write code that makes you proud 🏆
 */

import { useState } from 'react';
import { Vote, Users, TrendingUp, CheckCircle, XCircle, Clock } from 'lucide-react';

interface Proposal {
  id: number;
  title: string;
  description: string;
  proposer: string;
  status: 'active' | 'passed' | 'rejected' | 'executed';
  votesFor: number;
  votesAgainst: number;
  votesAbstain: number;
  quorum: number;
  deadline: number;
  voters: Set<string>;
}

export default function DAOGovernanceExample() {
  const [proposals, setProposals] = useState<Proposal[]>([
    {
      id: 1,
      title: 'Increase Development Fund by 10%',
      description: 'Proposal to allocate an additional 10% of treasury funds to development initiatives.',
      proposer: '0x1234...5678',
      status: 'active',
      votesFor: 15000,
      votesAgainst: 5000,
      votesAbstain: 2000,
      quorum: 20000,
      deadline: Date.now() + 86400000 * 3,
      voters: new Set(),
    },
    {
      id: 2,
      title: 'Add New Token to Whitelist',
      description: 'Propose adding MATIC token to the approved trading list.',
      proposer: '0xabcd...efgh',
      status: 'active',
      votesFor: 8000,
      votesAgainst: 12000,
      votesAbstain: 1000,
      quorum: 15000,
      deadline: Date.now() + 86400000 * 2,
      voters: new Set(),
    },
  ]);

  const [newProposal, setNewProposal] = useState({ title: '', description: '' });
  const [userAddress] = useState('0x9876...4321'); // Simulated user address
  const [votingPower] = useState(1000); // Simulated voting power

  const handleVote = (proposalId: number, voteType: 'for' | 'against' | 'abstain') => {
    setProposals(proposals.map(p => {
      if (p.id === proposalId) {
        if (p.voters.has(userAddress)) {
          alert('You have already voted on this proposal!');
          return p;
        }

        const newVoters = new Set(p.voters);
        newVoters.add(userAddress);

        return {
          ...p,
          votesFor: voteType === 'for' ? p.votesFor + votingPower : p.votesFor,
          votesAgainst: voteType === 'against' ? p.votesAgainst + votingPower : p.votesAgainst,
          votesAbstain: voteType === 'abstain' ? p.votesAbstain + votingPower : p.votesAbstain,
          voters: newVoters,
        };
      }
      return p;
    }));
  };

  const handleCreateProposal = () => {
    if (!newProposal.title || !newProposal.description) {
      alert('Please fill in all fields');
      return;
    }

    const proposal: Proposal = {
      id: proposals.length + 1,
      title: newProposal.title,
      description: newProposal.description,
      proposer: userAddress,
      status: 'active',
      votesFor: 0,
      votesAgainst: 0,
      votesAbstain: 0,
      quorum: 10000,
      deadline: Date.now() + 86400000 * 7,
      voters: new Set(),
    };

    setProposals([...proposals, proposal]);
    setNewProposal({ title: '', description: '' });
  };

  const calculateProgress = (proposal: Proposal) => {
    const totalVotes = proposal.votesFor + proposal.votesAgainst + proposal.votesAbstain;
    return (totalVotes / proposal.quorum) * 100;
  };

  const getTimeRemaining = (deadline: number) => {
    const remaining = deadline - Date.now();
    const days = Math.floor(remaining / 86400000);
    const hours = Math.floor((remaining % 86400000) / 3600000);
    return `${days}d ${hours}h`;
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">DAO Governance</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Create and vote on proposals to govern the protocol
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="card">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">Your Voting Power</span>
            <Vote className="w-5 h-5 text-purple-600" />
          </div>
          <p className="text-2xl font-bold">{votingPower.toLocaleString()}</p>
        </div>
        
        <div className="card">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">Active Proposals</span>
            <TrendingUp className="w-5 h-5 text-blue-600" />
          </div>
          <p className="text-2xl font-bold">
            {proposals.filter(p => p.status === 'active').length}
          </p>
        </div>
        
        <div className="card">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">Total Members</span>
            <Users className="w-5 h-5 text-green-600" />
          </div>
          <p className="text-2xl font-bold">1,247</p>
        </div>
      </div>

      {/* Create Proposal */}
      <div className="card mb-8">
        <h2 className="text-xl font-bold mb-4">Create New Proposal</h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Title</label>
            <input
              type="text"
              value={newProposal.title}
              onChange={(e) => setNewProposal({ ...newProposal, title: e.target.value })}
              placeholder="Enter proposal title"
              className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Description</label>
            <textarea
              value={newProposal.description}
              onChange={(e) => setNewProposal({ ...newProposal, description: e.target.value })}
              placeholder="Describe your proposal in detail"
              rows={4}
              className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
            />
          </div>

          <button
            onClick={handleCreateProposal}
            className="w-full btn-primary"
          >
            Submit Proposal
          </button>
        </div>
      </div>

      {/* Proposals List */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold">Active Proposals</h2>
        
        {proposals.map(proposal => {
          const totalVotes = proposal.votesFor + proposal.votesAgainst + proposal.votesAbstain;
          const forPercentage = totalVotes > 0 ? (proposal.votesFor / totalVotes) * 100 : 0;
          const againstPercentage = totalVotes > 0 ? (proposal.votesAgainst / totalVotes) * 100 : 0;
          const progress = calculateProgress(proposal);
          const hasVoted = proposal.voters.has(userAddress);

          return (
            <div key={proposal.id} className="card">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-lg font-bold">{proposal.title}</h3>
                    <span className={`text-xs px-2 py-1 rounded ${
                      proposal.status === 'active' ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' :
                      proposal.status === 'passed' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300' :
                      'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'
                    }`}>
                      {proposal.status.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                    {proposal.description}
                  </p>
                  <p className="text-xs text-gray-500">
                    Proposed by {proposal.proposer}
                  </p>
                </div>
                <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                  <Clock className="w-4 h-4 mr-1" />
                  {getTimeRemaining(proposal.deadline)}
                </div>
              </div>

              {/* Voting Stats */}
              <div className="mb-4">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-600 dark:text-gray-400">
                    Progress to Quorum: {progress.toFixed(1)}%
                  </span>
                  <span className="font-semibold">
                    {totalVotes.toLocaleString()} / {proposal.quorum.toLocaleString()} votes
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-3">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all"
                    style={{ width: `${Math.min(progress, 100)}%` }}
                  />
                </div>

                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="flex items-center justify-center mb-1">
                      <CheckCircle className="w-4 h-4 text-green-600 mr-1" />
                      <span className="text-xs text-gray-600 dark:text-gray-400">For</span>
                    </div>
                    <p className="font-bold text-green-600">{forPercentage.toFixed(1)}%</p>
                    <p className="text-xs text-gray-500">{proposal.votesFor.toLocaleString()}</p>
                  </div>
                  <div>
                    <div className="flex items-center justify-center mb-1">
                      <XCircle className="w-4 h-4 text-red-600 mr-1" />
                      <span className="text-xs text-gray-600 dark:text-gray-400">Against</span>
                    </div>
                    <p className="font-bold text-red-600">{againstPercentage.toFixed(1)}%</p>
                    <p className="text-xs text-gray-500">{proposal.votesAgainst.toLocaleString()}</p>
                  </div>
                  <div>
                    <div className="flex items-center justify-center mb-1">
                      <span className="text-xs text-gray-600 dark:text-gray-400">Abstain</span>
                    </div>
                    <p className="font-bold text-gray-600">
                      {totalVotes > 0 ? ((proposal.votesAbstain / totalVotes) * 100).toFixed(1) : 0}%
                    </p>
                    <p className="text-xs text-gray-500">{proposal.votesAbstain.toLocaleString()}</p>
                  </div>
                </div>
              </div>

              {/* Voting Buttons */}
              {proposal.status === 'active' && (
                <div className="flex gap-2">
                  <button
                    onClick={() => handleVote(proposal.id, 'for')}
                    disabled={hasVoted}
                    className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-lg transition-colors disabled:cursor-not-allowed"
                  >
                    Vote For
                  </button>
                  <button
                    onClick={() => handleVote(proposal.id, 'against')}
                    disabled={hasVoted}
                    className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white rounded-lg transition-colors disabled:cursor-not-allowed"
                  >
                    Vote Against
                  </button>
                  <button
                    onClick={() => handleVote(proposal.id, 'abstain')}
                    disabled={hasVoted}
                    className="flex-1 px-4 py-2 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-400 text-white rounded-lg transition-colors disabled:cursor-not-allowed"
                  >
                    Abstain
                  </button>
                </div>
              )}

              {hasVoted && (
                <div className="mt-2 text-sm text-green-600 dark:text-green-400 text-center">
                  ✓ You have voted on this proposal
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Demo Notice */}
      <div className="card bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 mt-6">
        <p className="text-sm text-blue-900 dark:text-blue-200">
          <strong>Demo Mode:</strong> This is a simulation of DAO governance systems like Compound Governance or Snapshot. 
          In production, voting would be recorded on-chain with your token holdings determining voting power.
        </p>
      </div>
    </div>
  );
}
