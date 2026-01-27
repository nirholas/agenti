"""
Signing MCP Server Prompts
"""

from .message_workflow import register_message_prompts
from .typed_data_workflow import register_typed_data_prompts
from .verification_workflow import register_verification_prompts
from .permit_workflow import register_permit_prompts

__all__ = [
    "register_message_prompts",
    "register_typed_data_prompts",
    "register_verification_prompts",
    "register_permit_prompts",
]
