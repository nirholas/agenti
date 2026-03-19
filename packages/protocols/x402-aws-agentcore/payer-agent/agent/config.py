"""Configuration for the x402 payer agent."""

import os
from dataclasses import dataclass
from dotenv import load_dotenv

load_dotenv()


@dataclass
class AgentConfig:
    """Configuration for the payer agent."""

    # AgentCore Runtime configuration
    agent_runtime_arn: str = ""
    aws_region: str = "us-west-2"
    
    # Bedrock model configuration (for local development)
    # Use cross-region inference profile for Claude Sonnet
    model_id: str = "us.anthropic.claude-3-5-sonnet-20241022-v2:0"

    # CDP (Coinbase Developer Platform) configuration
    cdp_api_key_name: str = ""
    cdp_api_key_private_key: str = ""
    cdp_wallet_secret: str = ""
    cdp_wallet_address: str = ""  # Optional: pin to specific wallet address

    # Network configuration
    network_id: str = "base-sepolia"

    # Seller API configuration
    seller_api_url: str = ""
    
    # OpenTelemetry configuration
    otel_endpoint: str = ""
    otel_console_export: bool = False

    @classmethod
    def from_env(cls) -> "AgentConfig":
        """Load configuration from environment variables."""
        return cls(
            agent_runtime_arn=os.getenv("AGENT_RUNTIME_ARN", ""),
            aws_region=os.getenv("AWS_REGION", cls.aws_region),
            model_id=os.getenv("BEDROCK_MODEL_ID", cls.model_id),
            cdp_api_key_name=os.getenv("CDP_API_KEY_ID", ""),
            cdp_api_key_private_key=os.getenv("CDP_API_KEY_SECRET", ""),
            cdp_wallet_secret=os.getenv("CDP_WALLET_SECRET", ""),
            cdp_wallet_address=os.getenv("CDP_WALLET_ADDRESS", ""),
            network_id=os.getenv("NETWORK_ID", cls.network_id),
            seller_api_url=os.getenv("SELLER_API_URL", ""),
            otel_endpoint=os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT", ""),
            otel_console_export=os.getenv("OTEL_CONSOLE_EXPORT", "").lower() == "true",
        )


# Global config instance
config = AgentConfig.from_env()
