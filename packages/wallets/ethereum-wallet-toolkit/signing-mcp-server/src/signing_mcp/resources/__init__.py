"""
Signing MCP Server Resources
"""

from .eip191 import register_eip191_resources
from .eip712 import register_eip712_resources
from .signature_formats import register_signature_format_resources
from .typed_data_templates import register_template_resources

__all__ = [
    "register_eip191_resources",
    "register_eip712_resources",
    "register_signature_format_resources",
    "register_template_resources",
]
