"""Prompts package for Keystore MCP Server."""

from .backup import register_backup_prompts
from .migration import register_migration_prompts
from .recovery import register_recovery_prompts

__all__ = [
    "register_backup_prompts",
    "register_migration_prompts",
    "register_recovery_prompts",
]
