/**
 * ✨ built by nich
 * 🌐 GitHub: github.com/nirholas
 * 💫 Shipping features and spreading joy 🎁
 */

/**
 * Community Services - Sharing, Publishing, and Social Features
 */
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

// =============================================================================
// TYPES
// =============================================================================

export interface SharedProject {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  files: ProjectFile[];
  template_id: string | null;
  category: 'sandbox' | 'template' | 'tutorial' | 'example';
  tags: string[];
  is_public: boolean;
  share_token: string;
  likes_count: number;
  views_count: number;
  forks_count: number;
  created_at: string;
  updated_at: string;
  // Joined data
  author?: {
    id: string;
    username: string | null;
    avatar_url: string | null;
  };
}

export interface ProjectFile {
  name: string;
  content: string;
  language: string;
}

export interface ProjectComment {
  id: string;
  project_id: string;
  user_id: string;
  content: string;
  created_at: string;
  author?: {
    username: string | null;
    avatar_url: string | null;
  };
}

export interface ProjectLike {
  id: string;
  project_id: string;
  user_id: string;
  created_at: string;
}

export interface CommunityTemplate {
  id: string;
  user_id: string;
  name: string;
  description: string;
  code: string;
  category: string;
  tags: string[];
  is_approved: boolean;
  downloads_count: number;
  created_at: string;
  author?: {
    username: string | null;
    avatar_url: string | null;
  };
}

export interface TutorialSubmission {
  id: string;
  user_id: string;
  title: string;
  description: string;
  content: string; // Markdown content
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  category: string;
  tags: string[];
  status: 'draft' | 'pending' | 'approved' | 'rejected';
  created_at: string;
  updated_at: string;
}

// =============================================================================
// SAMPLE COMMUNITY PROJECTS (Demo Data)
// =============================================================================

const SAMPLE_COMMUNITY_PROJECTS: SharedProject[] = [
  {
    id: 'sample-1',
    user_id: 'alice-eth',
    title: 'ERC-20 Token Factory',
    description: 'A simple factory contract for deploying your own ERC-20 tokens with customizable name, symbol, and initial supply. Great for learning token standards!',
    files: [
      {
        name: 'TokenFactory.sol',
        content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract SimpleToken is ERC20 {
    constructor(string memory name, string memory symbol, uint256 initialSupply) ERC20(name, symbol) {
        _mint(msg.sender, initialSupply * 10**decimals());
    }
}

contract TokenFactory {
    event TokenCreated(address tokenAddress, string name, string symbol);
    
    function createToken(string memory name, string memory symbol, uint256 initialSupply) external returns (address) {
        SimpleToken token = new SimpleToken(name, symbol, initialSupply);
        emit TokenCreated(address(token), name, symbol);
        return address(token);
    }
}`,
        language: 'solidity'
      }
    ],
    template_id: null,
    category: 'template',
    tags: ['solidity', 'erc20', 'factory', 'tokens'],
    is_public: true,
    share_token: 'erc20-factory-demo',
    likes_count: 127,
    views_count: 1453,
    forks_count: 34,
    created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    author: {
      id: 'alice-eth',
      username: 'alice.eth',
      avatar_url: null
    }
  },
  {
    id: 'sample-2',
    user_id: 'web3-wizard',
    title: 'NFT Minting dApp',
    description: 'Complete NFT minting frontend with wallet connection, metadata upload to IPFS, and minting functionality. Built with React and ethers.js.',
    files: [
      {
        name: 'NFTMinter.tsx',
        content: `import { useState } from 'react';
import { ethers } from 'ethers';

const NFT_CONTRACT = '0x...'; // Your contract address

export default function NFTMinter() {
  const [minting, setMinting] = useState(false);
  const [tokenURI, setTokenURI] = useState('');

  async function mintNFT() {
    if (!window.ethereum) return alert('Please install MetaMask');
    
    setMinting(true);
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      
      const contract = new ethers.Contract(NFT_CONTRACT, ['function mint(string memory uri)'], signer);
      const tx = await contract.mint(tokenURI);
      await tx.wait();
      
      alert('NFT Minted Successfully!');
    } catch (error) {
      console.error(error);
    }
    setMinting(false);
  }

  return (
    <div className="p-6 max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-4">Mint Your NFT</h1>
      <input
        type="text"
        value={tokenURI}
        onChange={(e) => setTokenURI(e.target.value)}
        placeholder="Enter metadata URI..."
        className="w-full p-3 border rounded mb-4"
      />
      <button
        onClick={mintNFT}
        disabled={minting}
        className="w-full bg-purple-600 text-white p-3 rounded"
      >
        {minting ? 'Minting...' : 'Mint NFT'}
      </button>
    </div>
  );
}`,
        language: 'typescript'
      }
    ],
    template_id: null,
    category: 'example',
    tags: ['react', 'nft', 'ethers.js', 'ipfs', 'web3'],
    is_public: true,
    share_token: 'nft-minter-demo',
    likes_count: 89,
    views_count: 987,
    forks_count: 22,
    created_at: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    author: {
      id: 'web3-wizard',
      username: 'web3wizard',
      avatar_url: null
    }
  },
  {
    id: 'sample-3',
    user_id: 'defi-dev',
    title: 'Uniswap Price Oracle',
    description: 'A utility contract to fetch real-time token prices from Uniswap V3 pools. Includes TWAP calculation for manipulation-resistant pricing.',
    files: [
      {
        name: 'PriceOracle.sol',
        content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface IUniswapV3Pool {
    function observe(uint32[] calldata secondsAgos) 
        external view returns (int56[] memory tickCumulatives, uint160[] memory);
    function slot0() external view returns (uint160 sqrtPriceX96, int24 tick, uint16, uint16, uint16, uint8, bool);
}

contract PriceOracle {
    function getPrice(address pool) external view returns (uint256) {
        (uint160 sqrtPriceX96,,,,,,) = IUniswapV3Pool(pool).slot0();
        return uint256(sqrtPriceX96) * uint256(sqrtPriceX96) * 1e18 >> 192;
    }
    
    function getTWAP(address pool, uint32 period) external view returns (int24) {
        uint32[] memory secondsAgos = new uint32[](2);
        secondsAgos[0] = period;
        secondsAgos[1] = 0;
        
        (int56[] memory tickCumulatives,) = IUniswapV3Pool(pool).observe(secondsAgos);
        return int24((tickCumulatives[1] - tickCumulatives[0]) / int56(uint56(period)));
    }
}`,
        language: 'solidity'
      }
    ],
    template_id: null,
    category: 'sandbox',
    tags: ['defi', 'uniswap', 'oracle', 'twap', 'solidity'],
    is_public: true,
    share_token: 'uniswap-oracle-demo',
    likes_count: 156,
    views_count: 2134,
    forks_count: 45,
    created_at: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    author: {
      id: 'defi-dev',
      username: 'defi_developer',
      avatar_url: null
    }
  },
  {
    id: 'sample-4',
    user_id: 'crypto-sarah',
    title: 'Multi-Sig Wallet Tutorial',
    description: 'Step-by-step tutorial on building a multi-signature wallet from scratch. Covers proposal creation, voting, and execution with time-locks.',
    files: [
      {
        name: 'MultiSigWallet.sol',
        content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract MultiSigWallet {
    event Deposit(address indexed sender, uint amount);
    event Submit(uint indexed txId);
    event Approve(address indexed owner, uint indexed txId);
    event Execute(uint indexed txId);
    
    struct Transaction {
        address to;
        uint value;
        bytes data;
        bool executed;
        uint confirmations;
    }
    
    address[] public owners;
    mapping(address => bool) public isOwner;
    uint public required;
    Transaction[] public transactions;
    mapping(uint => mapping(address => bool)) public approved;
    
    modifier onlyOwner() {
        require(isOwner[msg.sender], "Not owner");
        _;
    }
    
    constructor(address[] memory _owners, uint _required) {
        require(_owners.length > 0, "Owners required");
        require(_required > 0 && _required <= _owners.length, "Invalid required");
        
        for (uint i; i < _owners.length; i++) {
            address owner = _owners[i];
            require(owner != address(0), "Invalid owner");
            require(!isOwner[owner], "Duplicate owner");
            isOwner[owner] = true;
            owners.push(owner);
        }
        required = _required;
    }
    
    receive() external payable {
        emit Deposit(msg.sender, msg.value);
    }
    
    function submit(address _to, uint _value, bytes calldata _data) external onlyOwner {
        transactions.push(Transaction({
            to: _to,
            value: _value,
            data: _data,
            executed: false,
            confirmations: 0
        }));
        emit Submit(transactions.length - 1);
    }
    
    function approve(uint _txId) external onlyOwner {
        require(!approved[_txId][msg.sender], "Already approved");
        approved[_txId][msg.sender] = true;
        transactions[_txId].confirmations++;
        emit Approve(msg.sender, _txId);
    }
    
    function execute(uint _txId) external onlyOwner {
        Transaction storage transaction = transactions[_txId];
        require(transaction.confirmations >= required, "Not enough confirmations");
        require(!transaction.executed, "Already executed");
        
        transaction.executed = true;
        (bool success,) = transaction.to.call{value: transaction.value}(transaction.data);
        require(success, "Tx failed");
        emit Execute(_txId);
    }
}`,
        language: 'solidity'
      }
    ],
    template_id: null,
    category: 'tutorial',
    tags: ['multisig', 'wallet', 'security', 'solidity', 'governance'],
    is_public: true,
    share_token: 'multisig-tutorial-demo',
    likes_count: 234,
    views_count: 3421,
    forks_count: 67,
    created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
    author: {
      id: 'crypto-sarah',
      username: 'cryptosara',
      avatar_url: null
    }
  },
  {
    id: 'sample-5',
    user_id: 'chain-master',
    title: 'DeFi Yield Aggregator',
    description: 'A yield aggregator contract that automatically moves funds between protocols to maximize APY. Includes strategies for Aave, Compound, and Yearn.',
    files: [
      {
        name: 'YieldAggregator.sol',
        content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

interface IStrategy {
    function deposit(uint256 amount) external;
    function withdraw(uint256 amount) external;
    function getAPY() external view returns (uint256);
    function balance() external view returns (uint256);
}

contract YieldAggregator is Ownable {
    IERC20 public token;
    IStrategy[] public strategies;
    uint256 public activeStrategy;
    
    event Deposit(address indexed user, uint256 amount);
    event Withdraw(address indexed user, uint256 amount);
    event StrategyChanged(uint256 indexed oldStrategy, uint256 indexed newStrategy);
    
    constructor(address _token) Ownable(msg.sender) {
        token = IERC20(_token);
    }
    
    function addStrategy(address strategy) external onlyOwner {
        strategies.push(IStrategy(strategy));
    }
    
    function deposit(uint256 amount) external {
        token.transferFrom(msg.sender, address(this), amount);
        token.approve(address(strategies[activeStrategy]), amount);
        strategies[activeStrategy].deposit(amount);
        emit Deposit(msg.sender, amount);
    }
    
    function rebalance() external {
        uint256 bestAPY = 0;
        uint256 bestStrategy = activeStrategy;
        
        for (uint i = 0; i < strategies.length; i++) {
            uint256 apy = strategies[i].getAPY();
            if (apy > bestAPY) {
                bestAPY = apy;
                bestStrategy = i;
            }
        }
        
        if (bestStrategy != activeStrategy) {
            uint256 balance = strategies[activeStrategy].balance();
            strategies[activeStrategy].withdraw(balance);
            token.approve(address(strategies[bestStrategy]), balance);
            strategies[bestStrategy].deposit(balance);
            
            emit StrategyChanged(activeStrategy, bestStrategy);
            activeStrategy = bestStrategy;
        }
    }
}`,
        language: 'solidity'
      }
    ],
    template_id: null,
    category: 'example',
    tags: ['defi', 'yield', 'aggregator', 'aave', 'compound'],
    is_public: true,
    share_token: 'yield-aggregator-demo',
    likes_count: 178,
    views_count: 2567,
    forks_count: 52,
    created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    author: {
      id: 'chain-master',
      username: 'chainmaster',
      avatar_url: null
    }
  }
];

// =============================================================================
// PROJECT SHARING
// =============================================================================

/**
 * Share a project publicly
 */
export async function shareProject(project: {
  title: string;
  description?: string;
  files: ProjectFile[];
  templateId?: string;
  category?: 'sandbox' | 'template' | 'tutorial' | 'example';
  tags?: string[];
  walletAddress?: string;
}): Promise<{ data: SharedProject | null; error: string | null; shareUrl: string | null }> {
  try {
    // Use wallet address or anonymous
    const userId = project.walletAddress || 'anonymous';

    // Generate unique share token
    const shareToken = generateShareToken();

    const { data, error } = await supabase
      .from('shared_projects')
      .insert({
        user_id: userId,
        title: project.title,
        description: project.description || null,
        files: project.files,
        template_id: project.templateId || null,
        category: project.category || 'sandbox',
        tags: project.tags || [],
        is_public: true,
        share_token: shareToken,
        likes_count: 0,
        views_count: 0,
        forks_count: 0
      })
      .select()
      .single();

    if (error) throw error;

    const shareUrl = `${window.location.origin}/shared/${shareToken}`;
    
    return { data, error: null, shareUrl };
  } catch (error: any) {
    console.error('Error sharing project:', error);
    return { data: null, error: error.message, shareUrl: null };
  }
}

/**
 * Get a shared project by token
 */
export async function getSharedProject(shareToken: string): Promise<{ data: SharedProject | null; error: string | null }> {
  // Check sample projects first
  const sampleProject = SAMPLE_COMMUNITY_PROJECTS.find(p => p.share_token === shareToken);
  if (sampleProject) {
    return { data: sampleProject, error: null };
  }

  // If Supabase isn't configured, return not found
  if (!isSupabaseConfigured) {
    return { data: null, error: 'Project not found' };
  }

  try {
    const { data, error } = await supabase
      .from('shared_projects')
      .select(`
        *,
        author:profiles!user_id (
          id,
          username,
          avatar_url
        )
      `)
      .eq('share_token', shareToken)
      .eq('is_public', true)
      .single();

    if (error) throw error;

    // Increment view count
    await supabase
      .from('shared_projects')
      .update({ views_count: (data.views_count || 0) + 1 })
      .eq('id', data.id);

    return { data, error: null };
  } catch (error: any) {
    console.error('Error fetching shared project:', error);
    return { data: null, error: error.message };
  }
}

/**
 * Get all public projects (explore page)
 */
export async function getPublicProjects(options?: {
  category?: string;
  tags?: string[];
  sortBy?: 'recent' | 'popular' | 'likes';
  limit?: number;
  offset?: number;
}): Promise<{ data: SharedProject[]; error: string | null; total: number }> {
  // If Supabase isn't configured, return sample projects
  if (!isSupabaseConfigured) {
    let projects = [...SAMPLE_COMMUNITY_PROJECTS];
    
    // Filter by category
    if (options?.category) {
      projects = projects.filter(p => p.category === options.category);
    }
    
    // Sort
    switch (options?.sortBy) {
      case 'popular':
        projects.sort((a, b) => b.views_count - a.views_count);
        break;
      case 'likes':
        projects.sort((a, b) => b.likes_count - a.likes_count);
        break;
      default:
        projects.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }
    
    // Pagination
    const offset = options?.offset || 0;
    const limit = options?.limit || 20;
    const paginatedProjects = projects.slice(offset, offset + limit);
    
    return { data: paginatedProjects, error: null, total: projects.length };
  }

  try {
    let query = supabase
      .from('shared_projects')
      .select(`
        *,
        author:profiles!user_id (
          id,
          username,
          avatar_url
        )
      `, { count: 'exact' })
      .eq('is_public', true);

    if (options?.category) {
      query = query.eq('category', options.category);
    }

    if (options?.tags && options.tags.length > 0) {
      query = query.contains('tags', options.tags);
    }

    // Sorting
    switch (options?.sortBy) {
      case 'popular':
        query = query.order('views_count', { ascending: false });
        break;
      case 'likes':
        query = query.order('likes_count', { ascending: false });
        break;
      default:
        query = query.order('created_at', { ascending: false });
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    if (options?.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 20) - 1);
    }

    const { data, error, count } = await query;

    if (error) throw error;

    // If database returns empty, show sample projects
    if (!data || data.length === 0) {
      let projects = [...SAMPLE_COMMUNITY_PROJECTS];
      if (options?.category) {
        projects = projects.filter(p => p.category === options.category);
      }
      return { data: projects, error: null, total: projects.length };
    }

    return { data: data || [], error: null, total: count || 0 };
  } catch (error: any) {
    console.error('Error fetching public projects:', error);
    // Fallback to sample data on error
    return { data: SAMPLE_COMMUNITY_PROJECTS, error: null, total: SAMPLE_COMMUNITY_PROJECTS.length };
  }
}

/**
 * Get user's own projects
 */
export async function getMyProjects(): Promise<{ data: SharedProject[]; error: string | null }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return { data: [], error: 'Not authenticated' };
    }

    const { data, error } = await supabase
      .from('shared_projects')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return { data: data || [], error: null };
  } catch (error: any) {
    console.error('Error fetching my projects:', error);
    return { data: [], error: error.message };
  }
}

/**
 * Delete a project
 */
export async function deleteProject(projectId: string): Promise<{ error: string | null }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return { error: 'Not authenticated' };
    }

    const { error } = await supabase
      .from('shared_projects')
      .delete()
      .eq('id', projectId)
      .eq('user_id', user.id);

    if (error) throw error;

    return { error: null };
  } catch (error: any) {
    return { error: error.message };
  }
}

/**
 * Fork a project (using wallet address)
 */
export async function forkProject(shareToken: string, walletAddress?: string): Promise<{ data: SharedProject | null; error: string | null }> {
  try {
    if (!walletAddress) {
      return { data: null, error: 'Please connect your wallet to fork projects' };
    }

    // Get original project
    const { data: original, error: fetchError } = await supabase
      .from('shared_projects')
      .select('*')
      .eq('share_token', shareToken)
      .single();

    if (fetchError || !original) {
      return { data: null, error: 'Project not found' };
    }

    // Create fork
    const newShareToken = generateShareToken();
    const { data: fork, error } = await supabase
      .from('shared_projects')
      .insert({
        user_id: walletAddress,
        title: `${original.title} (Fork)`,
        description: original.description,
        files: original.files,
        template_id: original.template_id,
        category: original.category,
        tags: original.tags,
        is_public: false, // Start as private
        share_token: newShareToken,
        likes_count: 0,
        views_count: 0,
        forks_count: 0
      })
      .select()
      .single();

    if (error) throw error;

    // Increment fork count on original
    await supabase
      .from('shared_projects')
      .update({ forks_count: (original.forks_count || 0) + 1 })
      .eq('id', original.id);

    return { data: fork, error: null };
  } catch (error: any) {
    return { data: null, error: error.message };
  }
}

// =============================================================================
// LIKES & COMMENTS
// =============================================================================

/**
 * Like a project (using wallet address)
 */
export async function likeProject(projectId: string, walletAddress?: string): Promise<{ liked: boolean; error: string | null }> {
  try {
    if (!walletAddress) {
      return { liked: false, error: 'Please connect your wallet to like projects' };
    }

    // Check if already liked
    const { data: existing } = await supabase
      .from('project_likes')
      .select('id')
      .eq('project_id', projectId)
      .eq('user_id', walletAddress)
      .single();

    if (existing) {
      // Unlike
      await supabase
        .from('project_likes')
        .delete()
        .eq('id', existing.id);

      // Decrement count
      await supabase.rpc('decrement_likes', { project_id: projectId });

      return { liked: false, error: null };
    } else {
      // Like
      await supabase
        .from('project_likes')
        .insert({ project_id: projectId, user_id: walletAddress });

      // Increment count
      await supabase.rpc('increment_likes', { project_id: projectId });

      return { liked: true, error: null };
    }
  } catch (error: any) {
    return { liked: false, error: error.message };
  }
}

/**
 * Check if wallet has liked a project
 */
export async function hasLikedProject(projectId: string, walletAddress?: string): Promise<boolean> {
  try {
    if (!walletAddress) return false;

    const { data } = await supabase
      .from('project_likes')
      .select('id')
      .eq('project_id', projectId)
      .eq('user_id', walletAddress)
      .single();

    return !!data;
  } catch {
    return false;
  }
}

/**
 * Add a comment to a project (using wallet address)
 */
export async function addComment(projectId: string, content: string, walletAddress?: string): Promise<{ data: ProjectComment | null; error: string | null }> {
  try {
    if (!walletAddress) {
      return { data: null, error: 'Please connect your wallet to comment' };
    }

    const { data, error } = await supabase
      .from('project_comments')
      .insert({
        project_id: projectId,
        user_id: walletAddress,
        content
      })
      .select(`
        *,
        author:profiles!user_id (
          username,
          avatar_url
        )
      `)
      .single();

    if (error) throw error;

    return { data, error: null };
  } catch (error: any) {
    return { data: null, error: error.message };
  }
}

/**
 * Get comments for a project
 */
export async function getComments(projectId: string): Promise<{ data: ProjectComment[]; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from('project_comments')
      .select(`
        *,
        author:profiles!user_id (
          username,
          avatar_url
        )
      `)
      .eq('project_id', projectId)
      .order('created_at', { ascending: true });

    if (error) throw error;

    return { data: data || [], error: null };
  } catch (error: any) {
    return { data: [], error: error.message };
  }
}

// =============================================================================
// COMMUNITY TEMPLATES
// =============================================================================

/**
 * Submit a template to the community
 */
export async function submitTemplate(template: {
  name: string;
  description: string;
  code: string;
  category: string;
  tags: string[];
}): Promise<{ data: CommunityTemplate | null; error: string | null }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return { data: null, error: 'You must be logged in to submit templates' };
    }

    const { data, error } = await supabase
      .from('community_templates')
      .insert({
        user_id: user.id,
        name: template.name,
        description: template.description,
        code: template.code,
        category: template.category,
        tags: template.tags,
        is_approved: false,
        downloads_count: 0
      })
      .select()
      .single();

    if (error) throw error;

    return { data, error: null };
  } catch (error: any) {
    return { data: null, error: error.message };
  }
}

/**
 * Get approved community templates
 */
export async function getCommunityTemplates(options?: {
  category?: string;
  search?: string;
  limit?: number;
}): Promise<{ data: CommunityTemplate[]; error: string | null }> {
  try {
    let query = supabase
      .from('community_templates')
      .select(`
        *,
        author:profiles!user_id (
          username,
          avatar_url
        )
      `)
      .eq('is_approved', true)
      .order('downloads_count', { ascending: false });

    if (options?.category) {
      query = query.eq('category', options.category);
    }

    if (options?.search) {
      query = query.or(`name.ilike.%${options.search}%,description.ilike.%${options.search}%`);
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;

    if (error) throw error;

    return { data: data || [], error: null };
  } catch (error: any) {
    return { data: [], error: error.message };
  }
}

// =============================================================================
// TUTORIAL SUBMISSIONS
// =============================================================================

/**
 * Submit a tutorial for review
 */
export async function submitTutorial(tutorial: {
  title: string;
  description: string;
  content: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  category: string;
  tags: string[];
}): Promise<{ data: TutorialSubmission | null; error: string | null }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return { data: null, error: 'You must be logged in to submit tutorials' };
    }

    const { data, error } = await supabase
      .from('tutorial_submissions')
      .insert({
        user_id: user.id,
        title: tutorial.title,
        description: tutorial.description,
        content: tutorial.content,
        difficulty: tutorial.difficulty,
        category: tutorial.category,
        tags: tutorial.tags,
        status: 'pending'
      })
      .select()
      .single();

    if (error) throw error;

    return { data, error: null };
  } catch (error: any) {
    return { data: null, error: error.message };
  }
}

// =============================================================================
// UTILITIES
// =============================================================================

function generateShareToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 12; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

/**
 * Generate embed code for a project
 */
export function generateEmbedCode(shareToken: string, options?: {
  width?: string;
  height?: string;
  theme?: 'light' | 'dark';
}): string {
  const width = options?.width || '100%';
  const height = options?.height || '500px';
  const theme = options?.theme || 'dark';
  
  return `<iframe 
  src="${window.location.origin}/embed/${shareToken}?theme=${theme}"
  width="${width}"
  height="${height}"
  style="border: 1px solid #374151; border-radius: 8px;"
  loading="lazy"
  allow="clipboard-write"
></iframe>`;
}
