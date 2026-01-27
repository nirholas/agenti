"""
Signing MCP Server

Main entry point for the Model Context Protocol server providing
Ethereum message signing and EIP-712 typed data functionality.
"""

import asyncio
import logging

from mcp.server import Server
from mcp.server.stdio import stdio_server

from .tools.message_signing import register_message_signing_tools
from .tools.typed_data import register_typed_data_tools
from .tools.signature_utils import register_signature_utils
from .tools.hash_signing import register_hash_signing_tools
from .resources.eip191 import register_eip191_resources
from .resources.eip712 import register_eip712_resources
from .resources.signature_formats import register_signature_format_resources
from .resources.typed_data_templates import register_template_resources
from .prompts.message_workflow import register_message_prompts
from .prompts.typed_data_workflow import register_typed_data_prompts
from .prompts.verification_workflow import register_verification_prompts
from .prompts.permit_workflow import register_permit_prompts

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger("signing-mcp-server")


def create_server() -> Server:
    """
    Create and configure the MCP server with all tools, prompts, and resources.
    
    Returns:
        Server: Configured MCP server instance
    """
    server = Server("signing-mcp-server")
    
    # Register tools
    register_message_signing_tools(server)
    register_typed_data_tools(server)
    register_signature_utils(server)
    register_hash_signing_tools(server)
    
    # Register resources
    register_eip191_resources(server)
    register_eip712_resources(server)
    register_signature_format_resources(server)
    register_template_resources(server)
    
    # Register prompts
    register_message_prompts(server)
    register_typed_data_prompts(server)
    register_verification_prompts(server)
    register_permit_prompts(server)
    
    logger.info("Signing MCP Server initialized")
    logger.info("Tools: sign_message, sign_message_hex, verify_message, recover_signer")
    logger.info("Tools: sign_typed_data, verify_typed_data, recover_typed_data_signer, hash_typed_data")
    logger.info("Tools: decompose_signature, compose_signature, normalize_signature, sign_hash")
    logger.info("Resources: EIP-191, EIP-712, signature formats, typed data templates")
    logger.info("Prompts: message workflow, typed data workflow, verification, permit signing")
    
    return server


async def run_server() -> None:
    """Run the MCP server using stdio transport."""
    server = create_server()
    
    async with stdio_server() as (read_stream, write_stream):
        logger.info("Starting Signing MCP Server...")
        await server.run(
            read_stream,
            write_stream,
            server.create_initialization_options()
        )


def main() -> None:
    """Main entry point for the signing-mcp-server command."""
    try:
        asyncio.run(run_server())
    except KeyboardInterrupt:
        logger.info("Server shutdown requested")
    except Exception as e:
        logger.error(f"Server error: {e}")
        raise


if __name__ == "__main__":
    main()
