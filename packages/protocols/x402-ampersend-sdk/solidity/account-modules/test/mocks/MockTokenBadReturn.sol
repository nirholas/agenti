// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

// Mock ERC20 token that returns malformed data (not 32 bytes) on transfer
contract MockTokenBadReturn {
    mapping(address => uint256) private _balances;
    mapping(address => mapping(address => uint256)) private _allowances;
    uint256 private _totalSupply;

    string public name = "Bad Return Token";
    string public symbol = "BAD";
    uint8 public decimals = 18;

    function totalSupply() public view returns (uint256) {
        return _totalSupply;
    }

    function balanceOf(address account) public view returns (uint256) {
        return _balances[account];
    }

    function allowance(address owner, address spender) public view returns (uint256) {
        return _allowances[owner][spender];
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        _allowances[msg.sender][spender] = amount;
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        require(_balances[msg.sender] >= amount, "Insufficient balance");
        _balances[msg.sender] -= amount;
        _balances[to] += amount;

        // Return malformed data (64 bytes instead of 32)
        assembly {
            let ptr := mload(0x40)
            mstore(ptr, 0x0000000000000000000000000000000000000000000000000000000000000001)
            mstore(add(ptr, 0x20), 0x0000000000000000000000000000000000000000000000000000000000000001)
            return(ptr, 0x40)
        }
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        require(_balances[from] >= amount, "Insufficient balance");
        require(_allowances[from][msg.sender] >= amount, "Insufficient allowance");

        _balances[from] -= amount;
        _balances[to] += amount;
        _allowances[from][msg.sender] -= amount;

        return true;
    }

    function mint(address to, uint256 amount) external {
        _balances[to] += amount;
        _totalSupply += amount;
    }
}
