"""
Typed Data Templates Resource

Common EIP-712 typed data templates for DeFi operations.
"""

import json
from mcp.server import Server


PERMIT_TEMPLATE = {
    "name": "ERC-20 Permit (EIP-2612)",
    "description": "Gasless token approvals - approve spending without gas",
    "typed_data": {
        "types": {
            "EIP712Domain": [
                {"name": "name", "type": "string"},
                {"name": "version", "type": "string"},
                {"name": "chainId", "type": "uint256"},
                {"name": "verifyingContract", "type": "address"}
            ],
            "Permit": [
                {"name": "owner", "type": "address"},
                {"name": "spender", "type": "address"},
                {"name": "value", "type": "uint256"},
                {"name": "nonce", "type": "uint256"},
                {"name": "deadline", "type": "uint256"}
            ]
        },
        "primaryType": "Permit",
        "domain": {
            "name": "TOKEN_NAME",
            "version": "1",
            "chainId": 1,
            "verifyingContract": "0x0000000000000000000000000000000000000000"
        },
        "message": {
            "owner": "0x0000000000000000000000000000000000000000",
            "spender": "0x0000000000000000000000000000000000000000",
            "value": "1000000000000000000",
            "nonce": 0,
            "deadline": 1893456000
        }
    },
    "fields": {
        "domain.name": "Token name (e.g., 'USD Coin')",
        "domain.verifyingContract": "Token contract address",
        "message.owner": "Your address (signer)",
        "message.spender": "Address allowed to spend tokens",
        "message.value": "Amount in wei (use type(uint256).max for unlimited)",
        "message.nonce": "Get from token.nonces(owner)",
        "message.deadline": "Unix timestamp when permit expires"
    }
}

PERMIT2_TEMPLATE = {
    "name": "Uniswap Permit2",
    "description": "Universal permit system - one approval for all protocols",
    "typed_data": {
        "types": {
            "EIP712Domain": [
                {"name": "name", "type": "string"},
                {"name": "chainId", "type": "uint256"},
                {"name": "verifyingContract", "type": "address"}
            ],
            "PermitSingle": [
                {"name": "details", "type": "PermitDetails"},
                {"name": "spender", "type": "address"},
                {"name": "sigDeadline", "type": "uint256"}
            ],
            "PermitDetails": [
                {"name": "token", "type": "address"},
                {"name": "amount", "type": "uint160"},
                {"name": "expiration", "type": "uint48"},
                {"name": "nonce", "type": "uint48"}
            ]
        },
        "primaryType": "PermitSingle",
        "domain": {
            "name": "Permit2",
            "chainId": 1,
            "verifyingContract": "0x000000000022D473030F116dDEE9F6B43aC78BA3"
        },
        "message": {
            "details": {
                "token": "0x0000000000000000000000000000000000000000",
                "amount": "1461501637330902918203684832716283019655932542975",
                "expiration": 1893456000,
                "nonce": 0
            },
            "spender": "0x0000000000000000000000000000000000000000",
            "sigDeadline": 1893456000
        }
    },
    "fields": {
        "domain.chainId": "Chain ID (1 for mainnet)",
        "message.details.token": "Token contract address",
        "message.details.amount": "Amount (use max uint160 for unlimited)",
        "message.details.expiration": "When allowance expires",
        "message.details.nonce": "Get from Permit2.allowance(owner, token, spender)",
        "message.spender": "Protocol address to approve",
        "message.sigDeadline": "When signature expires"
    },
    "note": "Permit2 contract is deployed at same address on all chains"
}

DEX_ORDER_TEMPLATE = {
    "name": "DEX Limit Order",
    "description": "Off-chain limit order for decentralized exchanges",
    "typed_data": {
        "types": {
            "EIP712Domain": [
                {"name": "name", "type": "string"},
                {"name": "version", "type": "string"},
                {"name": "chainId", "type": "uint256"},
                {"name": "verifyingContract", "type": "address"}
            ],
            "Order": [
                {"name": "maker", "type": "address"},
                {"name": "taker", "type": "address"},
                {"name": "makerToken", "type": "address"},
                {"name": "takerToken", "type": "address"},
                {"name": "makerAmount", "type": "uint256"},
                {"name": "takerAmount", "type": "uint256"},
                {"name": "expiry", "type": "uint256"},
                {"name": "salt", "type": "uint256"}
            ]
        },
        "primaryType": "Order",
        "domain": {
            "name": "Exchange",
            "version": "1.0",
            "chainId": 1,
            "verifyingContract": "0x0000000000000000000000000000000000000000"
        },
        "message": {
            "maker": "0x0000000000000000000000000000000000000000",
            "taker": "0x0000000000000000000000000000000000000000",
            "makerToken": "0x0000000000000000000000000000000000000000",
            "takerToken": "0x0000000000000000000000000000000000000000",
            "makerAmount": "1000000000000000000",
            "takerAmount": "3000000000",
            "expiry": 1893456000,
            "salt": 0
        }
    },
    "fields": {
        "message.maker": "Your address (order creator)",
        "message.taker": "Specific taker or zero for any",
        "message.makerToken": "Token you're selling",
        "message.takerToken": "Token you're buying",
        "message.makerAmount": "Amount selling (in wei)",
        "message.takerAmount": "Amount buying (in wei)",
        "message.expiry": "Order expiration timestamp",
        "message.salt": "Random number for uniqueness"
    }
}


def register_template_resources(server: Server) -> None:
    """Register typed data template resources."""
    
    @server.resource("templates://permit")
    async def get_permit_template() -> str:
        """
        Get ERC-20 Permit (EIP-2612) template.
        """
        return json.dumps(PERMIT_TEMPLATE, indent=2)
    
    @server.resource("templates://permit2")
    async def get_permit2_template() -> str:
        """
        Get Uniswap Permit2 template.
        """
        return json.dumps(PERMIT2_TEMPLATE, indent=2)
    
    @server.resource("templates://dex-order")
    async def get_dex_order_template() -> str:
        """
        Get DEX limit order template.
        """
        return json.dumps(DEX_ORDER_TEMPLATE, indent=2)
    
    @server.resource("templates://all")
    async def get_all_templates() -> str:
        """
        Get all available typed data templates.
        """
        return json.dumps({
            "permit": PERMIT_TEMPLATE,
            "permit2": PERMIT2_TEMPLATE,
            "dex_order": DEX_ORDER_TEMPLATE
        }, indent=2)
