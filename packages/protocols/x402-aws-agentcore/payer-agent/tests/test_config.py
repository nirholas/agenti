"""Tests for the agent configuration module."""

import os
from unittest.mock import patch

from agent.config import AgentConfig


class TestAgentConfig:
    """Tests for AgentConfig class."""

    def test_default_values(self):
        """Test that default values are set correctly."""
        config = AgentConfig()

        assert config.model_id == "us.anthropic.claude-3-5-sonnet-20241022-v2:0"
        assert config.aws_region == "us-west-2"
        assert config.network_id == "base-sepolia"
        assert config.cdp_api_key_name == ""
        assert config.cdp_api_key_private_key == ""
        assert config.seller_api_url == ""

    def test_from_env_with_defaults(self):
        """Test from_env uses defaults when env vars not set."""
        with patch.dict(os.environ, {}, clear=True):
            config = AgentConfig.from_env()

            assert config.model_id == "us.anthropic.claude-3-5-sonnet-20241022-v2:0"
            assert config.aws_region == "us-west-2"
            assert config.network_id == "base-sepolia"

    def test_from_env_with_custom_values(self):
        """Test from_env reads environment variables correctly."""
        env_vars = {
            "BEDROCK_MODEL_ID": "anthropic.claude-3-haiku",
            "AWS_REGION": "us-east-1",
            "CDP_API_KEY_ID": "test-key",
            "CDP_API_KEY_SECRET": "test-private-key",
            "NETWORK_ID": "base-mainnet",
            "SELLER_API_URL": "https://api.example.com",
        }
        
        with patch.dict(os.environ, env_vars, clear=True):
            config = AgentConfig.from_env()
            
            assert config.model_id == "anthropic.claude-3-haiku"
            assert config.aws_region == "us-east-1"
            assert config.cdp_api_key_name == "test-key"
            assert config.cdp_api_key_private_key == "test-private-key"
            assert config.network_id == "base-mainnet"
            assert config.seller_api_url == "https://api.example.com"
