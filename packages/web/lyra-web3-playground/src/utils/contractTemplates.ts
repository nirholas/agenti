/**
 * ✨ built by nich
 * 🌐 GitHub: github.com/nirholas
 * 💫 You're doing incredible things 🎯
 */

/**
 * Smart Contract Templates
 * Extracted from all Web3 examples in the platform
 */

export interface ContractTemplate {
  id: string;
  name: string;
  description: string;
  category: 'token' | 'nft' | 'defi' | 'dao' | 'security' | 'bridge' | 'other';
  blockchain: 'ethereum' | 'solana' | 'multi';
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  code: string;
  examplePrompts: string[];
}

export const contractTemplates: ContractTemplate[] = [
  {
    id: 'erc20-basic',
    name: 'ERC-20 Token (Basic)',
    description: 'Standard fungible token with minting capability',
    category: 'token',
    blockchain: 'ethereum',
    difficulty: 'beginner',
    examplePrompts: [
      'Create an ERC20 token with minting functionality',
      'Build a basic fungible token',
      'Make a token with 1 million supply'
    ],
    code: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract MyToken is ERC20, Ownable {
    constructor(uint256 initialSupply) ERC20("MyToken", "MTK") {
        _mint(msg.sender, initialSupply * 10 ** decimals());
    }

    function mint(address to, uint256 amount) public onlyOwner {
        _mint(to, amount);
    }
}`
  },
  {
    id: 'erc20-advanced',
    name: 'ERC-20 Token (Advanced)',
    description: 'Token with burning, pausing, and snapshots',
    category: 'token',
    blockchain: 'ethereum',
    difficulty: 'intermediate',
    examplePrompts: [
      'Create an advanced ERC20 with burn and pause',
      'Build a token with snapshot functionality',
      'Make a token with all security features'
    ],
    code: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract AdvancedToken is ERC20, ERC20Burnable, Pausable, Ownable {
    constructor(uint256 initialSupply) ERC20("AdvancedToken", "AVTK") {
        _mint(msg.sender, initialSupply * 10 ** decimals());
    }

    function pause() public onlyOwner {
        _pause();
    }

    function unpause() public onlyOwner {
        _unpause();
    }

    function mint(address to, uint256 amount) public onlyOwner {
        _mint(to, amount);
    }

    function _beforeTokenTransfer(address from, address to, uint256 amount)
        internal
        whenNotPaused
        override
    {
        super._beforeTokenTransfer(from, to, amount);
    }
}`
  },
  {
    id: 'erc721-nft',
    name: 'ERC-721 NFT Collection',
    description: 'NFT collection with max supply and minting price',
    category: 'nft',
    blockchain: 'ethereum',
    difficulty: 'intermediate',
    examplePrompts: [
      'Build an NFT collection with max supply',
      'Create an NFT with minting price',
      'Make a limited edition NFT collection'
    ],
    code: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

contract MyNFT is ERC721, Ownable {
    using Counters for Counters.Counter;
    Counters.Counter private _tokenIds;
    
    uint256 public maxSupply = 10000;
    uint256 public mintPrice = 0.01 ether;
    string public baseTokenURI;

    constructor(string memory _baseTokenURI) ERC721("MyNFT", "MNFT") {
        baseTokenURI = _baseTokenURI;
    }

    function mint() public payable {
        require(_tokenIds.current() < maxSupply, "Max supply reached");
        require(msg.value >= mintPrice, "Insufficient payment");

        _tokenIds.increment();
        uint256 newItemId = _tokenIds.current();
        _safeMint(msg.sender, newItemId);
    }

    function _baseURI() internal view virtual override returns (string memory) {
        return baseTokenURI;
    }

    function setBaseURI(string memory _baseTokenURI) public onlyOwner {
        baseTokenURI = _baseTokenURI;
    }

    function withdraw() public onlyOwner {
        payable(owner()).transfer(address(this).balance);
    }
}`
  },
  {
    id: 'erc1155-multi-token',
    name: 'ERC-1155 Multi-Token',
    description: 'Multi-token standard for games and collectibles',
    category: 'nft',
    blockchain: 'ethereum',
    difficulty: 'advanced',
    examplePrompts: [
      'Create an ERC1155 multi-token',
      'Build a gaming token contract',
      'Make multiple NFT types in one contract'
    ],
    code: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract GameItems is ERC1155, Ownable {
    uint256 public constant SWORD = 0;
    uint256 public constant SHIELD = 1;
    uint256 public constant POTION = 2;

    constructor() ERC1155("https://game.example/api/item/{id}.json") {
        _mint(msg.sender, SWORD, 10**18, "");
        _mint(msg.sender, SHIELD, 10**27, "");
        _mint(msg.sender, POTION, 10**9, "");
    }

    function mint(address to, uint256 id, uint256 amount) public onlyOwner {
        _mint(to, id, amount, "");
    }

    function mintBatch(address to, uint256[] memory ids, uint256[] memory amounts) public onlyOwner {
        _mintBatch(to, ids, amounts, "");
    }
}`
  },
  {
    id: 'nft-marketplace',
    name: 'NFT Marketplace',
    description: 'Buy, sell, and auction NFTs',
    category: 'nft',
    blockchain: 'ethereum',
    difficulty: 'advanced',
    examplePrompts: [
      'Create an NFT marketplace',
      'Build a platform to trade NFTs',
      'Make an OpenSea-like contract'
    ],
    code: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract NFTMarketplace is ReentrancyGuard {
    struct Listing {
        address seller;
        uint256 price;
        bool active;
    }

    mapping(address => mapping(uint256 => Listing)) public listings;
    uint256 public marketplaceFee = 250; // 2.5%

    event Listed(address indexed nftContract, uint256 indexed tokenId, address seller, uint256 price);
    event Sold(address indexed nftContract, uint256 indexed tokenId, address buyer, uint256 price);
    event Delisted(address indexed nftContract, uint256 indexed tokenId);

    function listItem(address nftContract, uint256 tokenId, uint256 price) external {
        require(price > 0, "Price must be greater than 0");
        require(IERC721(nftContract).ownerOf(tokenId) == msg.sender, "Not the owner");
        require(IERC721(nftContract).isApprovedForAll(msg.sender, address(this)), "Not approved");

        listings[nftContract][tokenId] = Listing({
            seller: msg.sender,
            price: price,
            active: true
        });

        emit Listed(nftContract, tokenId, msg.sender, price);
    }

    function buyItem(address nftContract, uint256 tokenId) external payable nonReentrant {
        Listing memory listing = listings[nftContract][tokenId];
        require(listing.active, "Item not listed");
        require(msg.value >= listing.price, "Insufficient payment");

        listings[nftContract][tokenId].active = false;

        uint256 fee = (listing.price * marketplaceFee) / 10000;
        uint256 sellerProceeds = listing.price - fee;

        IERC721(nftContract).safeTransferFrom(listing.seller, msg.sender, tokenId);
        payable(listing.seller).transfer(sellerProceeds);

        if (msg.value > listing.price) {
            payable(msg.sender).transfer(msg.value - listing.price);
        }

        emit Sold(nftContract, tokenId, msg.sender, listing.price);
    }

    function delistItem(address nftContract, uint256 tokenId) external {
        require(listings[nftContract][tokenId].seller == msg.sender, "Not the seller");
        delete listings[nftContract][tokenId];
        emit Delisted(nftContract, tokenId);
    }
}`
  },
  {
    id: 'defi-lending',
    name: 'DeFi Lending Protocol',
    description: 'Lend and borrow assets like Aave or Compound',
    category: 'defi',
    blockchain: 'ethereum',
    difficulty: 'advanced',
    examplePrompts: [
      'Create a lending protocol',
      'Build an Aave-like contract',
      'Make a DeFi lending platform'
    ],
    code: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract SimpleLending is ReentrancyGuard {
    mapping(address => mapping(address => uint256)) public deposits;
    mapping(address => mapping(address => uint256)) public borrows;
    mapping(address => uint256) public interestRates; // per year in basis points
    
    uint256 public constant COLLATERAL_RATIO = 150; // 150%
    
    event Deposited(address indexed user, address indexed token, uint256 amount);
    event Withdrawn(address indexed user, address indexed token, uint256 amount);
    event Borrowed(address indexed user, address indexed token, uint256 amount);
    event Repaid(address indexed user, address indexed token, uint256 amount);

    function deposit(address token, uint256 amount) external nonReentrant {
        require(amount > 0, "Amount must be greater than 0");
        IERC20(token).transferFrom(msg.sender, address(this), amount);
        deposits[msg.sender][token] += amount;
        emit Deposited(msg.sender, token, amount);
    }

    function withdraw(address token, uint256 amount) external nonReentrant {
        require(deposits[msg.sender][token] >= amount, "Insufficient balance");
        deposits[msg.sender][token] -= amount;
        IERC20(token).transfer(msg.sender, amount);
        emit Withdrawn(msg.sender, token, amount);
    }

    function borrow(address token, uint256 amount) external nonReentrant {
        uint256 collateralValue = getCollateralValue(msg.sender);
        uint256 borrowValue = getBorrowValue(msg.sender) + amount;
        
        require(borrowValue * COLLATERAL_RATIO <= collateralValue * 100, "Insufficient collateral");
        
        borrows[msg.sender][token] += amount;
        IERC20(token).transfer(msg.sender, amount);
        emit Borrowed(msg.sender, token, amount);
    }

    function repay(address token, uint256 amount) external nonReentrant {
        require(borrows[msg.sender][token] >= amount, "Repay amount exceeds borrow");
        IERC20(token).transferFrom(msg.sender, address(this), amount);
        borrows[msg.sender][token] -= amount;
        emit Repaid(msg.sender, token, amount);
    }

    function getCollateralValue(address user) public view returns (uint256) {
        // Simplified - would need price oracles in production
        return deposits[user][address(0)];
    }

    function getBorrowValue(address user) public view returns (uint256) {
        return borrows[user][address(0)];
    }
}`
  },
  {
    id: 'yield-farming',
    name: 'Yield Farming',
    description: 'Stake LP tokens to earn rewards',
    category: 'defi',
    blockchain: 'ethereum',
    difficulty: 'intermediate',
    examplePrompts: [
      'Create a yield farming contract',
      'Build a staking rewards platform',
      'Make a liquidity mining contract'
    ],
    code: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract YieldFarm is ReentrancyGuard, Ownable {
    IERC20 public stakingToken;
    IERC20 public rewardToken;
    
    uint256 public rewardRate = 100; // tokens per second
    uint256 public lastUpdateTime;
    uint256 public rewardPerTokenStored;
    
    mapping(address => uint256) public userRewardPerTokenPaid;
    mapping(address => uint256) public rewards;
    mapping(address => uint256) public balances;
    
    uint256 private _totalSupply;

    event Staked(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event RewardPaid(address indexed user, uint256 reward);

    constructor(address _stakingToken, address _rewardToken) {
        stakingToken = IERC20(_stakingToken);
        rewardToken = IERC20(_rewardToken);
    }

    function rewardPerToken() public view returns (uint256) {
        if (_totalSupply == 0) {
            return rewardPerTokenStored;
        }
        return rewardPerTokenStored + (((block.timestamp - lastUpdateTime) * rewardRate * 1e18) / _totalSupply);
    }

    function earned(address account) public view returns (uint256) {
        return ((balances[account] * (rewardPerToken() - userRewardPerTokenPaid[account])) / 1e18) + rewards[account];
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
        _totalSupply -= amount;
        balances[msg.sender] -= amount;
        stakingToken.transfer(msg.sender, amount);
        emit Withdrawn(msg.sender, amount);
    }

    function getReward() public nonReentrant updateReward(msg.sender) {
        uint256 reward = rewards[msg.sender];
        if (reward > 0) {
            rewards[msg.sender] = 0;
            rewardToken.transfer(msg.sender, reward);
            emit RewardPaid(msg.sender, reward);
        }
    }

    function exit() external {
        withdraw(balances[msg.sender]);
        getReward();
    }
}`
  },
  {
    id: 'token-staking',
    name: 'Token Staking',
    description: 'Stake tokens with lock periods for rewards',
    category: 'defi',
    blockchain: 'ethereum',
    difficulty: 'intermediate',
    examplePrompts: [
      'Create a token staking contract',
      'Build a staking system with lock periods',
      'Make a staking rewards contract'
    ],
    code: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract TokenStaking is ReentrancyGuard {
    IERC20 public stakingToken;
    
    struct Stake {
        uint256 amount;
        uint256 timestamp;
        uint256 lockPeriod;
        uint256 apy;
    }
    
    mapping(address => Stake[]) public stakes;
    
    uint256 public constant FLEXIBLE_APY = 5;
    uint256 public constant MONTH_APY = 8;
    uint256 public constant QUARTER_APY = 12;
    uint256 public constant YEAR_APY = 20;

    event Staked(address indexed user, uint256 amount, uint256 lockPeriod, uint256 apy);
    event Unstaked(address indexed user, uint256 amount, uint256 reward);

    constructor(address _stakingToken) {
        stakingToken = IERC20(_stakingToken);
    }

    function stake(uint256 amount, uint256 lockPeriod) external nonReentrant {
        require(amount > 0, "Cannot stake 0");
        require(lockPeriod == 0 || lockPeriod == 30 || lockPeriod == 90 || lockPeriod == 365, "Invalid lock period");
        
        uint256 apy;
        if (lockPeriod == 0) apy = FLEXIBLE_APY;
        else if (lockPeriod == 30) apy = MONTH_APY;
        else if (lockPeriod == 90) apy = QUARTER_APY;
        else apy = YEAR_APY;
        
        stakingToken.transferFrom(msg.sender, address(this), amount);
        
        stakes[msg.sender].push(Stake({
            amount: amount,
            timestamp: block.timestamp,
            lockPeriod: lockPeriod * 1 days,
            apy: apy
        }));
        
        emit Staked(msg.sender, amount, lockPeriod, apy);
    }

    function unstake(uint256 stakeIndex) external nonReentrant {
        require(stakeIndex < stakes[msg.sender].length, "Invalid stake index");
        Stake memory userStake = stakes[msg.sender][stakeIndex];
        
        require(block.timestamp >= userStake.timestamp + userStake.lockPeriod, "Lock period not ended");
        
        uint256 stakeDuration = block.timestamp - userStake.timestamp;
        uint256 reward = (userStake.amount * userStake.apy * stakeDuration) / (365 days * 100);
        uint256 totalAmount = userStake.amount + reward;
        
        // Remove stake
        stakes[msg.sender][stakeIndex] = stakes[msg.sender][stakes[msg.sender].length - 1];
        stakes[msg.sender].pop();
        
        stakingToken.transfer(msg.sender, totalAmount);
        emit Unstaked(msg.sender, userStake.amount, reward);
    }

    function getStakes(address user) external view returns (Stake[] memory) {
        return stakes[user];
    }
}`
  },
  {
    id: 'dao-governance',
    name: 'DAO Governance',
    description: 'Create and vote on proposals with token-based voting',
    category: 'dao',
    blockchain: 'ethereum',
    difficulty: 'advanced',
    examplePrompts: [
      'Create a DAO governance contract',
      'Build a voting system for DAO',
      'Make a proposal-based governance'
    ],
    code: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract DAOGovernance {
    IERC20 public governanceToken;
    
    struct Proposal {
        string description;
        uint256 forVotes;
        uint256 againstVotes;
        uint256 deadline;
        bool executed;
        mapping(address => bool) hasVoted;
    }
    
    Proposal[] public proposals;
    uint256 public proposalCount;
    uint256 public constant VOTING_PERIOD = 3 days;
    uint256 public constant QUORUM = 1000000 * 10**18; // 1M tokens
    
    event ProposalCreated(uint256 indexed proposalId, string description);
    event Voted(uint256 indexed proposalId, address indexed voter, bool support, uint256 weight);
    event ProposalExecuted(uint256 indexed proposalId);

    constructor(address _governanceToken) {
        governanceToken = IERC20(_governanceToken);
    }

    function createProposal(string memory description) external returns (uint256) {
        uint256 proposalId = proposalCount++;
        proposals.push();
        Proposal storage newProposal = proposals[proposalId];
        newProposal.description = description;
        newProposal.deadline = block.timestamp + VOTING_PERIOD;
        
        emit ProposalCreated(proposalId, description);
        return proposalId;
    }

    function vote(uint256 proposalId, bool support) external {
        require(proposalId < proposalCount, "Invalid proposal");
        Proposal storage proposal = proposals[proposalId];
        require(block.timestamp < proposal.deadline, "Voting ended");
        require(!proposal.hasVoted[msg.sender], "Already voted");
        
        uint256 votingPower = governanceToken.balanceOf(msg.sender);
        require(votingPower > 0, "No voting power");
        
        proposal.hasVoted[msg.sender] = true;
        
        if (support) {
            proposal.forVotes += votingPower;
        } else {
            proposal.againstVotes += votingPower;
        }
        
        emit Voted(proposalId, msg.sender, support, votingPower);
    }

    function executeProposal(uint256 proposalId) external {
        require(proposalId < proposalCount, "Invalid proposal");
        Proposal storage proposal = proposals[proposalId];
        require(block.timestamp >= proposal.deadline, "Voting not ended");
        require(!proposal.executed, "Already executed");
        require(proposal.forVotes + proposal.againstVotes >= QUORUM, "Quorum not reached");
        require(proposal.forVotes > proposal.againstVotes, "Proposal rejected");
        
        proposal.executed = true;
        emit ProposalExecuted(proposalId);
    }
}`
  },
  {
    id: 'multisig-wallet',
    name: 'Multi-Signature Wallet',
    description: 'Secure wallet requiring multiple approvals',
    category: 'security',
    blockchain: 'ethereum',
    difficulty: 'advanced',
    examplePrompts: [
      'Create a multi-sig wallet',
      'Build a Gnosis Safe-like contract',
      'Make a wallet with multiple owners'
    ],
    code: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract MultiSigWallet {
    event Deposit(address indexed sender, uint256 amount);
    event SubmitTransaction(address indexed owner, uint256 indexed txIndex);
    event ConfirmTransaction(address indexed owner, uint256 indexed txIndex);
    event RevokeConfirmation(address indexed owner, uint256 indexed txIndex);
    event ExecuteTransaction(address indexed owner, uint256 indexed txIndex);

    address[] public owners;
    mapping(address => bool) public isOwner;
    uint256 public numConfirmationsRequired;

    struct Transaction {
        address to;
        uint256 value;
        bytes data;
        bool executed;
        uint256 numConfirmations;
    }

    mapping(uint256 => mapping(address => bool)) public isConfirmed;
    Transaction[] public transactions;

    modifier onlyOwner() {
        require(isOwner[msg.sender], "not owner");
        _;
    }

    modifier txExists(uint256 _txIndex) {
        require(_txIndex < transactions.length, "tx does not exist");
        _;
    }

    modifier notExecuted(uint256 _txIndex) {
        require(!transactions[_txIndex].executed, "tx already executed");
        _;
    }

    modifier notConfirmed(uint256 _txIndex) {
        require(!isConfirmed[_txIndex][msg.sender], "tx already confirmed");
        _;
    }

    constructor(address[] memory _owners, uint256 _numConfirmationsRequired) {
        require(_owners.length > 0, "owners required");
        require(
            _numConfirmationsRequired > 0 &&
                _numConfirmationsRequired <= _owners.length,
            "invalid number of required confirmations"
        );

        for (uint256 i = 0; i < _owners.length; i++) {
            address owner = _owners[i];
            require(owner != address(0), "invalid owner");
            require(!isOwner[owner], "owner not unique");

            isOwner[owner] = true;
            owners.push(owner);
        }

        numConfirmationsRequired = _numConfirmationsRequired;
    }

    receive() external payable {
        emit Deposit(msg.sender, msg.value);
    }

    function submitTransaction(address _to, uint256 _value, bytes memory _data) public onlyOwner {
        uint256 txIndex = transactions.length;

        transactions.push(
            Transaction({
                to: _to,
                value: _value,
                data: _data,
                executed: false,
                numConfirmations: 0
            })
        );

        emit SubmitTransaction(msg.sender, txIndex);
    }

    function confirmTransaction(uint256 _txIndex)
        public
        onlyOwner
        txExists(_txIndex)
        notExecuted(_txIndex)
        notConfirmed(_txIndex)
    {
        Transaction storage transaction = transactions[_txIndex];
        transaction.numConfirmations += 1;
        isConfirmed[_txIndex][msg.sender] = true;

        emit ConfirmTransaction(msg.sender, _txIndex);
    }

    function executeTransaction(uint256 _txIndex)
        public
        onlyOwner
        txExists(_txIndex)
        notExecuted(_txIndex)
    {
        Transaction storage transaction = transactions[_txIndex];

        require(
            transaction.numConfirmations >= numConfirmationsRequired,
            "cannot execute tx"
        );

        transaction.executed = true;

        (bool success, ) = transaction.to.call{value: transaction.value}(
            transaction.data
        );
        require(success, "tx failed");

        emit ExecuteTransaction(msg.sender, _txIndex);
    }
}`
  },
  {
    id: 'token-vesting',
    name: 'Token Vesting',
    description: 'Time-locked token distribution for teams and investors',
    category: 'token',
    blockchain: 'ethereum',
    difficulty: 'intermediate',
    examplePrompts: [
      'Create a token vesting contract',
      'Build a time-locked distribution system',
      'Make a vesting schedule for team tokens'
    ],
    code: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract TokenVesting is Ownable {
    IERC20 public token;
    
    struct VestingSchedule {
        uint256 totalAmount;
        uint256 amountClaimed;
        uint256 startTime;
        uint256 cliffDuration;
        uint256 duration;
    }
    
    mapping(address => VestingSchedule) public vestingSchedules;
    
    event VestingScheduleCreated(address indexed beneficiary, uint256 amount);
    event TokensClaimed(address indexed beneficiary, uint256 amount);

    constructor(address _token) {
        token = IERC20(_token);
    }

    function createVestingSchedule(
        address beneficiary,
        uint256 amount,
        uint256 cliffDuration,
        uint256 duration
    ) external onlyOwner {
        require(beneficiary != address(0), "Invalid beneficiary");
        require(amount > 0, "Amount must be greater than 0");
        require(vestingSchedules[beneficiary].totalAmount == 0, "Schedule already exists");
        
        token.transferFrom(msg.sender, address(this), amount);
        
        vestingSchedules[beneficiary] = VestingSchedule({
            totalAmount: amount,
            amountClaimed: 0,
            startTime: block.timestamp,
            cliffDuration: cliffDuration,
            duration: duration
        });
        
        emit VestingScheduleCreated(beneficiary, amount);
    }

    function claimVestedTokens() external {
        VestingSchedule storage schedule = vestingSchedules[msg.sender];
        require(schedule.totalAmount > 0, "No vesting schedule");
        
        uint256 vestedAmount = calculateVestedAmount(msg.sender);
        uint256 claimableAmount = vestedAmount - schedule.amountClaimed;
        require(claimableAmount > 0, "No tokens to claim");
        
        schedule.amountClaimed += claimableAmount;
        token.transfer(msg.sender, claimableAmount);
        
        emit TokensClaimed(msg.sender, claimableAmount);
    }

    function calculateVestedAmount(address beneficiary) public view returns (uint256) {
        VestingSchedule memory schedule = vestingSchedules[beneficiary];
        
        if (block.timestamp < schedule.startTime + schedule.cliffDuration) {
            return 0;
        }
        
        if (block.timestamp >= schedule.startTime + schedule.duration) {
            return schedule.totalAmount;
        }
        
        uint256 timeVested = block.timestamp - schedule.startTime;
        return (schedule.totalAmount * timeVested) / schedule.duration;
    }
}`
  },
  {
    id: 'escrow',
    name: 'Simple Escrow',
    description: 'Escrow contract for secure payments between parties',
    category: 'security',
    blockchain: 'ethereum',
    difficulty: 'beginner',
    examplePrompts: [
      'Create an escrow contract',
      'Build a payment escrow system',
      'Make a contract for secure transactions'
    ],
    code: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract SimpleEscrow {
    address public buyer;
    address public seller;
    address public arbiter;
    uint256 public amount;
    bool public isReleased;
    bool public isRefunded;

    event FundsDeposited(address indexed buyer, uint256 amount);
    event FundsReleased(address indexed seller, uint256 amount);
    event FundsRefunded(address indexed buyer, uint256 amount);

    constructor(address _seller, address _arbiter) payable {
        require(_seller != address(0), "Invalid seller");
        require(_arbiter != address(0), "Invalid arbiter");
        require(msg.value > 0, "Must deposit funds");
        
        buyer = msg.sender;
        seller = _seller;
        arbiter = _arbiter;
        amount = msg.value;
        
        emit FundsDeposited(buyer, amount);
    }

    function releaseFunds() public {
        require(msg.sender == buyer || msg.sender == arbiter, "Unauthorized");
        require(!isReleased && !isRefunded, "Already processed");
        
        isReleased = true;
        payable(seller).transfer(amount);
        
        emit FundsReleased(seller, amount);
    }

    function refund() public {
        require(msg.sender == seller || msg.sender == arbiter, "Unauthorized");
        require(!isReleased && !isRefunded, "Already processed");
        
        isRefunded = true;
        payable(buyer).transfer(amount);
        
        emit FundsRefunded(buyer, amount);
    }

    function getStatus() public view returns (string memory) {
        if (isReleased) return "Released";
        if (isRefunded) return "Refunded";
        return "Pending";
    }
}`
  },
  {
    id: 'token-swap-dex',
    name: 'Token Swap (DEX)',
    description: 'Simple decentralized exchange for token swapping',
    category: 'defi',
    blockchain: 'ethereum',
    difficulty: 'advanced',
    examplePrompts: [
      'Create a DEX for token swaps',
      'Build a Uniswap-like contract',
      'Make an automated market maker'
    ],
    code: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract SimpleDEX is ReentrancyGuard {
    IERC20 public tokenA;
    IERC20 public tokenB;
    
    uint256 public reserveA;
    uint256 public reserveB;
    
    event Swap(address indexed user, address indexed tokenIn, uint256 amountIn, uint256 amountOut);
    event LiquidityAdded(address indexed provider, uint256 amountA, uint256 amountB);

    constructor(address _tokenA, address _tokenB) {
        tokenA = IERC20(_tokenA);
        tokenB = IERC20(_tokenB);
    }

    function addLiquidity(uint256 amountA, uint256 amountB) external nonReentrant {
        require(amountA > 0 && amountB > 0, "Invalid amounts");
        
        tokenA.transferFrom(msg.sender, address(this), amountA);
        tokenB.transferFrom(msg.sender, address(this), amountB);
        
        reserveA += amountA;
        reserveB += amountB;
        
        emit LiquidityAdded(msg.sender, amountA, amountB);
    }

    function swap(address tokenIn, uint256 amountIn) external nonReentrant returns (uint256 amountOut) {
        require(tokenIn == address(tokenA) || tokenIn == address(tokenB), "Invalid token");
        require(amountIn > 0, "Amount must be greater than 0");
        
        bool isTokenA = tokenIn == address(tokenA);
        (IERC20 inputToken, IERC20 outputToken, uint256 inputReserve, uint256 outputReserve) = 
            isTokenA ? (tokenA, tokenB, reserveA, reserveB) : (tokenB, tokenA, reserveB, reserveA);
        
        inputToken.transferFrom(msg.sender, address(this), amountIn);
        
        // Constant product formula: x * y = k
        // Amount out = (amountIn * outputReserve) / (inputReserve + amountIn)
        amountOut = (amountIn * outputReserve) / (inputReserve + amountIn);
        require(amountOut > 0, "Insufficient output amount");
        
        outputToken.transfer(msg.sender, amountOut);
        
        if (isTokenA) {
            reserveA += amountIn;
            reserveB -= amountOut;
        } else {
            reserveB += amountIn;
            reserveA -= amountOut;
        }
        
        emit Swap(msg.sender, tokenIn, amountIn, amountOut);
    }

    function getAmountOut(uint256 amountIn, uint256 reserveIn, uint256 reserveOut) 
        public 
        pure 
        returns (uint256) 
    {
        require(amountIn > 0, "Invalid amount");
        require(reserveIn > 0 && reserveOut > 0, "Invalid reserves");
        return (amountIn * reserveOut) / (reserveIn + amountIn);
    }
}`
  },

  // ===== BASIC CONTRACTS =====
  {
    id: 'simple-storage',
    name: 'Simple Storage',
    description: 'Basic storage contract for learning Solidity fundamentals',
    category: 'other',
    blockchain: 'ethereum',
    difficulty: 'beginner',
    examplePrompts: [
      'Create a simple storage contract',
      'Build a basic value storage',
      'Make a contract that stores a number'
    ],
    code: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract SimpleStorage {
    uint256 private storedValue;
    
    event ValueChanged(uint256 indexed oldValue, uint256 indexed newValue);
    
    function set(uint256 _value) public {
        uint256 oldValue = storedValue;
        storedValue = _value;
        emit ValueChanged(oldValue, _value);
    }
    
    function get() public view returns (uint256) {
        return storedValue;
    }
}`
  },
  {
    id: 'counter',
    name: 'Counter Contract',
    description: 'Simple counter with increment/decrement functionality',
    category: 'other',
    blockchain: 'ethereum',
    difficulty: 'beginner',
    examplePrompts: [
      'Create a counter contract',
      'Build a simple incrementing contract',
      'Make a contract that counts'
    ],
    code: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract Counter {
    uint256 private count;
    
    event CountChanged(uint256 indexed newCount, bool indexed increased);
    
    function increment() public {
        count += 1;
        emit CountChanged(count, true);
    }
    
    function decrement() public {
        require(count > 0, "Counter: cannot decrement below zero");
        count -= 1;
        emit CountChanged(count, false);
    }
    
    function getCount() public view returns (uint256) {
        return count;
    }
    
    function reset() public {
        count = 0;
        emit CountChanged(0, false);
    }
}`
  },
  {
    id: 'hello-world',
    name: 'Hello World',
    description: 'Classic Hello World contract with customizable message',
    category: 'other',
    blockchain: 'ethereum',
    difficulty: 'beginner',
    examplePrompts: [
      'Create a hello world contract',
      'Build a greeting contract',
      'Make a message storage contract'
    ],
    code: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract HelloWorld {
    string private message;
    address public owner;
    
    event MessageChanged(string newMessage);
    
    constructor() {
        message = "Hello, World!";
        owner = msg.sender;
    }
    
    function getMessage() public view returns (string memory) {
        return message;
    }
    
    function setMessage(string memory _newMessage) public {
        message = _newMessage;
        emit MessageChanged(_newMessage);
    }
    
    function greet(string memory _name) public pure returns (string memory) {
        return string(abi.encodePacked("Hello, ", _name, "!"));
    }
}`
  },

  // ===== SECURITY CONTRACTS =====
  {
    id: 'ownable-contract',
    name: 'Ownable Pattern',
    description: 'Ownership pattern for access control',
    category: 'security',
    blockchain: 'ethereum',
    difficulty: 'beginner',
    examplePrompts: [
      'Create an ownable contract',
      'Build a contract with ownership',
      'Make a contract with admin control'
    ],
    code: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract Ownable {
    address private _owner;
    
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    
    constructor() {
        _owner = msg.sender;
        emit OwnershipTransferred(address(0), msg.sender);
    }
    
    modifier onlyOwner() {
        require(owner() == msg.sender, "Ownable: caller is not the owner");
        _;
    }
    
    function owner() public view returns (address) {
        return _owner;
    }
    
    function renounceOwnership() public onlyOwner {
        emit OwnershipTransferred(_owner, address(0));
        _owner = address(0);
    }
    
    function transferOwnership(address newOwner) public onlyOwner {
        require(newOwner != address(0), "Ownable: new owner is the zero address");
        emit OwnershipTransferred(_owner, newOwner);
        _owner = newOwner;
    }
}`
  },
  {
    id: 'pausable-contract',
    name: 'Pausable Pattern',
    description: 'Emergency pause functionality for contracts',
    category: 'security',
    blockchain: 'ethereum',
    difficulty: 'intermediate',
    examplePrompts: [
      'Create a pausable contract',
      'Build a contract with emergency stop',
      'Make a contract that can be paused'
    ],
    code: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract Pausable {
    bool private _paused;
    address public owner;
    
    event Paused(address account);
    event Unpaused(address account);
    
    constructor() {
        owner = msg.sender;
        _paused = false;
    }
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }
    
    modifier whenNotPaused() {
        require(!paused(), "Pausable: paused");
        _;
    }
    
    modifier whenPaused() {
        require(paused(), "Pausable: not paused");
        _;
    }
    
    function paused() public view returns (bool) {
        return _paused;
    }
    
    function pause() public onlyOwner whenNotPaused {
        _paused = true;
        emit Paused(msg.sender);
    }
    
    function unpause() public onlyOwner whenPaused {
        _paused = false;
        emit Unpaused(msg.sender);
    }
    
    // Example protected function
    function protectedAction() public whenNotPaused {
        // Action only works when not paused
    }
}`
  },
  {
    id: 'access-control',
    name: 'Role-Based Access Control',
    description: 'Multi-role access control system',
    category: 'security',
    blockchain: 'ethereum',
    difficulty: 'intermediate',
    examplePrompts: [
      'Create a role-based access control contract',
      'Build a contract with multiple admin roles',
      'Make a permissions system'
    ],
    code: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract AccessControl {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    
    mapping(bytes32 => mapping(address => bool)) private _roles;
    
    event RoleGranted(bytes32 indexed role, address indexed account, address indexed sender);
    event RoleRevoked(bytes32 indexed role, address indexed account, address indexed sender);
    
    constructor() {
        _grantRole(ADMIN_ROLE, msg.sender);
    }
    
    modifier onlyRole(bytes32 role) {
        require(hasRole(role, msg.sender), "AccessControl: unauthorized");
        _;
    }
    
    function hasRole(bytes32 role, address account) public view returns (bool) {
        return _roles[role][account];
    }
    
    function grantRole(bytes32 role, address account) public onlyRole(ADMIN_ROLE) {
        _grantRole(role, account);
    }
    
    function revokeRole(bytes32 role, address account) public onlyRole(ADMIN_ROLE) {
        _revokeRole(role, account);
    }
    
    function renounceRole(bytes32 role) public {
        _revokeRole(role, msg.sender);
    }
    
    function _grantRole(bytes32 role, address account) internal {
        if (!hasRole(role, account)) {
            _roles[role][account] = true;
            emit RoleGranted(role, account, msg.sender);
        }
    }
    
    function _revokeRole(bytes32 role, address account) internal {
        if (hasRole(role, account)) {
            _roles[role][account] = false;
            emit RoleRevoked(role, account, msg.sender);
        }
    }
}`
  },
  {
    id: 'reentrancy-guard',
    name: 'Reentrancy Guard',
    description: 'Protection against reentrancy attacks',
    category: 'security',
    blockchain: 'ethereum',
    difficulty: 'intermediate',
    examplePrompts: [
      'Create a reentrancy guard',
      'Build a secure withdrawal contract',
      'Make a contract protected from reentrancy'
    ],
    code: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract ReentrancyGuard {
    uint256 private constant _NOT_ENTERED = 1;
    uint256 private constant _ENTERED = 2;
    uint256 private _status;
    
    mapping(address => uint256) public balances;
    
    event Deposit(address indexed user, uint256 amount);
    event Withdrawal(address indexed user, uint256 amount);
    
    constructor() {
        _status = _NOT_ENTERED;
    }
    
    modifier nonReentrant() {
        require(_status != _ENTERED, "ReentrancyGuard: reentrant call");
        _status = _ENTERED;
        _;
        _status = _NOT_ENTERED;
    }
    
    function deposit() public payable {
        balances[msg.sender] += msg.value;
        emit Deposit(msg.sender, msg.value);
    }
    
    function withdraw(uint256 amount) public nonReentrant {
        require(balances[msg.sender] >= amount, "Insufficient balance");
        
        // Update state before external call (checks-effects-interactions pattern)
        balances[msg.sender] -= amount;
        
        // External call
        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "Transfer failed");
        
        emit Withdrawal(msg.sender, amount);
    }
    
    function getBalance() public view returns (uint256) {
        return balances[msg.sender];
    }
}`
  },

  // ===== ADDITIONAL TOKEN CONTRACTS =====
  {
    id: 'erc20-permit',
    name: 'ERC-20 with Permit',
    description: 'Gas-efficient approvals with EIP-2612 permit',
    category: 'token',
    blockchain: 'ethereum',
    difficulty: 'advanced',
    examplePrompts: [
      'Create a token with gasless approvals',
      'Build an ERC20 with permit functionality',
      'Make a token with signature-based approvals'
    ],
    code: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/draft-ERC20Permit.sol";

contract ERC20WithPermit is ERC20, ERC20Permit {
    constructor(uint256 initialSupply) 
        ERC20("PermitToken", "PRMT") 
        ERC20Permit("PermitToken") 
    {
        _mint(msg.sender, initialSupply * 10 ** decimals());
    }
    
    // Users can approve with signature instead of transaction
    // Frontend calls: permit(owner, spender, value, deadline, v, r, s)
    // Then: transferFrom(owner, spender, amount)
}`
  },
  {
    id: 'erc20-capped',
    name: 'ERC-20 Capped Supply',
    description: 'Token with maximum supply cap',
    category: 'token',
    blockchain: 'ethereum',
    difficulty: 'beginner',
    examplePrompts: [
      'Create a token with max supply',
      'Build a capped token like Bitcoin',
      'Make a token with limited supply'
    ],
    code: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Capped.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract CappedToken is ERC20, ERC20Capped, Ownable {
    constructor(uint256 cap, uint256 initialMint) 
        ERC20("CappedToken", "CPTK") 
        ERC20Capped(cap * 10 ** 18) 
    {
        require(initialMint <= cap, "Initial mint exceeds cap");
        _mint(msg.sender, initialMint * 10 ** 18);
    }
    
    function mint(address to, uint256 amount) public onlyOwner {
        _mint(to, amount);
    }
    
    function _mint(address account, uint256 amount) internal override(ERC20, ERC20Capped) {
        super._mint(account, amount);
    }
}`
  },
  {
    id: 'wrapped-token',
    name: 'Wrapped Token',
    description: 'Wrap native tokens (like WETH)',
    category: 'token',
    blockchain: 'ethereum',
    difficulty: 'intermediate',
    examplePrompts: [
      'Create a wrapped ETH token',
      'Build a token wrapper',
      'Make WETH-like contract'
    ],
    code: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract WrappedToken {
    string public name = "Wrapped Ether";
    string public symbol = "WETH";
    uint8 public decimals = 18;
    
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    
    event Deposit(address indexed dst, uint256 wad);
    event Withdrawal(address indexed src, uint256 wad);
    event Transfer(address indexed src, address indexed dst, uint256 wad);
    event Approval(address indexed src, address indexed guy, uint256 wad);
    
    receive() external payable {
        deposit();
    }
    
    function deposit() public payable {
        balanceOf[msg.sender] += msg.value;
        emit Deposit(msg.sender, msg.value);
    }
    
    function withdraw(uint256 wad) public {
        require(balanceOf[msg.sender] >= wad, "Insufficient balance");
        balanceOf[msg.sender] -= wad;
        payable(msg.sender).transfer(wad);
        emit Withdrawal(msg.sender, wad);
    }
    
    function totalSupply() public view returns (uint256) {
        return address(this).balance;
    }
    
    function approve(address guy, uint256 wad) public returns (bool) {
        allowance[msg.sender][guy] = wad;
        emit Approval(msg.sender, guy, wad);
        return true;
    }
    
    function transfer(address dst, uint256 wad) public returns (bool) {
        return transferFrom(msg.sender, dst, wad);
    }
    
    function transferFrom(address src, address dst, uint256 wad) public returns (bool) {
        require(balanceOf[src] >= wad, "Insufficient balance");
        
        if (src != msg.sender && allowance[src][msg.sender] != type(uint256).max) {
            require(allowance[src][msg.sender] >= wad, "Insufficient allowance");
            allowance[src][msg.sender] -= wad;
        }
        
        balanceOf[src] -= wad;
        balanceOf[dst] += wad;
        emit Transfer(src, dst, wad);
        return true;
    }
}`
  },
  {
    id: 'reflection-token',
    name: 'Reflection Token',
    description: 'Token with automatic redistribution to holders',
    category: 'token',
    blockchain: 'ethereum',
    difficulty: 'advanced',
    examplePrompts: [
      'Create a reflection token',
      'Build a token with automatic rewards',
      'Make a token that redistributes to holders'
    ],
    code: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract ReflectionToken {
    string public name = "ReflectionToken";
    string public symbol = "RFT";
    uint8 public decimals = 18;
    uint256 public totalSupply;
    
    uint256 private constant MAX = type(uint256).max;
    uint256 private _rTotal;
    uint256 private _tFeeTotal;
    
    uint256 public taxFee = 5; // 5% reflection fee
    
    mapping(address => uint256) private _rOwned;
    mapping(address => uint256) private _tOwned;
    mapping(address => mapping(address => uint256)) private _allowances;
    mapping(address => bool) private _isExcluded;
    address[] private _excluded;
    
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    
    constructor(uint256 _totalSupply) {
        totalSupply = _totalSupply * 10 ** decimals;
        _rTotal = (MAX - (MAX % totalSupply));
        _rOwned[msg.sender] = _rTotal;
        emit Transfer(address(0), msg.sender, totalSupply);
    }
    
    function balanceOf(address account) public view returns (uint256) {
        if (_isExcluded[account]) return _tOwned[account];
        return tokenFromReflection(_rOwned[account]);
    }
    
    function tokenFromReflection(uint256 rAmount) public view returns (uint256) {
        require(rAmount <= _rTotal, "Amount exceeds total reflections");
        uint256 currentRate = _getRate();
        return rAmount / currentRate;
    }
    
    function _getRate() private view returns (uint256) {
        return _rTotal / totalSupply;
    }
    
    function transfer(address recipient, uint256 amount) public returns (bool) {
        _transfer(msg.sender, recipient, amount);
        return true;
    }
    
    function _transfer(address sender, address recipient, uint256 tAmount) private {
        uint256 currentRate = _getRate();
        uint256 tFee = (tAmount * taxFee) / 100;
        uint256 tTransferAmount = tAmount - tFee;
        uint256 rAmount = tAmount * currentRate;
        uint256 rFee = tFee * currentRate;
        uint256 rTransferAmount = rAmount - rFee;
        
        _rOwned[sender] -= rAmount;
        _rOwned[recipient] += rTransferAmount;
        _rTotal -= rFee;
        _tFeeTotal += tFee;
        
        emit Transfer(sender, recipient, tTransferAmount);
    }
    
    function totalFees() public view returns (uint256) {
        return _tFeeTotal;
    }
}`
  },

  // ===== ADDITIONAL NFT CONTRACTS =====
  {
    id: 'erc721-enumerable',
    name: 'ERC-721 Enumerable',
    description: 'NFT with on-chain enumeration of tokens',
    category: 'nft',
    blockchain: 'ethereum',
    difficulty: 'intermediate',
    examplePrompts: [
      'Create an enumerable NFT collection',
      'Build an NFT with on-chain tracking',
      'Make an NFT that lists all tokens'
    ],
    code: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract EnumerableNFT is ERC721Enumerable, Ownable {
    uint256 public maxSupply = 10000;
    uint256 public mintPrice = 0.05 ether;
    string private _baseTokenURI;
    
    constructor(string memory baseURI) ERC721("EnumerableNFT", "ENFT") {
        _baseTokenURI = baseURI;
    }
    
    function mint(uint256 quantity) public payable {
        require(totalSupply() + quantity <= maxSupply, "Exceeds max supply");
        require(msg.value >= mintPrice * quantity, "Insufficient payment");
        
        for (uint256 i = 0; i < quantity; i++) {
            _safeMint(msg.sender, totalSupply());
        }
    }
    
    function tokensOfOwner(address owner) public view returns (uint256[] memory) {
        uint256 tokenCount = balanceOf(owner);
        uint256[] memory tokens = new uint256[](tokenCount);
        
        for (uint256 i = 0; i < tokenCount; i++) {
            tokens[i] = tokenOfOwnerByIndex(owner, i);
        }
        return tokens;
    }
    
    function _baseURI() internal view override returns (string memory) {
        return _baseTokenURI;
    }
    
    function setBaseURI(string memory baseURI) public onlyOwner {
        _baseTokenURI = baseURI;
    }
    
    function withdraw() public onlyOwner {
        payable(owner()).transfer(address(this).balance);
    }
}`
  },
  {
    id: 'erc721-royalty',
    name: 'ERC-721 with Royalties',
    description: 'NFT with EIP-2981 royalty standard',
    category: 'nft',
    blockchain: 'ethereum',
    difficulty: 'intermediate',
    examplePrompts: [
      'Create an NFT with royalties',
      'Build an NFT with creator fees',
      'Make an NFT with secondary sale royalties'
    ],
    code: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/common/ERC2981.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

contract RoyaltyNFT is ERC721, ERC2981, Ownable {
    using Counters for Counters.Counter;
    Counters.Counter private _tokenIds;
    
    uint96 public defaultRoyaltyBps = 500; // 5% royalty
    string private _baseTokenURI;
    
    constructor(string memory baseURI) ERC721("RoyaltyNFT", "RNFT") {
        _baseTokenURI = baseURI;
        _setDefaultRoyalty(msg.sender, defaultRoyaltyBps);
    }
    
    function mint(address to) public onlyOwner returns (uint256) {
        _tokenIds.increment();
        uint256 tokenId = _tokenIds.current();
        _safeMint(to, tokenId);
        return tokenId;
    }
    
    function mintWithRoyalty(address to, address royaltyReceiver, uint96 royaltyBps) 
        public 
        onlyOwner 
        returns (uint256) 
    {
        _tokenIds.increment();
        uint256 tokenId = _tokenIds.current();
        _safeMint(to, tokenId);
        _setTokenRoyalty(tokenId, royaltyReceiver, royaltyBps);
        return tokenId;
    }
    
    function setDefaultRoyalty(address receiver, uint96 feeNumerator) public onlyOwner {
        _setDefaultRoyalty(receiver, feeNumerator);
    }
    
    function _baseURI() internal view override returns (string memory) {
        return _baseTokenURI;
    }
    
    function supportsInterface(bytes4 interfaceId) 
        public 
        view 
        override(ERC721, ERC2981) 
        returns (bool) 
    {
        return super.supportsInterface(interfaceId);
    }
}`
  },
  {
    id: 'soulbound-token',
    name: 'Soulbound Token (SBT)',
    description: 'Non-transferable token for identity/credentials',
    category: 'nft',
    blockchain: 'ethereum',
    difficulty: 'intermediate',
    examplePrompts: [
      'Create a soulbound token',
      'Build a non-transferable NFT',
      'Make an identity credential token'
    ],
    code: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

contract SoulboundToken is ERC721, Ownable {
    using Counters for Counters.Counter;
    Counters.Counter private _tokenIds;
    
    mapping(uint256 => string) private _tokenMetadata;
    
    event SoulboundMinted(address indexed to, uint256 indexed tokenId, string metadata);
    event SoulboundRevoked(address indexed from, uint256 indexed tokenId);
    
    constructor() ERC721("SoulboundToken", "SBT") {}
    
    // Override transfer functions to make tokens non-transferable
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId,
        uint256 batchSize
    ) internal virtual override {
        require(
            from == address(0) || to == address(0),
            "Soulbound: Token is non-transferable"
        );
        super._beforeTokenTransfer(from, to, tokenId, batchSize);
    }
    
    function mint(address to, string memory metadata) public onlyOwner returns (uint256) {
        _tokenIds.increment();
        uint256 tokenId = _tokenIds.current();
        _safeMint(to, tokenId);
        _tokenMetadata[tokenId] = metadata;
        emit SoulboundMinted(to, tokenId, metadata);
        return tokenId;
    }
    
    function revoke(uint256 tokenId) public onlyOwner {
        address owner = ownerOf(tokenId);
        _burn(tokenId);
        emit SoulboundRevoked(owner, tokenId);
    }
    
    function getMetadata(uint256 tokenId) public view returns (string memory) {
        require(_exists(tokenId), "Token does not exist");
        return _tokenMetadata[tokenId];
    }
    
    function approve(address, uint256) public virtual override {
        revert("Soulbound: Approval not allowed");
    }
    
    function setApprovalForAll(address, bool) public virtual override {
        revert("Soulbound: Approval not allowed");
    }
}`
  },
  {
    id: 'erc721-lazy-mint',
    name: 'ERC-721 Lazy Minting',
    description: 'NFT with signature-based lazy minting',
    category: 'nft',
    blockchain: 'ethereum',
    difficulty: 'advanced',
    examplePrompts: [
      'Create a lazy mint NFT',
      'Build an NFT with gasless minting',
      'Make an NFT with signature verification'
    ],
    code: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/draft-EIP712.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract LazyMintNFT is ERC721, EIP712, Ownable {
    using ECDSA for bytes32;
    
    bytes32 private constant MINT_TYPEHASH = 
        keccak256("MintVoucher(uint256 tokenId,uint256 price,string uri)");
    
    mapping(uint256 => string) private _tokenURIs;
    mapping(uint256 => bool) private _minted;
    
    event LazyMint(address indexed buyer, uint256 indexed tokenId, uint256 price);
    
    constructor() 
        ERC721("LazyMintNFT", "LNFT") 
        EIP712("LazyMintNFT", "1") 
    {}
    
    struct MintVoucher {
        uint256 tokenId;
        uint256 price;
        string uri;
        bytes signature;
    }
    
    function redeem(MintVoucher calldata voucher) public payable {
        require(!_minted[voucher.tokenId], "Already minted");
        require(msg.value >= voucher.price, "Insufficient payment");
        
        bytes32 digest = _hashTypedDataV4(
            keccak256(abi.encode(
                MINT_TYPEHASH,
                voucher.tokenId,
                voucher.price,
                keccak256(bytes(voucher.uri))
            ))
        );
        
        address signer = digest.recover(voucher.signature);
        require(signer == owner(), "Invalid signature");
        
        _minted[voucher.tokenId] = true;
        _safeMint(msg.sender, voucher.tokenId);
        _tokenURIs[voucher.tokenId] = voucher.uri;
        
        emit LazyMint(msg.sender, voucher.tokenId, voucher.price);
    }
    
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(_exists(tokenId), "Token does not exist");
        return _tokenURIs[tokenId];
    }
    
    function withdraw() public onlyOwner {
        payable(owner()).transfer(address(this).balance);
    }
}`
  },

  // ===== ADDITIONAL DEFI CONTRACTS =====
  {
    id: 'erc4626-vault',
    name: 'ERC-4626 Tokenized Vault',
    description: 'Standard vault for yield strategies',
    category: 'defi',
    blockchain: 'ethereum',
    difficulty: 'advanced',
    examplePrompts: [
      'Create a tokenized vault',
      'Build an ERC4626 vault',
      'Make a yield vault contract'
    ],
    code: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract TokenizedVault is ERC4626, Ownable {
    uint256 public performanceFee = 1000; // 10% in basis points
    uint256 public constant FEE_DENOMINATOR = 10000;
    
    event FeesCollected(uint256 amount);
    
    constructor(IERC20 asset_) 
        ERC4626(asset_) 
        ERC20("Vault Shares", "vSHARES") 
    {}
    
    function totalAssets() public view override returns (uint256) {
        // In production, include yield from strategies
        return IERC20(asset()).balanceOf(address(this));
    }
    
    function _deposit(
        address caller,
        address receiver,
        uint256 assets,
        uint256 shares
    ) internal override {
        super._deposit(caller, receiver, assets, shares);
    }
    
    function _withdraw(
        address caller,
        address receiver,
        address owner,
        uint256 assets,
        uint256 shares
    ) internal override {
        uint256 fee = (assets * performanceFee) / FEE_DENOMINATOR;
        uint256 assetsAfterFee = assets - fee;
        
        super._withdraw(caller, receiver, owner, assetsAfterFee, shares);
        
        if (fee > 0) {
            IERC20(asset()).transfer(owner(), fee);
            emit FeesCollected(fee);
        }
    }
    
    function setPerformanceFee(uint256 newFee) public onlyOwner {
        require(newFee <= 2000, "Fee too high"); // Max 20%
        performanceFee = newFee;
    }
}`
  },
  {
    id: 'flash-loan',
    name: 'Flash Loan Provider',
    description: 'Provide flash loans with fees',
    category: 'defi',
    blockchain: 'ethereum',
    difficulty: 'advanced',
    examplePrompts: [
      'Create a flash loan contract',
      'Build a flash loan provider',
      'Make a contract for flash loans'
    ],
    code: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

interface IFlashBorrower {
    function onFlashLoan(
        address initiator,
        address token,
        uint256 amount,
        uint256 fee,
        bytes calldata data
    ) external returns (bytes32);
}

contract FlashLoanProvider is ReentrancyGuard {
    bytes32 public constant CALLBACK_SUCCESS = keccak256("FlashBorrower.onFlashLoan");
    
    uint256 public flashLoanFee = 9; // 0.09% in basis points
    uint256 public constant FEE_DENOMINATOR = 10000;
    
    mapping(address => uint256) public liquidity;
    
    event FlashLoan(
        address indexed borrower,
        address indexed token,
        uint256 amount,
        uint256 fee
    );
    event LiquidityAdded(address indexed provider, address indexed token, uint256 amount);
    
    function deposit(address token, uint256 amount) external {
        IERC20(token).transferFrom(msg.sender, address(this), amount);
        liquidity[token] += amount;
        emit LiquidityAdded(msg.sender, token, amount);
    }
    
    function flashLoan(
        address receiver,
        address token,
        uint256 amount,
        bytes calldata data
    ) external nonReentrant {
        require(amount <= liquidity[token], "Insufficient liquidity");
        
        uint256 fee = (amount * flashLoanFee) / FEE_DENOMINATOR;
        uint256 balanceBefore = IERC20(token).balanceOf(address(this));
        
        IERC20(token).transfer(receiver, amount);
        
        bytes32 result = IFlashBorrower(receiver).onFlashLoan(
            msg.sender,
            token,
            amount,
            fee,
            data
        );
        require(result == CALLBACK_SUCCESS, "Invalid callback return");
        
        uint256 balanceAfter = IERC20(token).balanceOf(address(this));
        require(balanceAfter >= balanceBefore + fee, "Flash loan not repaid");
        
        liquidity[token] += fee;
        emit FlashLoan(receiver, token, amount, fee);
    }
    
    function maxFlashLoan(address token) external view returns (uint256) {
        return liquidity[token];
    }
}`
  },
  {
    id: 'liquidity-pool',
    name: 'Simple Liquidity Pool',
    description: 'Basic AMM liquidity pool',
    category: 'defi',
    blockchain: 'ethereum',
    difficulty: 'advanced',
    examplePrompts: [
      'Create a liquidity pool',
      'Build an AMM pool',
      'Make a Uniswap-like pool'
    ],
    code: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract LiquidityPool is ERC20, ReentrancyGuard {
    IERC20 public immutable token0;
    IERC20 public immutable token1;
    
    uint256 public reserve0;
    uint256 public reserve1;
    
    uint256 public constant MINIMUM_LIQUIDITY = 1000;
    uint256 public constant FEE_NUMERATOR = 997; // 0.3% fee
    
    event Mint(address indexed sender, uint256 amount0, uint256 amount1);
    event Burn(address indexed sender, uint256 amount0, uint256 amount1);
    event Swap(address indexed sender, uint256 amountIn, uint256 amountOut);
    
    constructor(address _token0, address _token1) ERC20("LP Token", "LP") {
        token0 = IERC20(_token0);
        token1 = IERC20(_token1);
    }
    
    function addLiquidity(uint256 amount0, uint256 amount1) 
        external 
        nonReentrant 
        returns (uint256 liquidity) 
    {
        token0.transferFrom(msg.sender, address(this), amount0);
        token1.transferFrom(msg.sender, address(this), amount1);
        
        uint256 totalSupply_ = totalSupply();
        
        if (totalSupply_ == 0) {
            liquidity = sqrt(amount0 * amount1) - MINIMUM_LIQUIDITY;
            _mint(address(1), MINIMUM_LIQUIDITY); // Lock minimum liquidity
        } else {
            liquidity = min(
                (amount0 * totalSupply_) / reserve0,
                (amount1 * totalSupply_) / reserve1
            );
        }
        
        require(liquidity > 0, "Insufficient liquidity minted");
        _mint(msg.sender, liquidity);
        
        reserve0 += amount0;
        reserve1 += amount1;
        
        emit Mint(msg.sender, amount0, amount1);
    }
    
    function swap(uint256 amountIn, bool zeroForOne) 
        external 
        nonReentrant 
        returns (uint256 amountOut) 
    {
        require(amountIn > 0, "Invalid amount");
        
        (IERC20 tokenIn, IERC20 tokenOut, uint256 resIn, uint256 resOut) = zeroForOne
            ? (token0, token1, reserve0, reserve1)
            : (token1, token0, reserve1, reserve0);
        
        tokenIn.transferFrom(msg.sender, address(this), amountIn);
        
        uint256 amountInWithFee = amountIn * FEE_NUMERATOR;
        amountOut = (amountInWithFee * resOut) / (resIn * 1000 + amountInWithFee);
        
        tokenOut.transfer(msg.sender, amountOut);
        
        if (zeroForOne) {
            reserve0 += amountIn;
            reserve1 -= amountOut;
        } else {
            reserve1 += amountIn;
            reserve0 -= amountOut;
        }
        
        emit Swap(msg.sender, amountIn, amountOut);
    }
    
    function sqrt(uint256 y) internal pure returns (uint256 z) {
        if (y > 3) {
            z = y;
            uint256 x = y / 2 + 1;
            while (x < z) {
                z = x;
                x = (y / x + x) / 2;
            }
        } else if (y != 0) {
            z = 1;
        }
    }
    
    function min(uint256 a, uint256 b) internal pure returns (uint256) {
        return a < b ? a : b;
    }
}`
  },
  {
    id: 'price-oracle',
    name: 'Price Oracle',
    description: 'On-chain price feed oracle',
    category: 'defi',
    blockchain: 'ethereum',
    difficulty: 'intermediate',
    examplePrompts: [
      'Create a price oracle',
      'Build a price feed contract',
      'Make an oracle for token prices'
    ],
    code: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";

contract PriceOracle is Ownable {
    struct PriceData {
        uint256 price;
        uint256 timestamp;
        uint8 decimals;
    }
    
    mapping(address => PriceData) public prices;
    mapping(address => bool) public authorizedUpdaters;
    
    uint256 public constant STALE_PRICE_THRESHOLD = 1 hours;
    
    event PriceUpdated(address indexed token, uint256 price, uint256 timestamp);
    event UpdaterAuthorized(address indexed updater, bool authorized);
    
    modifier onlyAuthorized() {
        require(authorizedUpdaters[msg.sender] || msg.sender == owner(), "Not authorized");
        _;
    }
    
    constructor() {
        authorizedUpdaters[msg.sender] = true;
    }
    
    function setUpdater(address updater, bool authorized) external onlyOwner {
        authorizedUpdaters[updater] = authorized;
        emit UpdaterAuthorized(updater, authorized);
    }
    
    function updatePrice(address token, uint256 price, uint8 decimals) 
        external 
        onlyAuthorized 
    {
        prices[token] = PriceData({
            price: price,
            timestamp: block.timestamp,
            decimals: decimals
        });
        emit PriceUpdated(token, price, block.timestamp);
    }
    
    function updatePrices(
        address[] calldata tokens, 
        uint256[] calldata newPrices,
        uint8[] calldata decimals
    ) external onlyAuthorized {
        require(
            tokens.length == newPrices.length && tokens.length == decimals.length,
            "Length mismatch"
        );
        
        for (uint256 i = 0; i < tokens.length; i++) {
            prices[tokens[i]] = PriceData({
                price: newPrices[i],
                timestamp: block.timestamp,
                decimals: decimals[i]
            });
            emit PriceUpdated(tokens[i], newPrices[i], block.timestamp);
        }
    }
    
    function getPrice(address token) external view returns (uint256 price, uint256 timestamp) {
        PriceData memory data = prices[token];
        require(data.timestamp > 0, "Price not available");
        require(
            block.timestamp - data.timestamp <= STALE_PRICE_THRESHOLD,
            "Price is stale"
        );
        return (data.price, data.timestamp);
    }
    
    function getLatestPrice(address token) external view returns (uint256) {
        return prices[token].price;
    }
}`
  },

  // ===== DAO & GOVERNANCE CONTRACTS =====
  {
    id: 'timelock-controller',
    name: 'Timelock Controller',
    description: 'Time-delayed execution for governance',
    category: 'dao',
    blockchain: 'ethereum',
    difficulty: 'advanced',
    examplePrompts: [
      'Create a timelock contract',
      'Build a delayed execution system',
      'Make a governance timelock'
    ],
    code: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract TimelockController {
    uint256 public constant MINIMUM_DELAY = 1 days;
    uint256 public constant MAXIMUM_DELAY = 30 days;
    uint256 public delay;
    
    mapping(bytes32 => bool) public queuedTransactions;
    
    address public admin;
    address public pendingAdmin;
    
    event NewDelay(uint256 indexed newDelay);
    event QueueTransaction(bytes32 indexed txHash, address target, uint256 value, bytes data, uint256 eta);
    event ExecuteTransaction(bytes32 indexed txHash, address target, uint256 value, bytes data, uint256 eta);
    event CancelTransaction(bytes32 indexed txHash);
    
    constructor(uint256 _delay) {
        require(_delay >= MINIMUM_DELAY && _delay <= MAXIMUM_DELAY, "Invalid delay");
        admin = msg.sender;
        delay = _delay;
    }
    
    modifier onlyAdmin() {
        require(msg.sender == admin, "Not admin");
        _;
    }
    
    function setDelay(uint256 _delay) external onlyAdmin {
        require(_delay >= MINIMUM_DELAY && _delay <= MAXIMUM_DELAY, "Invalid delay");
        delay = _delay;
        emit NewDelay(_delay);
    }
    
    function queueTransaction(
        address target,
        uint256 value,
        bytes calldata data,
        uint256 eta
    ) external onlyAdmin returns (bytes32) {
        require(eta >= block.timestamp + delay, "ETA too soon");
        
        bytes32 txHash = keccak256(abi.encode(target, value, data, eta));
        queuedTransactions[txHash] = true;
        
        emit QueueTransaction(txHash, target, value, data, eta);
        return txHash;
    }
    
    function executeTransaction(
        address target,
        uint256 value,
        bytes calldata data,
        uint256 eta
    ) external payable onlyAdmin returns (bytes memory) {
        bytes32 txHash = keccak256(abi.encode(target, value, data, eta));
        
        require(queuedTransactions[txHash], "Transaction not queued");
        require(block.timestamp >= eta, "Too early");
        require(block.timestamp <= eta + 14 days, "Transaction stale");
        
        queuedTransactions[txHash] = false;
        
        (bool success, bytes memory returnData) = target.call{value: value}(data);
        require(success, "Transaction reverted");
        
        emit ExecuteTransaction(txHash, target, value, data, eta);
        return returnData;
    }
    
    function cancelTransaction(
        address target,
        uint256 value,
        bytes calldata data,
        uint256 eta
    ) external onlyAdmin {
        bytes32 txHash = keccak256(abi.encode(target, value, data, eta));
        queuedTransactions[txHash] = false;
        emit CancelTransaction(txHash);
    }
}`
  },

  // ===== UTILITY CONTRACTS =====
  {
    id: 'airdrop',
    name: 'Token Airdrop',
    description: 'Batch token distribution with merkle proof',
    category: 'other',
    blockchain: 'ethereum',
    difficulty: 'intermediate',
    examplePrompts: [
      'Create an airdrop contract',
      'Build a token distribution system',
      'Make a merkle airdrop'
    ],
    code: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract MerkleAirdrop is Ownable {
    IERC20 public immutable token;
    bytes32 public merkleRoot;
    
    mapping(address => bool) public hasClaimed;
    
    event Claimed(address indexed account, uint256 amount);
    event MerkleRootUpdated(bytes32 newRoot);
    
    constructor(address _token, bytes32 _merkleRoot) {
        token = IERC20(_token);
        merkleRoot = _merkleRoot;
    }
    
    function claim(uint256 amount, bytes32[] calldata merkleProof) external {
        require(!hasClaimed[msg.sender], "Already claimed");
        
        bytes32 leaf = keccak256(abi.encodePacked(msg.sender, amount));
        require(MerkleProof.verify(merkleProof, merkleRoot, leaf), "Invalid proof");
        
        hasClaimed[msg.sender] = true;
        token.transfer(msg.sender, amount);
        
        emit Claimed(msg.sender, amount);
    }
    
    function setMerkleRoot(bytes32 _merkleRoot) external onlyOwner {
        merkleRoot = _merkleRoot;
        emit MerkleRootUpdated(_merkleRoot);
    }
    
    function withdrawRemaining() external onlyOwner {
        uint256 balance = token.balanceOf(address(this));
        token.transfer(owner(), balance);
    }
    
    function verifyProof(
        address account,
        uint256 amount,
        bytes32[] calldata merkleProof
    ) external view returns (bool) {
        bytes32 leaf = keccak256(abi.encodePacked(account, amount));
        return MerkleProof.verify(merkleProof, merkleRoot, leaf);
    }
}`
  },
  {
    id: 'lottery',
    name: 'Simple Lottery',
    description: 'On-chain lottery with random winner selection',
    category: 'other',
    blockchain: 'ethereum',
    difficulty: 'intermediate',
    examplePrompts: [
      'Create a lottery contract',
      'Build a raffle system',
      'Make an on-chain lottery'
    ],
    code: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract Lottery {
    address public owner;
    address[] public players;
    uint256 public ticketPrice;
    uint256 public roundNumber;
    
    mapping(uint256 => address) public winners;
    
    event TicketPurchased(address indexed player, uint256 round);
    event WinnerSelected(address indexed winner, uint256 prize, uint256 round);
    
    constructor(uint256 _ticketPrice) {
        owner = msg.sender;
        ticketPrice = _ticketPrice;
        roundNumber = 1;
    }
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }
    
    function buyTicket() external payable {
        require(msg.value >= ticketPrice, "Insufficient payment");
        players.push(msg.sender);
        emit TicketPurchased(msg.sender, roundNumber);
    }
    
    function buyTickets(uint256 count) external payable {
        require(msg.value >= ticketPrice * count, "Insufficient payment");
        for (uint256 i = 0; i < count; i++) {
            players.push(msg.sender);
        }
        emit TicketPurchased(msg.sender, roundNumber);
    }
    
    function pickWinner() external onlyOwner {
        require(players.length > 0, "No players");
        
        // NOTE: This is NOT secure randomness - use Chainlink VRF in production
        uint256 randomIndex = uint256(
            keccak256(abi.encodePacked(block.timestamp, block.prevrandao, players.length))
        ) % players.length;
        
        address winner = players[randomIndex];
        uint256 prize = address(this).balance;
        
        winners[roundNumber] = winner;
        
        // Reset for next round
        delete players;
        roundNumber++;
        
        // Transfer prize
        payable(winner).transfer(prize);
        
        emit WinnerSelected(winner, prize, roundNumber - 1);
    }
    
    function getPlayers() external view returns (address[] memory) {
        return players;
    }
    
    function getPlayerCount() external view returns (uint256) {
        return players.length;
    }
    
    function getPrizePool() external view returns (uint256) {
        return address(this).balance;
    }
}`
  },
  {
    id: 'game-items',
    name: 'Game Items (ERC-1155)',
    description: 'Multi-token game items with metadata',
    category: 'nft',
    blockchain: 'ethereum',
    difficulty: 'intermediate',
    examplePrompts: [
      'Create game item NFTs',
      'Build an ERC1155 game contract',
      'Make in-game items'
    ],
    code: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract GameItems is ERC1155, Ownable {
    // Item types
    uint256 public constant GOLD = 0;
    uint256 public constant SWORD = 1;
    uint256 public constant SHIELD = 2;
    uint256 public constant POTION = 3;
    uint256 public constant LEGENDARY_SWORD = 4;
    
    mapping(uint256 => uint256) public itemPrices;
    mapping(uint256 => uint256) public maxSupply;
    mapping(uint256 => uint256) public currentSupply;
    mapping(uint256 => string) public itemNames;
    
    event ItemPurchased(address indexed buyer, uint256 indexed itemId, uint256 amount);
    event ItemCrafted(address indexed crafter, uint256 indexed itemId);
    
    constructor() ERC1155("https://game.example/api/item/{id}.json") {
        // Set up initial items
        itemNames[GOLD] = "Gold";
        itemNames[SWORD] = "Iron Sword";
        itemNames[SHIELD] = "Iron Shield";
        itemNames[POTION] = "Health Potion";
        itemNames[LEGENDARY_SWORD] = "Legendary Sword";
        
        // Set prices (in wei)
        itemPrices[SWORD] = 0.01 ether;
        itemPrices[SHIELD] = 0.01 ether;
        itemPrices[POTION] = 0.001 ether;
        
        // Set max supply (0 = unlimited)
        maxSupply[LEGENDARY_SWORD] = 100;
        
        // Mint initial gold to owner
        _mint(msg.sender, GOLD, 1000000, "");
    }
    
    function buyItem(uint256 id, uint256 amount) external payable {
        require(itemPrices[id] > 0, "Item not for sale");
        require(msg.value >= itemPrices[id] * amount, "Insufficient payment");
        
        if (maxSupply[id] > 0) {
            require(currentSupply[id] + amount <= maxSupply[id], "Exceeds max supply");
        }
        
        currentSupply[id] += amount;
        _mint(msg.sender, id, amount, "");
        emit ItemPurchased(msg.sender, id, amount);
    }
    
    function craftLegendarySword() external {
        // Requires 3 swords and 1000 gold
        require(balanceOf(msg.sender, SWORD) >= 3, "Need 3 swords");
        require(balanceOf(msg.sender, GOLD) >= 1000, "Need 1000 gold");
        require(currentSupply[LEGENDARY_SWORD] < maxSupply[LEGENDARY_SWORD], "Max supply reached");
        
        _burn(msg.sender, SWORD, 3);
        _burn(msg.sender, GOLD, 1000);
        
        currentSupply[LEGENDARY_SWORD]++;
        _mint(msg.sender, LEGENDARY_SWORD, 1, "");
        emit ItemCrafted(msg.sender, LEGENDARY_SWORD);
    }
    
    function setURI(string memory newuri) public onlyOwner {
        _setURI(newuri);
    }
    
    function withdraw() public onlyOwner {
        payable(owner()).transfer(address(this).balance);
    }
}`
  },
  {
    id: 'payment-splitter',
    name: 'Payment Splitter',
    description: 'Split payments among multiple recipients',
    category: 'other',
    blockchain: 'ethereum',
    difficulty: 'beginner',
    examplePrompts: [
      'Create a payment splitter',
      'Build a revenue sharing contract',
      'Make a royalty distribution contract'
    ],
    code: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract PaymentSplitter {
    address[] public payees;
    mapping(address => uint256) public shares;
    mapping(address => uint256) public released;
    mapping(address => mapping(address => uint256)) public erc20Released;
    
    uint256 public totalShares;
    uint256 public totalReleased;
    
    event PaymentReceived(address from, uint256 amount);
    event PaymentReleased(address to, uint256 amount);
    event ERC20PaymentReleased(address token, address to, uint256 amount);
    
    constructor(address[] memory _payees, uint256[] memory _shares) {
        require(_payees.length == _shares.length, "Length mismatch");
        require(_payees.length > 0, "No payees");
        
        for (uint256 i = 0; i < _payees.length; i++) {
            require(_payees[i] != address(0), "Invalid address");
            require(_shares[i] > 0, "Invalid share");
            require(shares[_payees[i]] == 0, "Duplicate payee");
            
            payees.push(_payees[i]);
            shares[_payees[i]] = _shares[i];
            totalShares += _shares[i];
        }
    }
    
    receive() external payable {
        emit PaymentReceived(msg.sender, msg.value);
    }
    
    function release(address payable account) public {
        require(shares[account] > 0, "No shares");
        
        uint256 totalReceived = address(this).balance + totalReleased;
        uint256 payment = (totalReceived * shares[account]) / totalShares - released[account];
        
        require(payment > 0, "Nothing to release");
        
        released[account] += payment;
        totalReleased += payment;
        
        account.transfer(payment);
        emit PaymentReleased(account, payment);
    }
    
    function releaseERC20(IERC20 token, address account) public {
        require(shares[account] > 0, "No shares");
        
        uint256 totalReceived = token.balanceOf(address(this)) + erc20Released[address(token)][account];
        uint256 payment = (totalReceived * shares[account]) / totalShares - erc20Released[address(token)][account];
        
        require(payment > 0, "Nothing to release");
        
        erc20Released[address(token)][account] += payment;
        token.transfer(account, payment);
        
        emit ERC20PaymentReleased(address(token), account, payment);
    }
    
    function getPayees() external view returns (address[] memory) {
        return payees;
    }
}`
  },

  // ===== SOLANA CONTRACTS (Anchor Framework) =====
  {
    id: 'solana-spl-token',
    name: 'SPL Token (Solana)',
    description: 'Solana token using Anchor framework',
    category: 'token',
    blockchain: 'solana',
    difficulty: 'intermediate',
    examplePrompts: [
      'Create a Solana token',
      'Build an SPL token',
      'Make a token on Solana'
    ],
    code: `use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, MintTo, Token, TokenAccount};

declare_id!("YourProgramIdHere111111111111111111111111111");

#[program]
pub mod spl_token {
    use super::*;

    pub fn initialize_mint(
        ctx: Context<InitializeMint>,
        decimals: u8,
    ) -> Result<()> {
        msg!("Token mint initialized with {} decimals", decimals);
        Ok(())
    }

    pub fn mint_tokens(
        ctx: Context<MintTokens>,
        amount: u64,
    ) -> Result<()> {
        let cpi_accounts = MintTo {
            mint: ctx.accounts.mint.to_account_info(),
            to: ctx.accounts.token_account.to_account_info(),
            authority: ctx.accounts.authority.to_account_info(),
        };
        
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        
        token::mint_to(cpi_ctx, amount)?;
        msg!("Minted {} tokens", amount);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitializeMint<'info> {
    #[account(
        init,
        payer = payer,
        mint::decimals = 9,
        mint::authority = authority,
    )]
    pub mint: Account<'info, Mint>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct MintTokens<'info> {
    #[account(mut)]
    pub mint: Account<'info, Mint>,
    #[account(mut)]
    pub token_account: Account<'info, TokenAccount>,
    pub authority: Signer<'info>,
    pub token_program: Program<'info, Token>,
}`
  },
  {
    id: 'solana-nft',
    name: 'NFT Collection (Solana)',
    description: 'Solana NFT using Metaplex standards',
    category: 'nft',
    blockchain: 'solana',
    difficulty: 'advanced',
    examplePrompts: [
      'Create a Solana NFT',
      'Build an NFT on Solana',
      'Make a Metaplex NFT'
    ],
    code: `use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, MintTo};
use anchor_spl::associated_token::AssociatedToken;

declare_id!("YourProgramIdHere111111111111111111111111111");

#[program]
pub mod solana_nft {
    use super::*;

    pub fn mint_nft(
        ctx: Context<MintNFT>,
        name: String,
        symbol: String,
        uri: String,
    ) -> Result<()> {
        // Mint exactly 1 token (NFT)
        let cpi_accounts = MintTo {
            mint: ctx.accounts.mint.to_account_info(),
            to: ctx.accounts.token_account.to_account_info(),
            authority: ctx.accounts.authority.to_account_info(),
        };
        
        let cpi_program = ctx.accounts.token_program.to_account_info();
        token::mint_to(CpiContext::new(cpi_program, cpi_accounts), 1)?;

        // Store metadata
        let metadata = &mut ctx.accounts.metadata;
        metadata.name = name;
        metadata.symbol = symbol;
        metadata.uri = uri;
        metadata.mint = ctx.accounts.mint.key();
        metadata.authority = ctx.accounts.authority.key();

        msg!("NFT minted successfully");
        Ok(())
    }
}

#[derive(Accounts)]
pub struct MintNFT<'info> {
    #[account(
        init,
        payer = payer,
        mint::decimals = 0,
        mint::authority = authority,
        mint::freeze_authority = authority,
    )]
    pub mint: Account<'info, Mint>,
    
    #[account(
        init,
        payer = payer,
        associated_token::mint = mint,
        associated_token::authority = authority,
    )]
    pub token_account: Account<'info, TokenAccount>,
    
    #[account(
        init,
        payer = payer,
        space = 8 + NFTMetadata::INIT_SPACE,
        seeds = [b"metadata", mint.key().as_ref()],
        bump
    )]
    pub metadata: Account<'info, NFTMetadata>,
    
    #[account(mut)]
    pub payer: Signer<'info>,
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub rent: Sysvar<'info, Rent>,
}

#[account]
#[derive(InitSpace)]
pub struct NFTMetadata {
    #[max_len(32)]
    pub name: String,
    #[max_len(10)]
    pub symbol: String,
    #[max_len(200)]
    pub uri: String,
    pub mint: Pubkey,
    pub authority: Pubkey,
}`
  },
  {
    id: 'solana-staking',
    name: 'Staking Program (Solana)',
    description: 'Solana staking with rewards',
    category: 'defi',
    blockchain: 'solana',
    difficulty: 'advanced',
    examplePrompts: [
      'Create Solana staking',
      'Build a staking program on Solana',
      'Make a Solana yield farm'
    ],
    code: `use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

declare_id!("YourProgramIdHere111111111111111111111111111");

#[program]
pub mod solana_staking {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>, reward_rate: u64) -> Result<()> {
        let pool = &mut ctx.accounts.staking_pool;
        pool.authority = ctx.accounts.authority.key();
        pool.reward_rate = reward_rate;
        pool.total_staked = 0;
        pool.last_update_time = Clock::get()?.unix_timestamp;
        Ok(())
    }

    pub fn stake(ctx: Context<Stake>, amount: u64) -> Result<()> {
        // Transfer tokens to pool
        let cpi_accounts = Transfer {
            from: ctx.accounts.user_token_account.to_account_info(),
            to: ctx.accounts.pool_token_account.to_account_info(),
            authority: ctx.accounts.user.to_account_info(),
        };
        let cpi_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            cpi_accounts
        );
        token::transfer(cpi_ctx, amount)?;

        // Update staker info
        let staker = &mut ctx.accounts.staker_info;
        let pool = &mut ctx.accounts.staking_pool;
        
        // Calculate pending rewards before updating
        if staker.amount > 0 {
            let pending = calculate_rewards(staker, pool)?;
            staker.pending_rewards += pending;
        }
        
        staker.amount += amount;
        staker.last_stake_time = Clock::get()?.unix_timestamp;
        pool.total_staked += amount;
        pool.last_update_time = Clock::get()?.unix_timestamp;

        msg!("Staked {} tokens", amount);
        Ok(())
    }

    pub fn unstake(ctx: Context<Unstake>, amount: u64) -> Result<()> {
        let staker = &mut ctx.accounts.staker_info;
        require!(staker.amount >= amount, StakingError::InsufficientStake);

        // Transfer tokens back to user
        let pool = &ctx.accounts.staking_pool;
        let seeds = &[
            b"pool".as_ref(),
            &[ctx.bumps.staking_pool],
        ];
        let signer = &[&seeds[..]];

        let cpi_accounts = Transfer {
            from: ctx.accounts.pool_token_account.to_account_info(),
            to: ctx.accounts.user_token_account.to_account_info(),
            authority: ctx.accounts.staking_pool.to_account_info(),
        };
        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            cpi_accounts,
            signer
        );
        token::transfer(cpi_ctx, amount)?;

        staker.amount -= amount;
        ctx.accounts.staking_pool.total_staked -= amount;

        msg!("Unstaked {} tokens", amount);
        Ok(())
    }
}

fn calculate_rewards(staker: &StakerInfo, pool: &StakingPool) -> Result<u64> {
    let current_time = Clock::get()?.unix_timestamp;
    let time_elapsed = (current_time - staker.last_stake_time) as u64;
    let rewards = (staker.amount * pool.reward_rate * time_elapsed) / (365 * 24 * 3600);
    Ok(rewards)
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + StakingPool::INIT_SPACE,
        seeds = [b"pool"],
        bump
    )]
    pub staking_pool: Account<'info, StakingPool>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Stake<'info> {
    #[account(mut, seeds = [b"pool"], bump)]
    pub staking_pool: Account<'info, StakingPool>,
    #[account(
        init_if_needed,
        payer = user,
        space = 8 + StakerInfo::INIT_SPACE,
        seeds = [b"staker", user.key().as_ref()],
        bump
    )]
    pub staker_info: Account<'info, StakerInfo>,
    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub pool_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Unstake<'info> {
    #[account(mut, seeds = [b"pool"], bump)]
    pub staking_pool: Account<'info, StakingPool>,
    #[account(mut, seeds = [b"staker", user.key().as_ref()], bump)]
    pub staker_info: Account<'info, StakerInfo>,
    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub pool_token_account: Account<'info, TokenAccount>,
    pub user: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

#[account]
#[derive(InitSpace)]
pub struct StakingPool {
    pub authority: Pubkey,
    pub reward_rate: u64,
    pub total_staked: u64,
    pub last_update_time: i64,
}

#[account]
#[derive(InitSpace)]
pub struct StakerInfo {
    pub amount: u64,
    pub pending_rewards: u64,
    pub last_stake_time: i64,
}

#[error_code]
pub enum StakingError {
    #[msg("Insufficient staked amount")]
    InsufficientStake,
}`
  },
  {
    id: 'solana-escrow',
    name: 'Escrow Program (Solana)',
    description: 'Trustless token exchange escrow',
    category: 'defi',
    blockchain: 'solana',
    difficulty: 'advanced',
    examplePrompts: [
      'Create a Solana escrow',
      'Build an escrow on Solana',
      'Make a trustless exchange'
    ],
    code: `use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer, CloseAccount};

declare_id!("YourProgramIdHere111111111111111111111111111");

#[program]
pub mod solana_escrow {
    use super::*;

    pub fn initialize_escrow(
        ctx: Context<InitializeEscrow>,
        amount_offered: u64,
        amount_expected: u64,
    ) -> Result<()> {
        let escrow = &mut ctx.accounts.escrow;
        escrow.initializer = ctx.accounts.initializer.key();
        escrow.initializer_token_account = ctx.accounts.initializer_receive_account.key();
        escrow.vault_account = ctx.accounts.vault_account.key();
        escrow.amount_expected = amount_expected;
        escrow.bump = ctx.bumps.escrow;

        // Transfer tokens to vault
        let cpi_accounts = Transfer {
            from: ctx.accounts.initializer_deposit_account.to_account_info(),
            to: ctx.accounts.vault_account.to_account_info(),
            authority: ctx.accounts.initializer.to_account_info(),
        };
        let cpi_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            cpi_accounts
        );
        token::transfer(cpi_ctx, amount_offered)?;

        msg!("Escrow initialized with {} tokens", amount_offered);
        Ok(())
    }

    pub fn exchange(ctx: Context<Exchange>) -> Result<()> {
        let escrow = &ctx.accounts.escrow;

        // Transfer expected tokens to initializer
        let cpi_accounts = Transfer {
            from: ctx.accounts.taker_deposit_account.to_account_info(),
            to: ctx.accounts.initializer_receive_account.to_account_info(),
            authority: ctx.accounts.taker.to_account_info(),
        };
        let cpi_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            cpi_accounts
        );
        token::transfer(cpi_ctx, escrow.amount_expected)?;

        // Transfer vault tokens to taker
        let seeds = &[
            b"escrow".as_ref(),
            ctx.accounts.initializer.key.as_ref(),
            &[escrow.bump],
        ];
        let signer = &[&seeds[..]];

        let vault_balance = ctx.accounts.vault_account.amount;
        let cpi_accounts = Transfer {
            from: ctx.accounts.vault_account.to_account_info(),
            to: ctx.accounts.taker_receive_account.to_account_info(),
            authority: ctx.accounts.escrow.to_account_info(),
        };
        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            cpi_accounts,
            signer
        );
        token::transfer(cpi_ctx, vault_balance)?;

        // Close vault account
        let cpi_accounts = CloseAccount {
            account: ctx.accounts.vault_account.to_account_info(),
            destination: ctx.accounts.initializer.to_account_info(),
            authority: ctx.accounts.escrow.to_account_info(),
        };
        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            cpi_accounts,
            signer
        );
        token::close_account(cpi_ctx)?;

        msg!("Exchange completed successfully");
        Ok(())
    }

    pub fn cancel(ctx: Context<Cancel>) -> Result<()> {
        let escrow = &ctx.accounts.escrow;
        let seeds = &[
            b"escrow".as_ref(),
            ctx.accounts.initializer.key.as_ref(),
            &[escrow.bump],
        ];
        let signer = &[&seeds[..]];

        // Return tokens to initializer
        let vault_balance = ctx.accounts.vault_account.amount;
        let cpi_accounts = Transfer {
            from: ctx.accounts.vault_account.to_account_info(),
            to: ctx.accounts.initializer_deposit_account.to_account_info(),
            authority: ctx.accounts.escrow.to_account_info(),
        };
        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            cpi_accounts,
            signer
        );
        token::transfer(cpi_ctx, vault_balance)?;

        msg!("Escrow cancelled");
        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitializeEscrow<'info> {
    #[account(
        init,
        payer = initializer,
        space = 8 + Escrow::INIT_SPACE,
        seeds = [b"escrow", initializer.key().as_ref()],
        bump
    )]
    pub escrow: Account<'info, Escrow>,
    #[account(mut)]
    pub vault_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub initializer_deposit_account: Account<'info, TokenAccount>,
    pub initializer_receive_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub initializer: Signer<'info>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Exchange<'info> {
    #[account(mut, close = initializer)]
    pub escrow: Account<'info, Escrow>,
    #[account(mut)]
    pub vault_account: Account<'info, TokenAccount>,
    /// CHECK: Validated by escrow account
    #[account(mut)]
    pub initializer: AccountInfo<'info>,
    #[account(mut)]
    pub initializer_receive_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub taker_deposit_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub taker_receive_account: Account<'info, TokenAccount>,
    pub taker: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct Cancel<'info> {
    #[account(mut, close = initializer, has_one = initializer)]
    pub escrow: Account<'info, Escrow>,
    #[account(mut)]
    pub vault_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub initializer_deposit_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub initializer: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

#[account]
#[derive(InitSpace)]
pub struct Escrow {
    pub initializer: Pubkey,
    pub initializer_token_account: Pubkey,
    pub vault_account: Pubkey,
    pub amount_expected: u64,
    pub bump: u8,
}`
  }
];

export function getTemplateById(id: string): ContractTemplate | undefined {
  return contractTemplates.find(t => t.id === id);
}

export function getTemplatesByCategory(category: string): ContractTemplate[] {
  return contractTemplates.filter(t => t.category === category);
}

export function getTemplatesByBlockchain(blockchain: string): ContractTemplate[] {
  return contractTemplates.filter(t => t.blockchain === blockchain || t.blockchain === 'multi');
}

export function searchTemplates(query: string): ContractTemplate[] {
  const lowerQuery = query.toLowerCase();
  return contractTemplates.filter(t => 
    t.name.toLowerCase().includes(lowerQuery) ||
    t.description.toLowerCase().includes(lowerQuery) ||
    t.examplePrompts.some(p => p.toLowerCase().includes(lowerQuery))
  );
}
