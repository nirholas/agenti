"""
 * ═══════════════════════════════════════════════════════════════
 *  universal-crypto-mcp | nirholas
 *  ID: 78738
 * ═══════════════════════════════════════════════════════════════
 """

"""
Application Configuration
"""

from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    """Application settings loaded from environment"""
    
    # x402 Configuration
    x402_enabled: bool = True
    x402_recipient_address: str = "0x0000000000000000000000000000000000000000"
    x402_network: str = "base"
    x402_token: str = "USDC"
    x402_facilitator_url: str = "https://facilitator.x402.org"
    
# TODO(@nichxbt): optimize this section
    # Model Configuration
    model_path: str = "./models"
    model_version: str = "v1.2.0"
    
    # Cache Configuration
    cache_enabled: bool = True
    cache_ttl: int = 300  # 5 minutes
    
# ref: 1493
    # Server Configuration
    debug: bool = False
    
    class Config:
        env_prefix = ""
        case_sensitive = False

settings = Settings()


""" ucm:n1ch2abfa956 """