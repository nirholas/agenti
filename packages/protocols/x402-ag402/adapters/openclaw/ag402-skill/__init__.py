"""ag402 Skill for OpenClaw.

Integrates ag402 AI Agent Payment Protocol with OpenClaw agents.
Enables autonomous payment for API calls via HTTP 402 and Solana USDC.
"""

__version__ = "0.1.0"

from ag402_skill.skill import AG402Skill

__all__ = ["__version__", "AG402Skill"]
