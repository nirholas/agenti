"""
Validation MCP Server

Main entry point for the Model Context Protocol server providing
Ethereum validation and utility functionality.
"""

import asyncio
import logging

from mcp.server.fastmcp import FastMCP

from .tools.address_validation import register_address_tools
from .tools.key_validation import register_key_tools
from .tools.checksum import register_checksum_tools
from .tools.derivation import register_derivation_tools
from .tools.signature_validation import register_signature_tools
from .tools.hex_validation import register_hex_tools
from .tools.hashing import register_hashing_tools
from .tools.selectors import register_selector_tools
from .tools.storage import register_storage_tools
from .resources.eip55 import register_eip55_resources
from .resources.secp256k1 import register_secp256k1_resources
from .resources.selectors_db import register_selectors_db_resources
from .resources.patterns import register_patterns_resources
from .prompts.validation_workflow import register_validation_prompts
from .prompts.security_audit import register_security_prompts
from .prompts.encoding_helper import register_encoding_prompts

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger("validation-mcp-server")


def create_server() -> FastMCP:
    """
    Create and configure the MCP server with all tools, prompts, and resources.
    
    Returns:
        FastMCP: Configured MCP server instance
    """
    server = FastMCP("validation-mcp-server")
    
    # Register tools
    register_address_tools(server)
    register_key_tools(server)
    register_checksum_tools(server)
    register_derivation_tools(server)
    register_signature_tools(server)
    register_hex_tools(server)
    register_hashing_tools(server)
    register_selector_tools(server)
    register_storage_tools(server)
    
    # Register resources
    register_eip55_resources(server)
    register_secp256k1_resources(server)
    register_selectors_db_resources(server)
    register_patterns_resources(server)
    
    # Register prompts
    register_validation_prompts(server)
    register_security_prompts(server)
    register_encoding_prompts(server)
    
    logger.info("Validation MCP Server initialized")
    logger.info("Tools: address validation, key validation, checksum, derivation")
    logger.info("Tools: signature validation, hex validation, hashing, selectors, storage")
    logger.info("Resources: EIP-55, secp256k1, function selectors, address patterns")
    logger.info("Prompts: validation workflow, security audit, encoding helper")
    
    return server


async def run_server() -> None:
    """Run the MCP server using stdio transport."""
    server = create_server()
    logger.info("Starting Validation MCP Server...")
    await server.run_stdio_async()


def main() -> None:
    """Main entry point for the validation-mcp-server command."""
    try:
        asyncio.run(run_server())
    except KeyboardInterrupt:
        logger.info("Server shutdown requested")
    except Exception as e:
        logger.error(f"Server error: {e}")
        raise


if __name__ == "__main__":
    main()
