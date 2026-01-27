"""
Plugin Base Classes - Abstract base classes for plugins.

Provides standardized interfaces for:
- Analyzer plugins
- Processor plugins
- Exporter plugins
"""

from abc import ABC, abstractmethod
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, field
from enum import Enum


class PluginType(Enum):
    """Types of plugins supported."""
    ANALYZER = "analyzer"
    PROCESSOR = "processor"
    EXPORTER = "exporter"
    TRANSFORMER = "transformer"
    HOOK = "hook"


@dataclass
class PluginMetadata:
    """Metadata for a plugin."""
    name: str
    version: str
    description: str
    author: str = ""
    plugin_type: PluginType = PluginType.ANALYZER
    dependencies: List[str] = field(default_factory=list)
    config_schema: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "version": self.version,
            "description": self.description,
            "author": self.author,
            "plugin_type": self.plugin_type.value,
            "dependencies": self.dependencies,
            "config_schema": self.config_schema,
        }


class PluginBase(ABC):
    """
    Base class for all plugins.
    
    All plugins must implement:
    - metadata property
    - initialize()
    - shutdown()
    """
    
    def __init__(self):
        self._config: Dict[str, Any] = {}
        self._enabled: bool = True
    
    @property
    @abstractmethod
    def metadata(self) -> PluginMetadata:
        """Return plugin metadata."""
        pass
    
    @abstractmethod
    async def initialize(self, config: Dict[str, Any]) -> bool:
        """
        Initialize the plugin with configuration.
        
        Args:
            config: Plugin configuration
            
        Returns:
            True if initialization successful
        """
        pass
    
    @abstractmethod
    async def shutdown(self) -> None:
        """Clean up plugin resources."""
        pass
    
    @property
    def enabled(self) -> bool:
        """Check if plugin is enabled."""
        return self._enabled
    
    def enable(self) -> None:
        """Enable the plugin."""
        self._enabled = True
    
    def disable(self) -> None:
        """Disable the plugin."""
        self._enabled = False
    
    def configure(self, config: Dict[str, Any]) -> None:
        """Update plugin configuration."""
        self._config.update(config)


class AnalyzerPlugin(PluginBase):
    """
    Base class for analyzer plugins.
    
    Analyzer plugins analyze code and produce structured results.
    """
    
    @abstractmethod
    async def analyze(
        self,
        file_path: str,
        content: str,
        context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Analyze a file.
        
        Args:
            file_path: Path to the file
            content: File content
            context: Additional context (AST, dependencies, etc.)
            
        Returns:
            Analysis results
        """
        pass
    
    @abstractmethod
    def supported_extensions(self) -> List[str]:
        """Return list of supported file extensions."""
        pass


class ProcessorPlugin(PluginBase):
    """
    Base class for processor plugins.
    
    Processor plugins transform or enrich data.
    """
    
    @abstractmethod
    async def process(
        self,
        data: Dict[str, Any],
        context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Process data.
        
        Args:
            data: Input data to process
            context: Processing context
            
        Returns:
            Processed data
        """
        pass
    
    @abstractmethod
    def input_schema(self) -> Dict[str, Any]:
        """Return expected input schema."""
        pass
    
    @abstractmethod
    def output_schema(self) -> Dict[str, Any]:
        """Return output schema."""
        pass


class ExporterPlugin(PluginBase):
    """
    Base class for exporter plugins.
    
    Exporter plugins output analysis results in various formats.
    """
    
    @abstractmethod
    async def export(
        self,
        data: Dict[str, Any],
        output_path: str,
        options: Dict[str, Any]
    ) -> str:
        """
        Export data to a file.
        
        Args:
            data: Data to export
            output_path: Output file path
            options: Export options
            
        Returns:
            Path to exported file
        """
        pass
    
    @abstractmethod
    def supported_formats(self) -> List[str]:
        """Return list of supported output formats."""
        pass


class TransformerPlugin(PluginBase):
    """
    Base class for transformer plugins.
    
    Transformer plugins convert between data formats.
    """
    
    @abstractmethod
    async def transform(
        self,
        data: Any,
        source_format: str,
        target_format: str
    ) -> Any:
        """
        Transform data between formats.
        
        Args:
            data: Input data
            source_format: Source format
            target_format: Target format
            
        Returns:
            Transformed data
        """
        pass
    
    @abstractmethod
    def supported_transformations(self) -> List[tuple]:
        """Return list of (source, target) format pairs."""
        pass


class HookPlugin(PluginBase):
    """
    Base class for hook plugins.
    
    Hook plugins execute at specific points in the pipeline.
    """
    
    @abstractmethod
    def hook_points(self) -> List[str]:
        """Return list of hook points this plugin handles."""
        pass
    
    @abstractmethod
    async def execute(
        self,
        hook_point: str,
        data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Execute hook at a specific point.
        
        Args:
            hook_point: Name of the hook point
            data: Data available at this hook
            
        Returns:
            Modified data
        """
        pass
