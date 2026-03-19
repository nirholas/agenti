// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControlDefaultAdminRules} from "openzeppelin-contracts/access/extensions/AccessControlDefaultAdminRules.sol";
import {IERC20} from "openzeppelin-contracts/token/ERC20/IERC20.sol";
import {X402Token} from "./X402Token.sol";
import {TreasuryVault, ISwapRouter02, IUniswapV2Router02} from "./TreasuryVault.sol";

interface IUniswapV2Factory {
    function getPair(address, address) external view returns (address);
    function createPair(address, address) external returns (address);
}

contract VendingMachine is AccessControlDefaultAdminRules {
    // --- Roles / Errors
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    error NotOperator();
    error LaunchNotFound();
    error InvalidSize();
    error SalesClosed();
    error CapExceeded();
    error AlreadyGraduated();
    error NotGraduatable();
    error RefundWindowClosed();
    error Zero();
    error OnlyAdmin();
    error NothingToRefund();
    error VaultInsufficient();

    // --- Constants (Base)
    IERC20 public constant USDC = IERC20(0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913); // 6d
    IERC20 public constant HEU  = IERC20(0xEF22cb48B8483dF6152e1423b19dF5553BbD818b); // 18d
    ISwapRouter02 public constant V3_ROUTER     = ISwapRouter02(0x2626664c2603336E57B271c5C0b26F421741e481);
    IUniswapV2Router02 public constant V2_ROUTER= IUniswapV2Router02(0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24);
    IUniswapV2Factory  public constant V2_FACTORY = IUniswapV2Factory(0x8909Dc15e40173Ff4699343b6eB8132c65e18eC6);

    // Prices (tokens per 1 USDC in 6d units)
    uint256 private constant TOKENS_PER_USDC_TEST_6D = 200_000_000 * 1e12; // test
    uint256 private constant TOKENS_PER_USDC_S_6D    = 200_000 * 1e12;     // Small
    uint256 private constant TOKENS_PER_USDC_L_6D    =  20_000 * 1e12;     // Large

    uint256 public constant FAIR_CAP = 800_000_000e18;

    enum Size { TEST, S, L }

    struct Launch {
        address creator;     // ERC-7572 setter
        address token;       // X402Token
        Size size;
        uint64 createdAt;

        // accounting
        uint256 allocated;       // total allocated to buyers (18d)
        uint256 targetUSDC;      // 4e6 (TEST), 4,000e6 (S) or 40,000e6 (L)
        uint256 usdcAccounted;   // sum of contributions for this launch (6d)
        bool    graduated;
    }

    // --- Global single vault (x402 payTo)
    address public immutable vault;

    // --- Per-launch buyer state
    mapping(uint256 => mapping(address => uint256)) public contributions6d; // USDC (6d)
    mapping(uint256 => mapping(address => uint256)) public allocations;     // tokens (18d)
    mapping(uint256 => Launch) public launches;
    mapping(address => uint256) public launchByToken;
    uint256 public nextLaunchId;

    // --- Global accounting for solvency checks against pooled vault
    uint256 public usdcAccountedTotal;  // sum over launches (6d)

    // --- HEU price oracle (18 decimals, e.g., 0.04e18 = $0.04 per HEU)
    uint256 public heuOraclePrice;

    address[] private _operators;

    // --- Events
    event Coined(uint256 indexed id, address token, Size size, address creator, string contractURI);
    event PurchaseRecorded(uint256 indexed id, address buyer, uint256 usdcAmount, uint256 tokensAllocated);
    event Graduated(uint256 indexed id, uint256 usdcIn, uint256 heuOut, uint256 lpBurned, uint256 adminReward, uint256 creatorReward);
    event Claimed(uint256 indexed id, address buyer, uint256 tokens);
    event Refunded(uint256 indexed id, address buyer, uint256 usdcAmount);
    event EmergencyWithdrawn(uint256 usdcAmount, address to);
    event OperatorAdded(address indexed operator);
    event OperatorRemoved(address indexed operator);
    event HeuOraclePriceUpdated(uint256 newPrice);

    constructor(address admin_, address[] memory initialOperators)
        AccessControlDefaultAdminRules(1, admin_)
    {
        if (admin_ == address(0)) revert Zero();

        for (uint256 i = 0; i < initialOperators.length; i++) {
            address op = initialOperators[i];
            if (op != address(0) && !hasRole(OPERATOR_ROLE, op)) {
                _grantRole(OPERATOR_ROLE, op);
                _operators.push(op);
                emit OperatorAdded(op);
            }
        }

        // deploy the shared vault; set owner = this vending machine
        address v = address(new TreasuryVault(address(this)));
        vault = v;
    }

    modifier onlyOp(){ if (!hasRole(OPERATOR_ROLE, msg.sender)) revert NotOperator(); _; }
    function _get(uint256 id) internal view returns (Launch storage L) {
        L = launches[id]; if (L.token == address(0)) revert LaunchNotFound();
    }

    function addOperators(address[] calldata operators) external onlyRole(DEFAULT_ADMIN_ROLE) {
        for (uint256 i = 0; i < operators.length; i++) {
            address op = operators[i];
            if (op != address(0) && !hasRole(OPERATOR_ROLE, op)) {
                _grantRole(OPERATOR_ROLE, op);
                _operators.push(op);
                emit OperatorAdded(op);
            }
        }
    }

    function removeOperators(address[] calldata operators) external onlyRole(DEFAULT_ADMIN_ROLE) {
        for (uint256 i = 0; i < operators.length; i++) {
            address op = operators[i];
            if (hasRole(OPERATOR_ROLE, op)) {
                _revokeRole(OPERATOR_ROLE, op);
                _removeFromOperatorArray(op);
                emit OperatorRemoved(op);
            }
        }
    }

    function _removeFromOperatorArray(address op) private {
        for (uint256 i = 0; i < _operators.length; i++) {
            if (_operators[i] == op) {
                _operators[i] = _operators[_operators.length - 1];
                _operators.pop();
                break;
            }
        }
    }

    function getOperators() external view returns (address[] memory) {
        return _operators;
    }

    function isOperator(address account) external view returns (bool) {
        return hasRole(OPERATOR_ROLE, account);
    }

    function updateHeuOraclePrice(uint256 newPrice) external onlyOp {
        if (newPrice == 0) revert Zero();
        heuOraclePrice = newPrice;
        emit HeuOraclePriceUpdated(newPrice);
    }

    function coin(
        string memory name_,
        string memory symbol_,
        string memory initialContractURI,
        address creator,
        Size size
    ) external onlyOp returns (uint256 id, address token) {
        if (size != Size.S && size != Size.L && size != Size.TEST) revert InvalidSize();

        id = ++nextLaunchId;

        token = address(new X402Token(
            name_, symbol_,
            1_000_000_000e18,  // 1B max
            address(this),     // admin
            address(this),     // minter
            address(this),     // burner
            creator,           // ERC-7572 setter
            initialContractURI
        ));

        Launch storage L = launches[id];
        L.creator   = creator;
        L.token     = token;
        L.size      = size;
        L.createdAt = uint64(block.timestamp);
        // TEST = 4 USDC, S = 4000 USDC, L = 40000 USDC (80% of total supply for public sale)
        L.targetUSDC= (size == Size.TEST) ? 4_000_000 : (size == Size.S) ? 4_000e6 : 40_000e6;

        launchByToken[token] = id;

        emit Coined(id, token, size, creator, initialContractURI);
    }

    function handlePurchase(uint256 id, address buyer, uint256 usdcAmount) external onlyOp {
        if (usdcAmount == 0) revert Zero();
        Launch storage L = _get(id);
        if (L.graduated) revert SalesClosed();

        // Global solvency check against pooled vault
        uint256 bal = USDC.balanceOf(vault);
        if (usdcAccountedTotal + usdcAmount > bal) revert VaultInsufficient();

        uint256 perUSDC =
            (L.size == Size.TEST) ? TOKENS_PER_USDC_TEST_6D :
            (L.size == Size.S)    ? TOKENS_PER_USDC_S_6D    :
                                    TOKENS_PER_USDC_L_6D;
        uint256 tokens = usdcAmount * perUSDC;

        if (L.allocated + tokens > FAIR_CAP) revert CapExceeded();

        contributions6d[id][buyer] += usdcAmount;
        allocations[id][buyer]     += tokens;
        L.usdcAccounted            += usdcAmount;
        L.allocated                += tokens;
        usdcAccountedTotal         += usdcAmount;

        X402Token(L.token).mint(buyer, tokens);

        emit PurchaseRecorded(id, buyer, usdcAmount, tokens);
    }

    function handleBatchPurchase(uint256 id, address[] calldata buyers, uint256 usdcAmount) external onlyOp {
        if (usdcAmount == 0 || buyers.length == 0) revert Zero();
        Launch storage L = _get(id);
        if (L.graduated) revert SalesClosed();

        uint256 totalAmount = usdcAmount * buyers.length;
        uint256 bal = USDC.balanceOf(vault);
        if (usdcAccountedTotal + totalAmount > bal) revert VaultInsufficient();

        uint256 perUSDC =
            (L.size == Size.TEST) ? TOKENS_PER_USDC_TEST_6D :
            (L.size == Size.S)    ? TOKENS_PER_USDC_S_6D    :
                                    TOKENS_PER_USDC_L_6D;
        uint256 tokensPerBuyer = usdcAmount * perUSDC;
        uint256 totalTokens    = tokensPerBuyer * buyers.length;

        if (L.allocated + totalTokens > FAIR_CAP) revert CapExceeded();

        L.usdcAccounted += totalAmount;
        L.allocated     += totalTokens;
        usdcAccountedTotal += totalAmount;

        address token = L.token;
        for (uint256 i = 0; i < buyers.length; i++) {
            address b = buyers[i];
            contributions6d[id][b] += usdcAmount;
            allocations[id][b]     += tokensPerBuyer;
            X402Token(token).mint(b, tokensPerBuyer);
            emit PurchaseRecorded(id, b, usdcAmount, tokensPerBuyer);
        }
    }

    // --- Graduate (operator only): only when EXACTLY 800M allocated (80% public sale)
    function graduate(uint256 id) external onlyOp {
        Launch storage L = _get(id);
        if (L.graduated) revert AlreadyGraduated();
        if (L.allocated != FAIR_CAP) revert NotGraduatable();

        uint256 usdcIn = L.usdcAccounted;
        if (usdcIn == 0 || USDC.balanceOf(vault) < usdcIn) revert VaultInsufficient();
        if (heuOraclePrice == 0) revert Zero();

        // Calculate minHeuOut with 90% slippage tolerance
        // expectedHEU = usdcIn (6d) * 1e18 / heuOraclePrice (18d) = HEU in 18d
        // minHeuOut = expectedHEU * 0.1 (accept 10% of expected, i.e., 90% slippage)
        uint256 expectedHEU = (usdcIn * 1e18) / heuOraclePrice;
        uint256 minHeuOut = expectedHEU / 10;

        TreasuryVault(vault).swapUSDCforHEU(
            V3_ROUTER, USDC, HEU, 10000, usdcIn, minHeuOut
        );
        // decrease the pooled accounting
        usdcAccountedTotal -= usdcIn;
        L.usdcAccounted = 0;

        address token = L.token;
        X402Token(token).enableTransfers();

        // Mint rewards: 2% to admin, 8% to creator (fair launch model)
        uint256 adminReward = 20_000_000e18;   // 2% of 1B
        uint256 creatorReward = 80_000_000e18; // 8% of 1B
        X402Token(token).mint(defaultAdmin(), adminReward);
        X402Token(token).mint(L.creator, creatorReward);

        // Mint 100M (10%) to vault, then add v2 liquidity with ALL HEU acquired
        X402Token(token).mint(vault, 100_000_000e18);
        uint256 heuBal = HEU.balanceOf(vault);
        TreasuryVault(vault).addLiquidityV2(
            V2_ROUTER, IERC20(token), HEU,
            100_000_000e18, heuBal,
            0, 0 // no slippage protection needed for new pool
        );

        L.graduated = true;
        emit Graduated(id, usdcIn, heuBal, 0, adminReward, creatorReward);
    }

    function refundable(address tokenAddress) external view returns (bool) {
        uint256 id = launchByToken[tokenAddress];
        if (id == 0) return false;
        Launch storage L = launches[id];
        if (L.graduated) return false;
        return block.timestamp > L.createdAt + 14 days;
    }

    // --- Refund buyer (operator), after 14 days if not graduated
    function refund(uint256 id, address buyer) external onlyOp {
        Launch storage L = _get(id);
        if (L.graduated) revert RefundWindowClosed();
        if (block.timestamp <= L.createdAt + 14 days) revert RefundWindowClosed();

        uint256 amt = contributions6d[id][buyer];
        if (amt == 0) revert NothingToRefund();

        // Effects first
        contributions6d[id][buyer] = 0;
        uint256 alloc = allocations[id][buyer];
        allocations[id][buyer] = 0;

        L.usdcAccounted     -= amt;
        usdcAccountedTotal  -= amt;
        L.allocated         -= alloc;

        // burn already-minted tokens (only pre-graduation allowed)
        X402Token(L.token).burn(buyer, alloc);

        // pay back USDC
        TreasuryVault(vault).pull(USDC, buyer, amt);

        emit Refunded(id, buyer, amt);
    }

    function adminRefund(address to, uint256 usdcAmount) external onlyRole(DEFAULT_ADMIN_ROLE) {
        // does NOT touch any launch accounting. intended for off-chain tracked anomalies
        TreasuryVault(vault).pull(USDC, to, usdcAmount);
    }

    function emergencyWithdrawUSDC(address to) external onlyRole(DEFAULT_ADMIN_ROLE) {
        uint256 bal = USDC.balanceOf(vault);
        TreasuryVault(vault).pull(USDC, to, bal);
        emit EmergencyWithdrawn(bal, to);
    }
}
