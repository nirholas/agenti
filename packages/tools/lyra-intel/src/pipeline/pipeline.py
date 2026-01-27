"""
Pipeline - Streaming data pipeline for processing.

Provides:
- Async generators for streaming
- Stage-based processing
- Parallel execution
- Error handling
"""

import asyncio
import logging
from typing import (
    Dict, List, Any, Optional, AsyncIterator, 
    Callable, Awaitable, TypeVar, Generic
)
from dataclasses import dataclass, field
from abc import ABC, abstractmethod
from datetime import datetime
import uuid

logger = logging.getLogger(__name__)

T = TypeVar('T')
U = TypeVar('U')


@dataclass
class PipelineConfig:
    """Configuration for pipeline."""
    max_concurrency: int = 10
    buffer_size: int = 100
    timeout: int = 300
    retry_count: int = 3
    retry_delay: float = 1.0
    stop_on_error: bool = False


@dataclass
class PipelineContext:
    """Context passed through pipeline stages."""
    pipeline_id: str
    stage_index: int = 0
    metadata: Dict[str, Any] = field(default_factory=dict)
    errors: List[str] = field(default_factory=list)
    start_time: datetime = field(default_factory=datetime.now)
    
    def add_error(self, error: str) -> None:
        """Add an error to context."""
        self.errors.append(error)
    
    def elapsed_seconds(self) -> float:
        """Get elapsed time in seconds."""
        return (datetime.now() - self.start_time).total_seconds()


class Stage(ABC, Generic[T, U]):
    """
    Abstract base class for pipeline stages.
    
    Each stage transforms input items to output items.
    """
    
    def __init__(self, name: str = ""):
        self.name = name or self.__class__.__name__
        self._stats = {
            "items_processed": 0,
            "items_failed": 0,
            "total_time_ms": 0,
        }
    
    @abstractmethod
    async def process(
        self,
        item: T,
        context: PipelineContext
    ) -> Optional[U]:
        """
        Process a single item.
        
        Args:
            item: Input item
            context: Pipeline context
            
        Returns:
            Transformed item or None to filter out
        """
        pass
    
    async def process_batch(
        self,
        items: List[T],
        context: PipelineContext
    ) -> List[U]:
        """
        Process a batch of items.
        
        Default implementation processes items sequentially.
        Override for batch optimizations.
        """
        results = []
        for item in items:
            result = await self.process(item, context)
            if result is not None:
                results.append(result)
        return results
    
    async def setup(self, context: PipelineContext) -> None:
        """Called before processing starts."""
        pass
    
    async def teardown(self, context: PipelineContext) -> None:
        """Called after processing completes."""
        pass
    
    def get_stats(self) -> Dict[str, Any]:
        """Get stage statistics."""
        return {
            "name": self.name,
            **self._stats,
        }


class Pipeline:
    """
    Streaming data pipeline.
    
    Features:
    - Stage-based processing
    - Async streaming
    - Parallel execution
    - Backpressure handling
    """
    
    def __init__(self, config: Optional[PipelineConfig] = None):
        self.config = config or PipelineConfig()
        self._stages: List[Stage] = []
        self._id = str(uuid.uuid4())[:8]
        self._running = False
        self._stats = {
            "items_in": 0,
            "items_out": 0,
            "errors": 0,
            "runs": 0,
        }
    
    def add_stage(self, stage: Stage) -> 'Pipeline':
        """
        Add a stage to the pipeline.
        
        Args:
            stage: Stage to add
            
        Returns:
            Self for chaining
        """
        self._stages.append(stage)
        return self
    
    def add_stages(self, stages: List[Stage]) -> 'Pipeline':
        """Add multiple stages."""
        for stage in stages:
            self.add_stage(stage)
        return self
    
    async def run(
        self,
        source: AsyncIterator[Any]
    ) -> AsyncIterator[Any]:
        """
        Run the pipeline on a source.
        
        Args:
            source: Async iterator of input items
            
        Yields:
            Processed output items
        """
        self._stats["runs"] += 1
        self._running = True
        
        context = PipelineContext(pipeline_id=self._id)
        
        # Setup stages
        for i, stage in enumerate(self._stages):
            context.stage_index = i
            await stage.setup(context)
        
        try:
            # Process items
            async for item in source:
                self._stats["items_in"] += 1
                
                result = await self._process_item(item, context)
                
                if result is not None:
                    self._stats["items_out"] += 1
                    yield result
                    
        except Exception as e:
            self._stats["errors"] += 1
            logger.error(f"Pipeline error: {e}")
            if self.config.stop_on_error:
                raise
                
        finally:
            # Teardown stages
            for i, stage in enumerate(self._stages):
                context.stage_index = i
                await stage.teardown(context)
            
            self._running = False
    
    async def run_batch(
        self,
        items: List[Any]
    ) -> List[Any]:
        """
        Run the pipeline on a batch of items.
        
        Args:
            items: List of input items
            
        Returns:
            List of output items
        """
        async def source():
            for item in items:
                yield item
        
        results = []
        async for result in self.run(source()):
            results.append(result)
        
        return results
    
    async def run_parallel(
        self,
        source: AsyncIterator[Any]
    ) -> AsyncIterator[Any]:
        """
        Run the pipeline with parallel processing.
        
        Uses semaphore to limit concurrency.
        Note: For simpler use cases, use run() which provides sequential processing.
        """
        semaphore = asyncio.Semaphore(self.config.max_concurrency)
        results_queue: asyncio.Queue = asyncio.Queue()
        finished = asyncio.Event()
        processing_done = asyncio.Event()
        
        context = PipelineContext(pipeline_id=self._id)
        
        # Setup stages
        for i, stage in enumerate(self._stages):
            context.stage_index = i
            await stage.setup(context)
        
        async def process_item(item):
            """Process a single item with semaphore."""
            async with semaphore:
                result = await self._process_item(item, context)
                if result is not None:
                    await results_queue.put(result)
        
        async def process_all():
            """Process all items from source."""
            tasks = []
            async for item in source:
                task = asyncio.create_task(process_item(item))
                tasks.append(task)
            
            # Wait for all tasks to complete
            if tasks:
                await asyncio.gather(*tasks, return_exceptions=True)
            
            finished.set()
            processing_done.set()
        
        # Start processing in background
        process_task = asyncio.create_task(process_all())
        
        try:
            # Yield results as they become available
            while not (finished.is_set() and results_queue.empty()):
                try:
                    result = await asyncio.wait_for(results_queue.get(), timeout=0.1)
                    yield result
                except asyncio.TimeoutError:
                    if finished.is_set() and results_queue.empty():
                        break
                    continue
        finally:
            await process_task
            
            # Teardown stages
            for i, stage in enumerate(self._stages):
                context.stage_index = i
                await stage.teardown(context)
    
    async def _process_item(
        self,
        item: Any,
        context: PipelineContext
    ) -> Optional[Any]:
        """Process an item through all stages."""
        current = item
        
        for i, stage in enumerate(self._stages):
            context.stage_index = i
            
            try:
                import time
                start = time.perf_counter()
                
                current = await stage.process(current, context)
                
                stage._stats["items_processed"] += 1
                stage._stats["total_time_ms"] += (time.perf_counter() - start) * 1000
                
                if current is None:
                    return None
                    
            except Exception as e:
                stage._stats["items_failed"] += 1
                context.add_error(f"Stage {stage.name}: {str(e)}")
                
                if self.config.stop_on_error:
                    raise
                
                logger.warning(f"Stage {stage.name} failed: {e}")
                return None
        
        return current
    
    def get_stats(self) -> Dict[str, Any]:
        """Get pipeline statistics."""
        return {
            "pipeline_id": self._id,
            "running": self._running,
            "stages": len(self._stages),
            **self._stats,
            "stage_stats": [s.get_stats() for s in self._stages],
        }
    
    def reset_stats(self) -> None:
        """Reset all statistics."""
        self._stats = {
            "items_in": 0,
            "items_out": 0,
            "errors": 0,
            "runs": 0,
        }
        for stage in self._stages:
            stage._stats = {
                "items_processed": 0,
                "items_failed": 0,
                "total_time_ms": 0,
            }


class FunctionStage(Stage[T, U]):
    """Stage that wraps a function."""
    
    def __init__(
        self,
        func: Callable[[T, PipelineContext], Awaitable[Optional[U]]],
        name: str = ""
    ):
        super().__init__(name or func.__name__)
        self._func = func
    
    async def process(
        self,
        item: T,
        context: PipelineContext
    ) -> Optional[U]:
        """Process using wrapped function."""
        return await self._func(item, context)


def stage(name: str = ""):
    """
    Decorator to create a stage from a function.
    
    Usage:
        @stage("my_stage")
        async def process_item(item, context):
            return transformed_item
    """
    def decorator(func: Callable[[T, PipelineContext], Awaitable[Optional[U]]]):
        return FunctionStage(func, name or func.__name__)
    return decorator
