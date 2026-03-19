// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "openzeppelin-contracts/token/ERC20/ERC20.sol";
import {AccessControl} from "openzeppelin-contracts/access/AccessControl.sol";
import {EIP712} from "openzeppelin-contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "openzeppelin-contracts/utils/cryptography/ECDSA.sol";

interface IERC7572 { function contractURI() external view returns (string memory); }

contract X402Token is ERC20, EIP712, AccessControl, IERC7572 {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant BURNER_ROLE = keccak256("BURNER_ROLE");
    bytes32 public constant CONTRACT_URI_SETTER_ROLE = keccak256("CONTRACT_URI_SETTER_ROLE");

    uint256 public immutable MAX_SUPPLY;
    string  private _contractURI;
    bool    public transfersEnabled;  // locked until graduation

    // --- ERC-3009 typehashes
    bytes32 public constant TRANSFER_WITH_AUTHORIZATION_TYPEHASH =
        0x7c7c6cdb67a18743f49ec6fa9b35f50d52ed05cbed4cc592e13b44501c1a2267;
    bytes32 public constant RECEIVE_WITH_AUTHORIZATION_TYPEHASH =
        0xd099cc98ef71107a616c4f0f941f04c322d8e254fe26b3c6668db87aae413de8;
    bytes32 public constant CANCEL_AUTHORIZATION_TYPEHASH =
        0x158b0a9edf7a828aad02f63cd515c68ef2f50ba807396f6d12842833a1597429;

    mapping(address => mapping(bytes32 => bool)) private _authUsed;

    // --- Errors
    error NotMinter();
    error NotBurner();
    error CapExceeded();
    error TransfersDisabled();
    error AuthorizationAlreadyUsed();
    error AuthorizationExpired();
    error InvalidSignature();
    error BadRecipient();
    error NotContractUriSetter();

    event AuthorizationUsed(address indexed authorizer, bytes32 indexed nonce);
    event AuthorizationCanceled(address indexed authorizer, bytes32 indexed nonce);
    event ContractURIUpdated(string newURI);

    constructor(
        string memory name_,
        string memory symbol_,
        uint256 maxSupply_,
        address admin,
        address minter,
        address burner,
        address creator,
        string memory initialURI
    ) ERC20(name_, symbol_) EIP712(name_, "1") {
        MAX_SUPPLY = maxSupply_;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MINTER_ROLE, minter);
        _grantRole(BURNER_ROLE, burner);
        _grantRole(CONTRACT_URI_SETTER_ROLE, creator);
        _contractURI = initialURI;
        transfersEnabled = false;
    }

    // --- ERC-7572
    function contractURI() external view override returns (string memory) {
        return _contractURI;
    }

    function setContractURI(string calldata newURI) external {
        if (!hasRole(CONTRACT_URI_SETTER_ROLE, msg.sender)) revert NotContractUriSetter();
        _contractURI = newURI;
        emit ContractURIUpdated(newURI);
    }

    function _update(address from, address to, uint256 value) internal override {
        // allow mint/burn always; block regular transfers until enabled
        if (from != address(0) && to != address(0) && !transfersEnabled) {
            revert TransfersDisabled();
        }
        super._update(from, to, value);
    }

    // --- enable transfers at graduation (only admin = VendingMachine)
    function enableTransfers() external onlyRole(DEFAULT_ADMIN_ROLE) {
        transfersEnabled = true;
    }

    // --- Mint with cap
    function mint(address to, uint256 amount) external {
        if (!hasRole(MINTER_ROLE, msg.sender)) revert NotMinter();
        if (totalSupply() + amount > MAX_SUPPLY) revert CapExceeded();
        _mint(to, amount);
    }

    function burn(address from, uint256 amount) external {
        if (!hasRole(BURNER_ROLE, msg.sender)) revert NotBurner();
        _burn(from, amount);
    }

    // --- ERC3009 helpers
    function authorizationState(address authorizer, bytes32 nonce) external view returns (bool) {
        return _authUsed[authorizer][nonce];
    }

    function _useAuthorization(address authorizer, bytes32 nonce) internal {
        if (_authUsed[authorizer][nonce]) revert AuthorizationAlreadyUsed();
        _authUsed[authorizer][nonce] = true;
        emit AuthorizationUsed(authorizer, nonce);
    }

    function _requireTimeRange(uint256 validAfter, uint256 validBefore) internal view {
        if (block.timestamp < validAfter || block.timestamp > validBefore) revert AuthorizationExpired();
    }

    function transferWithAuthorization(
        address from, address to, uint256 value,
        uint256 validAfter, uint256 validBefore, bytes32 nonce,
        uint8 v, bytes32 r, bytes32 s
    ) external {
        _requireTimeRange(validAfter, validBefore);
        bytes32 digest = _hashTypedDataV4(
            keccak256(abi.encode(
                TRANSFER_WITH_AUTHORIZATION_TYPEHASH,
                from, to, value, validAfter, validBefore, nonce
            ))
        );
        address signer = ECDSA.recover(digest, v, r, s);
        if (signer != from) revert InvalidSignature();
        _useAuthorization(from, nonce);
        _transfer(from, to, value);
    }

    function receiveWithAuthorization(
        address from, address to, uint256 value,
        uint256 validAfter, uint256 validBefore, bytes32 nonce,
        uint8 v, bytes32 r, bytes32 s
    ) external {
        if (to != msg.sender) revert BadRecipient();
        _requireTimeRange(validAfter, validBefore);
        bytes32 digest = _hashTypedDataV4(
            keccak256(abi.encode(
                RECEIVE_WITH_AUTHORIZATION_TYPEHASH,
                from, to, value, validAfter, validBefore, nonce
            ))
        );
        address signer = ECDSA.recover(digest, v, r, s);
        if (signer != from) revert InvalidSignature();
        _useAuthorization(from, nonce);
        _transfer(from, to, value);
    }

    function cancelAuthorization(address authorizer, bytes32 nonce,
        uint8 v, bytes32 r, bytes32 s
    ) external {
        bytes32 digest = _hashTypedDataV4(
            keccak256(abi.encode(CANCEL_AUTHORIZATION_TYPEHASH, authorizer, nonce))
        );
        address signer = ECDSA.recover(digest, v, r, s);
        if (signer != authorizer) revert InvalidSignature();
        _useAuthorization(authorizer, nonce);
        emit AuthorizationCanceled(authorizer, nonce);
    }
}
