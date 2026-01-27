"""
Transaction MCP Server

Main entry point for the Model Context Protocol server providing
Ethereum transaction building, signing, and decoding functionality.
"""

import asyncio
import logging

from mcp.server import Server
from mcp.server.stdio import stdio_server

from .tools.building import register_building_tools
from .tools.signing import register_signing_tools
from .tools.decoding import register_decoding_tools
from .tools.gas import register_gas_tools
from .tools.encoding import register_encoding_tools
from .resources.transaction_types import register_transaction_types_resources
from .resources.gas_guide import register_gas_resources
from .resources.chain_ids import register_chain_resources
from .resources.eip1559 import register_eip1559_resources
from .prompts.transfer_workflow import register_transfer_prompts
from .prompts.token_workflow import register_token_prompts
from .prompts.decode_workflow import register_decode_prompts
from .prompts.gas_workflow import register_gas_prompts

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger("transaction-mcp-server")


def create_server() -> Server:
    """
    Create and configure the MCP server with all tools, prompts, and resources.
    
    Returns:
        Server: Configured MCP server instance
    """
    server = Server("transaction-mcp-server")
    
    # Register tools
    register_building_tools(server)
    register_signing_tools(server)
    register_decoding_tools(server)
    register_gas_tools(server)
    register_encoding_tools(server)
    
    # Register resources
    register_transaction_types_resources(server)
    register_gas_resources(server)
    register_chain_resources(server)
    register_eip1559_resources(server)
    
    # Register prompts
    register_transfer_prompts(server)
    register_token_prompts(server)
    register_decode_prompts(server)
    register_gas_prompts(server)
    
    logger.info("Transaction MCP Server initialized")
    logger.info("Tools: build, sign, decode, gas utilities, data encoding")
    logger.info("Resources: transaction types, gas guide, chain IDs, EIP-1559")
    logger.info("Prompts: transfer, token, decode, gas optimization")
    
    return server


async def run_server() -> None:
    """Run the MCP server using stdio transport."""
    server = create_server()
    
    async with stdio_server() as (read_stream, write_stream):
        logger.info("Starting Transaction MCP Server...")
        await server.run(
            read_stream,
            write_stream,
            server.create_initialization_options()
        )


def main() -> None:
    """Main entry point for the transaction-mcp-server command."""
    try:
        asyncio.run(run_server())
    except KeyboardInterrupt:
        logger.info("Server shutdown requested")
    except Exception as e:
        logger.error(f"Server error: {e}")
        raise


if __name__ == "__main__":
    main()
