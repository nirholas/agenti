"""
Keystore MCP Server

Main entry point for the Model Context Protocol server providing
Ethereum keystore management functionality.
"""

import asyncio
import logging

from mcp.server import Server
from mcp.server.stdio import stdio_server

from .tools.encrypt import register_encrypt_tools
from .tools.decrypt import register_decrypt_tools
from .tools.file_ops import register_file_tools
from .tools.validation import register_validation_tools
from .tools.batch import register_batch_tools
from .resources.specification import register_specification_resources
from .resources.security import register_security_resources
from .resources.examples import register_example_resources
from .prompts.backup import register_backup_prompts
from .prompts.migration import register_migration_prompts
from .prompts.recovery import register_recovery_prompts

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger("keystore-mcp-server")


def create_server() -> Server:
    """
    Create and configure the MCP server with all tools, prompts, and resources.
    
    Returns:
        Server: Configured MCP server instance
    """
    server = Server("keystore-mcp-server")
    
    # Register tools
    register_encrypt_tools(server)
    register_decrypt_tools(server)
    register_file_tools(server)
    register_validation_tools(server)
    register_batch_tools(server)
    
    # Register resources
    register_specification_resources(server)
    register_security_resources(server)
    register_example_resources(server)
    
    # Register prompts
    register_backup_prompts(server)
    register_migration_prompts(server)
    register_recovery_prompts(server)
    
    logger.info("Keystore MCP Server initialized")
    logger.info("Tools: encrypt, decrypt, file operations, validation, batch")
    logger.info("Resources: specification, security guide, examples")
    logger.info("Prompts: backup, migration, recovery, security audit")
    
    return server


async def run_server() -> None:
    """Run the MCP server using stdio transport."""
    server = create_server()
    
    async with stdio_server() as (read_stream, write_stream):
        logger.info("Starting Keystore MCP Server...")
        await server.run(
            read_stream,
            write_stream,
            server.create_initialization_options()
        )


def main() -> None:
    """Main entry point for the keystore-mcp-server command."""
    try:
        asyncio.run(run_server())
    except KeyboardInterrupt:
        logger.info("Server shutdown requested")
    except Exception as e:
        logger.error(f"Server error: {e}")
        raise


if __name__ == "__main__":
    main()
