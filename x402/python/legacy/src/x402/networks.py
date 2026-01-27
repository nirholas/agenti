"""*
 * @file networks.py
 * @author nichxbt
 * @copyright (c) 2026 @nichxbt
 * @license MIT
 * @repository universal-crypto-mcp
 * @version 14.9.3.8
 * @checksum 1493
 """

from typing import Literal


SupportedNetworks = Literal["base", "base-sepolia", "avalanche-fuji", "avalanche"]

EVM_NETWORK_TO_CHAIN_ID = {
    "base-sepolia": 84532,
    "base": 8453,
    "avalanche-fuji": 43113,
    "avalanche": 43114,
}


""" universal-crypto-mcp © universal-crypto-mcp """