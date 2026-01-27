"""
Pipeline Stages - Pre-built stages for common operations.

Includes:
- File processing stages
- Code analysis stages
- Filter and transform stages
"""

import asyncio
import logging
from typing import Dict, List, Any, Optional, Callable
from pathlib import Path

from .pipeline import Stage, PipelineContext

logger = logging.getLogger(__name__)


class FileStage(Stage[str, Dict[str, Any]]):
    """
    Stage that reads files and produces file info dictionaries.
    
    Input: file path string
    Output: dict with path, content, metadata
    """
    
    def __init__(
        self,
        include_content: bool = True,
        max_size: int = 10 * 1024 * 1024,  # 10MB
        encodings: List[str] = None
    ):
        super().__init__("FileStage")
        self.include_content = include_content
        self.max_size = max_size
        self.encodings = encodings or ["utf-8", "latin-1"]
    
    async def process(
        self,
        item: str,
        context: PipelineContext
    ) -> Optional[Dict[str, Any]]:
        """Read file and return info dict."""
        path = Path(item)
        
        if not path.exists():
            return None
        
        if not path.is_file():
            return None
        
        try:
            stat = path.stat()
            
            if stat.st_size > self.max_size:
                return None
            
            result = {
                "path": str(path),
                "name": path.name,
                "extension": path.suffix,
                "size_bytes": stat.st_size,
                "modified_at": stat.st_mtime,
            }
            
            if self.include_content:
                content = None
                for encoding in self.encodings:
                    try:
                        content = path.read_text(encoding=encoding)
                        result["encoding"] = encoding
                        break
                    except UnicodeDecodeError:
                        continue
                
                if content is None:
                    # Binary file
                    result["is_binary"] = True
                else:
                    result["content"] = content
                    result["line_count"] = content.count("\n") + 1
            
            return result
            
        except Exception as e:
            logger.debug(f"Error reading {path}: {e}")
            return None


class AnalyzerStage(Stage[Dict[str, Any], Dict[str, Any]]):
    """
    Stage that runs AST analysis on files.
    
    Input: file info dict with content
    Output: file info dict with ast_result added
    """
    
    def __init__(self, languages: Optional[List[str]] = None):
        super().__init__("AnalyzerStage")
        self.languages = languages
        self._analyzer = None
    
    async def setup(self, context: PipelineContext) -> None:
        """Initialize AST analyzer."""
        from ..analyzers.ast_analyzer import ASTAnalyzer
        self._analyzer = ASTAnalyzer()
    
    async def process(
        self,
        item: Dict[str, Any],
        context: PipelineContext
    ) -> Optional[Dict[str, Any]]:
        """Analyze file AST."""
        if "content" not in item:
            return item
        
        ext = item.get("extension", "")
        
        # Check if supported language
        supported = {".py", ".js", ".jsx", ".ts", ".tsx", ".go", ".rs", ".java"}
        if ext not in supported:
            return item
        
        try:
            result = await self._analyzer.analyze_file(
                item["path"],
                item["content"]
            )
            item["ast_result"] = result
        except Exception as e:
            item["ast_error"] = str(e)
        
        return item


class PatternStage(Stage[Dict[str, Any], Dict[str, Any]]):
    """
    Stage that detects code patterns.
    
    Input: file info dict with content and optionally ast_result
    Output: file info dict with patterns added
    """
    
    def __init__(self):
        super().__init__("PatternStage")
        self._detector = None
    
    async def setup(self, context: PipelineContext) -> None:
        """Initialize pattern detector."""
        from ..analyzers.pattern_detector import PatternDetector
        self._detector = PatternDetector()
    
    async def process(
        self,
        item: Dict[str, Any],
        context: PipelineContext
    ) -> Optional[Dict[str, Any]]:
        """Detect patterns in file."""
        if "content" not in item:
            return item
        
        try:
            patterns = await self._detector.detect_patterns(
                item["path"],
                item.get("content"),
                item.get("ast_result")
            )
            item["patterns"] = [p.to_dict() for p in patterns]
        except Exception as e:
            item["pattern_error"] = str(e)
        
        return item


class FilterStage(Stage[Dict[str, Any], Dict[str, Any]]):
    """
    Stage that filters items based on conditions.
    
    Items that don't match are filtered out.
    """
    
    def __init__(
        self,
        predicate: Callable[[Dict[str, Any]], bool],
        name: str = "FilterStage"
    ):
        super().__init__(name)
        self._predicate = predicate
    
    async def process(
        self,
        item: Dict[str, Any],
        context: PipelineContext
    ) -> Optional[Dict[str, Any]]:
        """Filter item based on predicate."""
        if self._predicate(item):
            return item
        return None
    
    @classmethod
    def by_extension(cls, extensions: List[str]) -> 'FilterStage':
        """Create filter by file extension."""
        ext_set = set(extensions)
        return cls(
            lambda item: item.get("extension", "") in ext_set,
            name="ExtensionFilter"
        )
    
    @classmethod
    def by_size(cls, min_size: int = 0, max_size: int = float('inf')) -> 'FilterStage':
        """Create filter by file size."""
        return cls(
            lambda item: min_size <= item.get("size_bytes", 0) <= max_size,
            name="SizeFilter"
        )
    
    @classmethod
    def has_key(cls, key: str) -> 'FilterStage':
        """Create filter that requires a key to be present."""
        return cls(
            lambda item: key in item,
            name=f"HasKeyFilter({key})"
        )


class TransformStage(Stage[Dict[str, Any], Dict[str, Any]]):
    """
    Stage that transforms items.
    """
    
    def __init__(
        self,
        transformer: Callable[[Dict[str, Any]], Dict[str, Any]],
        name: str = "TransformStage"
    ):
        super().__init__(name)
        self._transformer = transformer
    
    async def process(
        self,
        item: Dict[str, Any],
        context: PipelineContext
    ) -> Optional[Dict[str, Any]]:
        """Transform item."""
        return self._transformer(item)
    
    @classmethod
    def select_keys(cls, keys: List[str]) -> 'TransformStage':
        """Create transform that selects specific keys."""
        return cls(
            lambda item: {k: item.get(k) for k in keys if k in item},
            name="SelectKeys"
        )
    
    @classmethod
    def add_key(cls, key: str, value_fn: Callable[[Dict], Any]) -> 'TransformStage':
        """Create transform that adds a computed key."""
        def transform(item):
            result = item.copy()
            result[key] = value_fn(item)
            return result
        return cls(transform, name=f"AddKey({key})")
    
    @classmethod
    def rename_key(cls, old_key: str, new_key: str) -> 'TransformStage':
        """Create transform that renames a key."""
        def transform(item):
            result = item.copy()
            if old_key in result:
                result[new_key] = result.pop(old_key)
            return result
        return cls(transform, name=f"RenameKey({old_key}->{new_key})")


class AggregateStage(Stage[Dict[str, Any], Dict[str, Any]]):
    """
    Stage that aggregates items into batches or summaries.
    
    Note: Final incomplete batch handling:
    - The teardown() stores the final batch in context.metadata['final_batch']
    - Callers should check this after pipeline completion to handle remaining items
    """
    
    def __init__(
        self,
        batch_size: int = 10,
        flush_on_teardown: bool = True
    ):
        super().__init__("AggregateStage")
        self.batch_size = batch_size
        self.flush_on_teardown = flush_on_teardown
        self._buffer: List[Dict[str, Any]] = []
    
    async def process(
        self,
        item: Dict[str, Any],
        context: PipelineContext
    ) -> Optional[Dict[str, Any]]:
        """Aggregate items into batches."""
        self._buffer.append(item)
        
        if len(self._buffer) >= self.batch_size:
            batch = self._buffer.copy()
            self._buffer.clear()
            return {
                "batch": batch,
                "count": len(batch),
            }
        
        return None
    
    async def teardown(self, context: PipelineContext) -> None:
        """Store remaining items in context for caller to handle."""
        if self.flush_on_teardown and self._buffer:
            # Store final batch in context for caller to retrieve
            context.metadata['final_batch'] = {
                "batch": self._buffer.copy(),
                "count": len(self._buffer),
            }
            self._buffer.clear()


class MapStage(Stage[Dict[str, Any], Dict[str, Any]]):
    """
    Stage that maps items using an async function.
    """
    
    def __init__(
        self,
        mapper: Callable[[Dict[str, Any]], Any],
        key: str,
        name: str = "MapStage"
    ):
        super().__init__(name)
        self._mapper = mapper
        self._key = key
    
    async def process(
        self,
        item: Dict[str, Any],
        context: PipelineContext
    ) -> Optional[Dict[str, Any]]:
        """Apply mapper and store result in key."""
        result = item.copy()
        
        if asyncio.iscoroutinefunction(self._mapper):
            result[self._key] = await self._mapper(item)
        else:
            result[self._key] = self._mapper(item)
        
        return result


class LogStage(Stage[Dict[str, Any], Dict[str, Any]]):
    """
    Stage that logs items passing through.
    """
    
    def __init__(
        self,
        message: str = "Item",
        log_keys: Optional[List[str]] = None,
        level: int = logging.DEBUG
    ):
        super().__init__("LogStage")
        self._message = message
        self._log_keys = log_keys
        self._level = level
    
    async def process(
        self,
        item: Dict[str, Any],
        context: PipelineContext
    ) -> Optional[Dict[str, Any]]:
        """Log item and pass through."""
        if self._log_keys:
            log_data = {k: item.get(k) for k in self._log_keys}
        else:
            log_data = {"keys": list(item.keys())}
        
        logger.log(self._level, f"{self._message}: {log_data}")
        return item
