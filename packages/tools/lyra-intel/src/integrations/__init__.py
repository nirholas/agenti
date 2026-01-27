"""Integration Hub module - External service integrations."""

from .integration_hub import IntegrationHub, IntegrationConfig
from .github_integration import GitHubIntegration
from .slack_integration import SlackIntegration

__all__ = [
    "IntegrationHub",
    "IntegrationConfig",
    "GitHubIntegration",
    "SlackIntegration",
]
