"""
Ethereum Wallet MCP Server

Main entry point for the Model Context Protocol server providing
Ethereum wallet generation, HD wallet functionality, and message signing.
"""

import asyncio
import logging
from typing import Any

from mcp.server import Server
from mcp.server.stdio import stdio_server

from .tools.wallet_generation import register_wallet_tools
from .tools.signing import register_signing_tools
from .tools.typed_data import register_typed_data_tools
from .prompts.wallet_prompts import register_wallet_prompts
from .prompts.signing_prompts import register_signing_prompts
from .resources.documentation import register_documentation_resources
from .resources.signing_resources import register_signing_resources

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger("ethereum-wallet-mcp")


def create_server() -> Server:
    """
    Create and configure the MCP server with all tools, prompts, and resources.
    
    Returns:
        Server: Configured MCP server instance
    """
    server = Server("ethereum-wallet-mcp")
    
    # Register all components
    # Wallet tools
    register_wallet_tools(server)
    
    # Signing tools
    register_signing_tools(server)
    register_typed_data_tools(server)
    
    # Prompts
    register_wallet_prompts(server)
    register_signing_prompts(server)
    
    # Resources
    register_documentation_resources(server)
    register_signing_resources(server)
    
    logger.info("Ethereum Wallet MCP Server initialized")
    logger.info("Registered tools: wallet generation, HD wallets, vanity addresses")
    logger.info("Registered tools: message signing, typed data signing, signature verification")
    logger.info("Registered prompts: secure wallet creation, backup guides, recovery help")
    logger.info("Registered prompts: permit signing, signature verification guides")
    logger.info("Registered resources: BIP39 docs, derivation paths, wordlists")
    logger.info("Registered resources: EIP-191 docs, EIP-712 docs, signing templates")
    
    return server


async def run_server() -> None:
    """Run the MCP server using stdio transport."""
    server = create_server()
    
    async with stdio_server() as (read_stream, write_stream):
        logger.info("Starting Ethereum Wallet MCP Server...")
        await server.run(
            read_stream,
            write_stream,
            server.create_initialization_options()
        )


def main() -> None:
    """Main entry point for the ethereum-wallet-mcp command."""
    try:
        asyncio.run(run_server())
    except KeyboardInterrupt:
        logger.info("Server shutdown requested")
    except Exception as e:
        logger.error(f"Server error: {e}")
        raise


if __name__ == "__main__":
    main()
