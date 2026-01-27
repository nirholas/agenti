/**
 * ✨ built by nich
 * 🌐 GitHub: github.com/nirholas
 * 💫 Keep shining, keep coding 🌞
 */

export interface SandboxTemplate {
  id: string;
  name: string;
  description: string;
  category: 'defi' | 'nft' | 'dao' | 'token' | 'game' | 'basic';
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  files: {
    name: string;
    path: string;
    content: string;
    language: string;
  }[];
}

export const sandboxTemplates: SandboxTemplate[] = [
  {
    id: 'simple-storage',
    name: 'Simple Storage',
    description: 'Basic contract with state management',
    category: 'basic',
    difficulty: 'beginner',
    files: [
      {
        name: 'SimpleStorage.sol',
        path: 'SimpleStorage.sol',
        language: 'solidity',
        content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title SimpleStorage
 * @dev Store & retrieve value in a variable
 */
contract SimpleStorage {
    uint256 private storedData;
    address public owner;
    
    event DataStored(uint256 newValue, address indexed by);
    
    constructor() {
        owner = msg.sender;
    }
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this");
        _;
    }
    
    /**
     * @dev Store value
     * @param x value to store
     */
    function set(uint256 x) public {
        storedData = x;
        emit DataStored(x, msg.sender);
    }
    
    /**
     * @dev Return stored value
     */
    function get() public view returns (uint256) {
        return storedData;
    }
    
    /**
     * @dev Increment stored value by 1
     */
    function increment() public {
        storedData += 1;
        emit DataStored(storedData, msg.sender);
    }
    
    /**
     * @dev Reset to zero (only owner)
     */
    function reset() public onlyOwner {
        storedData = 0;
        emit DataStored(0, msg.sender);
    }
}`
      }
    ]
  },
  {
    id: 'erc20-token',
    name: 'ERC20 Token',
    description: 'Standard fungible token implementation',
    category: 'token',
    difficulty: 'intermediate',
    files: [
      {
        name: 'MyToken.sol',
        path: 'MyToken.sol',
        language: 'solidity',
        content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MyToken
 * @dev ERC20 Token with minting and burning capabilities
 */
contract MyToken is ERC20, Ownable {
    uint256 public constant MAX_SUPPLY = 1000000 * 10**18;
    
    constructor() ERC20("MyToken", "MTK") Ownable(msg.sender) {
        _mint(msg.sender, 100000 * 10**18); // Initial supply
    }
    
    /**
     * @dev Mint new tokens (only owner)
     */
    function mint(address to, uint256 amount) public onlyOwner {
        require(totalSupply() + amount <= MAX_SUPPLY, "Max supply exceeded");
        _mint(to, amount);
    }
    
    /**
     * @dev Burn tokens
     */
    function burn(uint256 amount) public {
        _burn(msg.sender, amount);
    }
}`
      }
    ]
  },
  {
    id: 'nft-collection',
    name: 'NFT Collection',
    description: 'ERC721 NFT with minting and metadata',
    category: 'nft',
    difficulty: 'intermediate',
    files: [
      {
        name: 'MyNFT.sol',
        path: 'MyNFT.sol',
        language: 'solidity',
        content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

/**
 * @title MyNFT
 * @dev ERC721 NFT Collection with URI storage
 */
contract MyNFT is ERC721, ERC721URIStorage, Ownable {
    using Counters for Counters.Counter;
    Counters.Counter private _tokenIds;
    
    uint256 public constant MAX_SUPPLY = 10000;
    uint256 public mintPrice = 0.01 ether;
    
    event NFTMinted(address indexed to, uint256 indexed tokenId, string uri);
    
    constructor() ERC721("MyNFT", "MNFT") Ownable(msg.sender) {}
    
    /**
     * @dev Mint new NFT
     */
    function mint(string memory uri) public payable returns (uint256) {
        require(_tokenIds.current() < MAX_SUPPLY, "Max supply reached");
        require(msg.value >= mintPrice, "Insufficient payment");
        
        _tokenIds.increment();
        uint256 newTokenId = _tokenIds.current();
        
        _safeMint(msg.sender, newTokenId);
        _setTokenURI(newTokenId, uri);
        
        emit NFTMinted(msg.sender, newTokenId, uri);
        return newTokenId;
    }
    
    /**
     * @dev Update mint price (only owner)
     */
    function setMintPrice(uint256 newPrice) public onlyOwner {
        mintPrice = newPrice;
    }
    
    /**
     * @dev Withdraw funds (only owner)
     */
    function withdraw() public onlyOwner {
        payable(owner()).transfer(address(this).balance);
    }
    
    // Required overrides
    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }
    
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}`
      }
    ]
  },
  {
    id: 'multisig-wallet',
    name: 'MultiSig Wallet',
    description: 'Multi-signature wallet for secure transactions',
    category: 'basic',
    difficulty: 'advanced',
    files: [
      {
        name: 'MultiSigWallet.sol',
        path: 'MultiSigWallet.sol',
        language: 'solidity',
        content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title MultiSigWallet
 * @dev Multi-signature wallet requiring multiple confirmations
 */
contract MultiSigWallet {
    event Deposit(address indexed sender, uint256 amount);
    event Submit(uint256 indexed txId);
    event Approve(address indexed owner, uint256 indexed txId);
    event Revoke(address indexed owner, uint256 indexed txId);
    event Execute(uint256 indexed txId);
    
    struct Transaction {
        address to;
        uint256 value;
        bytes data;
        bool executed;
    }
    
    address[] public owners;
    mapping(address => bool) public isOwner;
    uint256 public required;
    
    Transaction[] public transactions;
    mapping(uint256 => mapping(address => bool)) public approved;
    
    modifier onlyOwner() {
        require(isOwner[msg.sender], "Not owner");
        _;
    }
    
    modifier txExists(uint256 _txId) {
        require(_txId < transactions.length, "Transaction does not exist");
        _;
    }
    
    modifier notApproved(uint256 _txId) {
        require(!approved[_txId][msg.sender], "Transaction already approved");
        _;
    }
    
    modifier notExecuted(uint256 _txId) {
        require(!transactions[_txId].executed, "Transaction already executed");
        _;
    }
    
    constructor(address[] memory _owners, uint256 _required) {
        require(_owners.length > 0, "Owners required");
        require(_required > 0 && _required <= _owners.length, "Invalid required number");
        
        for (uint256 i = 0; i < _owners.length; i++) {
            address owner = _owners[i];
            require(owner != address(0), "Invalid owner");
            require(!isOwner[owner], "Owner is not unique");
            
            isOwner[owner] = true;
            owners.push(owner);
        }
        
        required = _required;
    }
    
    receive() external payable {
        emit Deposit(msg.sender, msg.value);
    }
    
    function submit(address _to, uint256 _value, bytes calldata _data) 
        external 
        onlyOwner 
        returns (uint256)
    {
        transactions.push(Transaction({
            to: _to,
            value: _value,
            data: _data,
            executed: false
        }));
        
        uint256 txId = transactions.length - 1;
        emit Submit(txId);
        return txId;
    }
    
    function approve(uint256 _txId)
        external
        onlyOwner
        txExists(_txId)
        notApproved(_txId)
        notExecuted(_txId)
    {
        approved[_txId][msg.sender] = true;
        emit Approve(msg.sender, _txId);
    }
    
    function execute(uint256 _txId)
        external
        onlyOwner
        txExists(_txId)
        notExecuted(_txId)
    {
        require(_getApprovalCount(_txId) >= required, "Not enough approvals");
        
        Transaction storage transaction = transactions[_txId];
        transaction.executed = true;
        
        (bool success, ) = transaction.to.call{value: transaction.value}(transaction.data);
        require(success, "Transaction failed");
        
        emit Execute(_txId);
    }
    
    function revoke(uint256 _txId)
        external
        onlyOwner
        txExists(_txId)
        notExecuted(_txId)
    {
        require(approved[_txId][msg.sender], "Transaction not approved");
        approved[_txId][msg.sender] = false;
        emit Revoke(msg.sender, _txId);
    }
    
    function _getApprovalCount(uint256 _txId) private view returns (uint256 count) {
        for (uint256 i = 0; i < owners.length; i++) {
            if (approved[_txId][owners[i]]) {
                count += 1;
            }
        }
    }
    
    function getApprovalCount(uint256 _txId) external view returns (uint256) {
        return _getApprovalCount(_txId);
    }
    
    function getTransactionCount() external view returns (uint256) {
        return transactions.length;
    }
    
    function getOwners() external view returns (address[] memory) {
        return owners;
    }
}`
      }
    ]
  },
  {
    id: 'staking-rewards',
    name: 'Staking Contract',
    description: 'Token staking with rewards distribution',
    category: 'defi',
    difficulty: 'advanced',
    files: [
      {
        name: 'StakingRewards.sol',
        path: 'StakingRewards.sol',
        language: 'solidity',
        content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title StakingRewards
 * @dev Stake tokens and earn rewards over time
 */
contract StakingRewards is ReentrancyGuard, Ownable {
    IERC20 public stakingToken;
    IERC20 public rewardsToken;
    
    uint256 public rewardRate = 100; // Rewards per second
    uint256 public lastUpdateTime;
    uint256 public rewardPerTokenStored;
    
    mapping(address => uint256) public userRewardPerTokenPaid;
    mapping(address => uint256) public rewards;
    mapping(address => uint256) public balances;
    
    uint256 private _totalSupply;
    
    event Staked(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event RewardPaid(address indexed user, uint256 reward);
    
    constructor(address _stakingToken, address _rewardsToken) Ownable(msg.sender) {
        stakingToken = IERC20(_stakingToken);
        rewardsToken = IERC20(_rewardsToken);
    }
    
    function rewardPerToken() public view returns (uint256) {
        if (_totalSupply == 0) {
            return rewardPerTokenStored;
        }
        return rewardPerTokenStored + 
            (((block.timestamp - lastUpdateTime) * rewardRate * 1e18) / _totalSupply);
    }
    
    function earned(address account) public view returns (uint256) {
        return ((balances[account] * 
            (rewardPerToken() - userRewardPerTokenPaid[account])) / 1e18) + 
            rewards[account];
    }
    
    modifier updateReward(address account) {
        rewardPerTokenStored = rewardPerToken();
        lastUpdateTime = block.timestamp;
        
        if (account != address(0)) {
            rewards[account] = earned(account);
            userRewardPerTokenPaid[account] = rewardPerTokenStored;
        }
        _;
    }
    
    function stake(uint256 amount) external nonReentrant updateReward(msg.sender) {
        require(amount > 0, "Cannot stake 0");
        _totalSupply += amount;
        balances[msg.sender] += amount;
        stakingToken.transferFrom(msg.sender, address(this), amount);
        emit Staked(msg.sender, amount);
    }
    
    function withdraw(uint256 amount) public nonReentrant updateReward(msg.sender) {
        require(amount > 0, "Cannot withdraw 0");
        require(balances[msg.sender] >= amount, "Insufficient balance");
        _totalSupply -= amount;
        balances[msg.sender] -= amount;
        stakingToken.transfer(msg.sender, amount);
        emit Withdrawn(msg.sender, amount);
    }
    
    function getReward() public nonReentrant updateReward(msg.sender) {
        uint256 reward = rewards[msg.sender];
        if (reward > 0) {
            rewards[msg.sender] = 0;
            rewardsToken.transfer(msg.sender, reward);
            emit RewardPaid(msg.sender, reward);
        }
    }
    
    function exit() external {
        withdraw(balances[msg.sender]);
        getReward();
    }
    
    function setRewardRate(uint256 _rewardRate) external onlyOwner updateReward(address(0)) {
        rewardRate = _rewardRate;
    }
    
    function totalSupply() external view returns (uint256) {
        return _totalSupply;
    }
    
    function balanceOf(address account) external view returns (uint256) {
        return balances[account];
    }
}`
      }
    ]
  }
];

export function getSandboxTemplate(id: string): SandboxTemplate | undefined {
  return sandboxTemplates.find(t => t.id === id);
}

export function searchSandboxTemplates(query: string): SandboxTemplate[] {
  const lowerQuery = query.toLowerCase();
  return sandboxTemplates.filter(template =>
    template.name.toLowerCase().includes(lowerQuery) ||
    template.description.toLowerCase().includes(lowerQuery) ||
    template.category.toLowerCase().includes(lowerQuery)
  );
}
