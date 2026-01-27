"""
Lyra Intel - Plugin System Module

Extensible plugin architecture for custom analyzers and processors.
"""

from .plugin_manager import PluginManager, Plugin
from .plugin_base import PluginBase, AnalyzerPlugin, ProcessorPlugin, ExporterPlugin

__all__ = [
    "PluginManager", "Plugin",
    "PluginBase", "AnalyzerPlugin", "ProcessorPlugin", "ExporterPlugin"
]
