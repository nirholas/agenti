// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console} from "forge-std/Test.sol";
import {X402RevenueSplitter} from "../src/X402RevenueSplitter.sol";

/**
 * @title X402RevenueSplitterTest
 * @notice Unit tests for the X402 Revenue Splitter contract
 */
contract X402RevenueSplitterTest is Test {
    X402RevenueSplitter public splitter;
    
    address public platformWallet = address(0x1);
    address public developer = address(0x2);
    address public payer = address(0x3);
    
    // Mock USDs token
    MockUSDs public usds;
    
    uint256 public constant PLATFORM_FEE_BPS = 2000; // 20%
    
    function setUp() public {
        // Deploy mock USDs
        usds = new MockUSDs();
        
        // Deploy splitter
        splitter = new X402RevenueSplitter(
            address(usds),
            platformWallet,
            PLATFORM_FEE_BPS
        );
        
        // Fund payer with USDs
        usds.mint(payer, 1000 ether);
        
        // Approve splitter
        vm.prank(payer);
        usds.approve(address(splitter), type(uint256).max);
    }
    
    function testProcessPayment() public {
        uint256 amount = 100 ether;
        
        vm.prank(payer);
        splitter.processPayment(developer, amount, "test payment");
        
        // Developer should get 80%
        assertEq(usds.balanceOf(developer), 80 ether);
        
        // Platform should get 20%
        assertEq(usds.balanceOf(platformWallet), 20 ether);
    }
    
    function testProcessBatchPayments() public {
        X402RevenueSplitter.Payment[] memory payments = new X402RevenueSplitter.Payment[](2);
        payments[0] = X402RevenueSplitter.Payment({
            developer: developer,
            amount: 50 ether,
            memo: "payment 1"
        });
        payments[1] = X402RevenueSplitter.Payment({
            developer: address(0x4),
            amount: 50 ether,
            memo: "payment 2"
        });
        
        vm.prank(payer);
        splitter.processBatchPayments(payments);
        
        // Developer 1 should get 40 (80% of 50)
        assertEq(usds.balanceOf(developer), 40 ether);
        
        // Developer 2 should get 40 (80% of 50)
        assertEq(usds.balanceOf(address(0x4)), 40 ether);
        
        // Platform should get 20 (20% of 100)
        assertEq(usds.balanceOf(platformWallet), 20 ether);
    }
    
    function testZeroAmountReverts() public {
        vm.prank(payer);
        vm.expectRevert("Amount must be > 0");
        splitter.processPayment(developer, 0, "");
    }
    
    function testZeroDeveloperReverts() public {
        vm.prank(payer);
        vm.expectRevert("Invalid developer");
        splitter.processPayment(address(0), 100 ether, "");
    }
    
    function testFuzzPayment(uint256 amount) public {
        amount = bound(amount, 1, 1000 ether);
        
        vm.prank(payer);
        splitter.processPayment(developer, amount, "fuzz test");
        
        uint256 platformAmount = (amount * PLATFORM_FEE_BPS) / 10000;
        uint256 developerAmount = amount - platformAmount;
        
        assertEq(usds.balanceOf(developer), developerAmount);
        assertEq(usds.balanceOf(platformWallet), platformAmount);
    }
}

/**
 * @title MockUSDs
 * @notice Simple ERC20 mock for testing
 */
contract MockUSDs {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    
    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }
    
    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }
    
    function transfer(address to, uint256 amount) external returns (bool) {
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }
    
    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}
