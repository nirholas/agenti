"""
Plugin Manager - Load, manage, and execute plugins.

Provides:
- Plugin discovery and loading
- Plugin lifecycle management
- Plugin dependency resolution
- Plugin execution orchestration
"""

import asyncio
import importlib
import importlib.util
import logging
from typing import Dict, List, Any, Optional, Type
from dataclasses import dataclass, field
from pathlib import Path
import json

from .plugin_base import (
    PluginBase, PluginMetadata, PluginType,
    AnalyzerPlugin, ProcessorPlugin, ExporterPlugin
)

logger = logging.getLogger(__name__)


@dataclass
class Plugin:
    """Wrapper for a loaded plugin."""
    instance: PluginBase
    metadata: PluginMetadata
    module_path: str
    load_time: float = 0.0
    error: Optional[str] = None
    
    @property
    def name(self) -> str:
        return self.metadata.name
    
    @property
    def enabled(self) -> bool:
        return self.instance.enabled if self.instance else False
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "metadata": self.metadata.to_dict(),
            "module_path": self.module_path,
            "enabled": self.enabled,
            "error": self.error,
        }


class PluginManager:
    """
    Manages plugin lifecycle and execution.
    
    Features:
    - Dynamic plugin loading
    - Plugin dependency resolution
    - Plugin configuration
    - Plugin execution orchestration
    """
    
    def __init__(self, plugin_dirs: Optional[List[str]] = None):
        self._plugins: Dict[str, Plugin] = {}
        self._plugin_dirs = plugin_dirs or ["plugins"]
        self._initialized = False
        self._hooks: Dict[str, List[str]] = {}  # hook_point -> plugin names
    
    async def initialize(self) -> None:
        """Initialize the plugin manager."""
        if self._initialized:
            return
        
        # Discover plugins in directories
        for plugin_dir in self._plugin_dirs:
            await self._discover_plugins(plugin_dir)
        
        # Resolve dependencies
        self._resolve_dependencies()
        
        self._initialized = True
        logger.info(f"Plugin manager initialized with {len(self._plugins)} plugins")
    
    async def shutdown(self) -> None:
        """Shutdown all plugins."""
        for name, plugin in self._plugins.items():
            try:
                await plugin.instance.shutdown()
                logger.debug(f"Plugin shutdown: {name}")
            except Exception as e:
                logger.error(f"Error shutting down plugin {name}: {e}")
        
        self._plugins.clear()
        self._initialized = False
    
    async def _discover_plugins(self, plugin_dir: str) -> None:
        """Discover plugins in a directory."""
        path = Path(plugin_dir)
        if not path.exists():
            logger.debug(f"Plugin directory not found: {plugin_dir}")
            return
        
        for plugin_file in path.glob("**/*.py"):
            if plugin_file.name.startswith("_"):
                continue
            
            try:
                await self._load_plugin_file(str(plugin_file))
            except Exception as e:
                logger.error(f"Error loading plugin {plugin_file}: {e}")
    
    async def _load_plugin_file(self, file_path: str) -> Optional[Plugin]:
        """Load a plugin from a file."""
        import time
        start_time = time.time()
        
        # Load module
        spec = importlib.util.spec_from_file_location("plugin", file_path)
        if spec is None or spec.loader is None:
            return None
        
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        
        # Find plugin class
        plugin_class = None
        for attr_name in dir(module):
            attr = getattr(module, attr_name)
            if (isinstance(attr, type) and 
                issubclass(attr, PluginBase) and 
                attr is not PluginBase and
                attr not in (AnalyzerPlugin, ProcessorPlugin, ExporterPlugin)):
                plugin_class = attr
                break
        
        if plugin_class is None:
            return None
        
        # Instantiate plugin
        instance = plugin_class()
        metadata = instance.metadata
        
        plugin = Plugin(
            instance=instance,
            metadata=metadata,
            module_path=file_path,
            load_time=time.time() - start_time,
        )
        
        self._plugins[metadata.name] = plugin
        logger.info(f"Loaded plugin: {metadata.name} v{metadata.version}")
        
        return plugin
    
    def _resolve_dependencies(self) -> None:
        """Resolve plugin dependencies and determine load order."""
        # Simple dependency check
        for name, plugin in self._plugins.items():
            for dep in plugin.metadata.dependencies:
                if dep not in self._plugins:
                    plugin.error = f"Missing dependency: {dep}"
                    if plugin.instance:
                        plugin.instance.disable()
                    logger.warning(f"Plugin {name} disabled: missing dependency {dep}")
    
    async def load_plugin(
        self,
        plugin_class: Type[PluginBase],
        config: Optional[Dict[str, Any]] = None
    ) -> Plugin:
        """
        Load a plugin class directly.
        
        Args:
            plugin_class: Plugin class to instantiate
            config: Plugin configuration
            
        Returns:
            Loaded plugin wrapper
        """
        instance = plugin_class()
        metadata = instance.metadata
        
        if config:
            await instance.initialize(config)
        
        plugin = Plugin(
            instance=instance,
            metadata=metadata,
            module_path="<runtime>",
        )
        
        self._plugins[metadata.name] = plugin
        return plugin
    
    def get_plugin(self, name: str) -> Optional[Plugin]:
        """Get a plugin by name."""
        return self._plugins.get(name)
    
    def get_plugins_by_type(self, plugin_type: PluginType) -> List[Plugin]:
        """Get all plugins of a specific type."""
        return [
            p for p in self._plugins.values()
            if p.metadata.plugin_type == plugin_type and p.enabled
        ]
    
    def list_plugins(self) -> List[Dict[str, Any]]:
        """List all plugins."""
        return [p.to_dict() for p in self._plugins.values()]
    
    async def execute_analyzers(
        self,
        file_path: str,
        content: str,
        context: Dict[str, Any]
    ) -> Dict[str, Dict[str, Any]]:
        """
        Execute all analyzer plugins on a file.
        
        Args:
            file_path: Path to file
            content: File content
            context: Analysis context
            
        Returns:
            Results from each analyzer plugin
        """
        results = {}
        ext = Path(file_path).suffix
        
        for plugin in self.get_plugins_by_type(PluginType.ANALYZER):
            analyzer: AnalyzerPlugin = plugin.instance
            
            if ext in analyzer.supported_extensions() or not analyzer.supported_extensions():
                try:
                    result = await analyzer.analyze(file_path, content, context)
                    results[plugin.name] = result
                except Exception as e:
                    logger.error(f"Analyzer {plugin.name} failed: {e}")
                    results[plugin.name] = {"error": str(e)}
        
        return results
    
    async def execute_processors(
        self,
        data: Dict[str, Any],
        context: Dict[str, Any],
        processor_names: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        Execute processor plugins on data.
        
        Args:
            data: Input data
            context: Processing context
            processor_names: Optional list of specific processors to run
            
        Returns:
            Processed data
        """
        processors = self.get_plugins_by_type(PluginType.PROCESSOR)
        
        if processor_names:
            processors = [p for p in processors if p.name in processor_names]
        
        result = data.copy()
        
        for plugin in processors:
            processor: ProcessorPlugin = plugin.instance
            try:
                result = await processor.process(result, context)
            except Exception as e:
                logger.error(f"Processor {plugin.name} failed: {e}")
        
        return result
    
    async def execute_exporters(
        self,
        data: Dict[str, Any],
        output_path: str,
        format: str,
        options: Dict[str, Any]
    ) -> Optional[str]:
        """
        Execute an exporter plugin.
        
        Args:
            data: Data to export
            output_path: Output path
            format: Desired format
            options: Export options
            
        Returns:
            Path to exported file
        """
        for plugin in self.get_plugins_by_type(PluginType.EXPORTER):
            exporter: ExporterPlugin = plugin.instance
            
            if format in exporter.supported_formats():
                try:
                    return await exporter.export(data, output_path, options)
                except Exception as e:
                    logger.error(f"Exporter {plugin.name} failed: {e}")
        
        logger.warning(f"No exporter found for format: {format}")
        return None
    
    def register_hook(self, hook_point: str, plugin_name: str) -> None:
        """Register a plugin for a hook point."""
        if hook_point not in self._hooks:
            self._hooks[hook_point] = []
        self._hooks[hook_point].append(plugin_name)
    
    async def execute_hooks(
        self,
        hook_point: str,
        data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Execute all hooks at a point.
        
        Args:
            hook_point: Hook point name
            data: Data to pass to hooks
            
        Returns:
            Modified data
        """
        plugin_names = self._hooks.get(hook_point, [])
        result = data.copy()
        
        for name in plugin_names:
            plugin = self.get_plugin(name)
            if plugin and plugin.enabled:
                try:
                    result = await plugin.instance.execute(hook_point, result)
                except Exception as e:
                    logger.error(f"Hook {name} failed at {hook_point}: {e}")
        
        return result
    
    def get_stats(self) -> Dict[str, Any]:
        """Get plugin manager statistics."""
        by_type = {}
        for plugin in self._plugins.values():
            ptype = plugin.metadata.plugin_type.value
            by_type[ptype] = by_type.get(ptype, 0) + 1
        
        return {
            "total_plugins": len(self._plugins),
            "enabled_plugins": sum(1 for p in self._plugins.values() if p.enabled),
            "plugins_by_type": by_type,
            "plugin_dirs": self._plugin_dirs,
        }
