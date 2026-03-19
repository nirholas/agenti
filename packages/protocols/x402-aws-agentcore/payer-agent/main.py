"""Entry point for AgentCore Runtime deployment."""
import logging
import sys
import os

# Configure logging to stdout for CloudWatch - do this FIRST
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler(sys.stdout)],
    force=True
)
logger = logging.getLogger(__name__)

# Flush stdout immediately
sys.stdout.flush()

logger.info("=" * 50)
logger.info("x402 payer agent container starting...")
logger.info(f"Python version: {sys.version}")
logger.info(f"Working directory: {os.getcwd()}")
logger.info(f"Environment variables: {list(os.environ.keys())}")
logger.info("=" * 50)
sys.stdout.flush()

try:
    logger.info("Importing agent.api_server...")
    sys.stdout.flush()
    from agent.api_server import app
    logger.info("Successfully imported API server")
    sys.stdout.flush()
except Exception as e:
    logger.error(f"Failed to import API server: {e}", exc_info=True)
    sys.stdout.flush()
    raise

if __name__ == "__main__":
    import uvicorn
    
    port = int(os.getenv("PORT", "8080"))
    logger.info(f"Starting uvicorn server on 0.0.0.0:{port}")
    sys.stdout.flush()
    
    # Use uvicorn with access logging
    uvicorn.run(
        app, 
        host="0.0.0.0", 
        port=port,
        log_level="info",
        access_log=True
    )
