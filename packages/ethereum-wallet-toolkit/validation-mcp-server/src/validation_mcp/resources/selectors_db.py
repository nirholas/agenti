"""
Function Selectors Database Resource

Provides a database of common function selectors.
"""

from mcp.server.fastmcp import FastMCP


SELECTORS_DATABASE = """
# Common Ethereum Function Selectors

## ERC-20 Standard
| Selector | Function | Description |
|----------|----------|-------------|
| 0x06fdde03 | name() | Token name |
| 0x95d89b41 | symbol() | Token symbol |
| 0x313ce567 | decimals() | Token decimals |
| 0x18160ddd | totalSupply() | Total supply |
| 0x70a08231 | balanceOf(address) | Get balance |
| 0xa9059cbb | transfer(address,uint256) | Transfer tokens |
| 0x095ea7b3 | approve(address,uint256) | Approve spender |
| 0xdd62ed3e | allowance(address,address) | Check allowance |
| 0x23b872dd | transferFrom(address,address,uint256) | Transfer from |

## ERC-721 Standard (NFT)
| Selector | Function | Description |
|----------|----------|-------------|
| 0x70a08231 | balanceOf(address) | NFT balance |
| 0x6352211e | ownerOf(uint256) | Token owner |
| 0x42842e0e | safeTransferFrom(address,address,uint256) | Safe transfer |
| 0xb88d4fde | safeTransferFrom(address,address,uint256,bytes) | Safe transfer with data |
| 0x23b872dd | transferFrom(address,address,uint256) | Transfer |
| 0x095ea7b3 | approve(address,uint256) | Approve |
| 0xa22cb465 | setApprovalForAll(address,bool) | Set operator |
| 0x081812fc | getApproved(uint256) | Get approved |
| 0xe985e9c5 | isApprovedForAll(address,address) | Check operator |
| 0xc87b56dd | tokenURI(uint256) | Token metadata URI |

## ERC-1155 Standard (Multi-token)
| Selector | Function | Description |
|----------|----------|-------------|
| 0x00fdd58e | balanceOf(address,uint256) | Token balance |
| 0x4e1273f4 | balanceOfBatch(address[],uint256[]) | Batch balance |
| 0xf242432a | safeTransferFrom(address,address,uint256,uint256,bytes) | Transfer |
| 0x2eb2c2d6 | safeBatchTransferFrom(address,address,uint256[],uint256[],bytes) | Batch transfer |
| 0xa22cb465 | setApprovalForAll(address,bool) | Set operator |
| 0xe985e9c5 | isApprovedForAll(address,address) | Check operator |

## EIP-2612 Permit
| Selector | Function | Description |
|----------|----------|-------------|
| 0xd505accf | permit(address,address,uint256,uint256,uint8,bytes32,bytes32) | Gasless approval |
| 0x7ecebe00 | nonces(address) | Get nonce |
| 0x3644e515 | DOMAIN_SEPARATOR() | EIP-712 domain |

## Common DeFi (Uniswap-style)
| Selector | Function | Description |
|----------|----------|-------------|
| 0x7ff36ab5 | swapExactETHForTokens(...) | ETH → tokens |
| 0x18cbafe5 | swapExactTokensForETH(...) | Tokens → ETH |
| 0x38ed1739 | swapExactTokensForTokens(...) | Token swap |
| 0xe8e33700 | addLiquidity(...) | Add liquidity |
| 0xbaa2abde | removeLiquidity(...) | Remove liquidity |
| 0x02751cec | removeLiquidityETH(...) | Remove liquidity ETH |

## Proxy Patterns
| Selector | Function | Description |
|----------|----------|-------------|
| 0x5c60da1b | implementation() | Get implementation |
| 0x3659cfe6 | upgradeTo(address) | Upgrade proxy |
| 0x4f1ef286 | upgradeToAndCall(address,bytes) | Upgrade and call |
| 0xf851a440 | admin() | Proxy admin |

## Ownership (OpenZeppelin)
| Selector | Function | Description |
|----------|----------|-------------|
| 0x8da5cb5b | owner() | Get owner |
| 0xf2fde38b | transferOwnership(address) | Transfer ownership |
| 0x715018a6 | renounceOwnership() | Renounce ownership |

## Access Control
| Selector | Function | Description |
|----------|----------|-------------|
| 0x91d14854 | hasRole(bytes32,address) | Check role |
| 0x2f2ff15d | grantRole(bytes32,address) | Grant role |
| 0xd547741f | revokeRole(bytes32,address) | Revoke role |
| 0x36568abe | renounceRole(bytes32,address) | Renounce role |

## Multicall
| Selector | Function | Description |
|----------|----------|-------------|
| 0xac9650d8 | multicall(bytes[]) | Batch calls |
| 0x5ae401dc | multicall(uint256,bytes[]) | Multicall with deadline |

## Computing Selectors
```
selector = keccak256("functionName(type1,type2)")[:4]
```
Example:
```
keccak256("transfer(address,uint256)") = 0xa9059cbb...
selector = 0xa9059cbb
```
"""


def register_selectors_db_resources(server: FastMCP) -> None:
    """Register function selectors database resources."""
    
    @server.resource("validation://function-selectors-db")
    async def get_function_selectors_db() -> str:
        """
        Database of common Ethereum function selectors.
        
        Includes ERC standards, DeFi protocols, proxy patterns,
        and common utility functions.
        """
        return SELECTORS_DATABASE
