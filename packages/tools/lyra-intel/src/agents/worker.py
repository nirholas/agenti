"""
Analysis Worker - Individual worker agent for processing tasks.

Supports multiple analysis types:
- File analysis
- AST parsing
- Dependency mapping
- Pattern detection
- Git history analysis
"""

import asyncio
from typing import Dict, Any, Optional, Callable, Awaitable
from dataclasses import dataclass
import logging

logger = logging.getLogger(__name__)


@dataclass
class WorkerConfig:
    """Configuration for analysis worker."""
    agent_id: Optional[str] = None
    coordinator_url: Optional[str] = None
    heartbeat_interval: int = 30
    max_concurrent_tasks: int = 1


class AnalysisWorker:
    """
    Worker agent for processing analysis tasks.
    
    Can run:
    - Standalone (local mode)
    - Connected to coordinator (distributed mode)
    """
    
    def __init__(self, config: Optional[WorkerConfig] = None):
        self.config = config or WorkerConfig()
        self._handlers: Dict[str, Callable[[Dict], Awaitable[Dict]]] = {}
        self._running = False
        
        # Register default handlers
        self._register_default_handlers()
        
    def _register_default_handlers(self) -> None:
        """Register built-in task handlers."""
        self.register_handler("analyze_file", self._handle_analyze_file)
        self.register_handler("analyze_ast", self._handle_analyze_ast)
        self.register_handler("analyze_dependencies", self._handle_analyze_dependencies)
        self.register_handler("detect_patterns", self._handle_detect_patterns)
        self.register_handler("analyze_git", self._handle_analyze_git)
        
    def register_handler(
        self,
        task_type: str,
        handler: Callable[[Dict], Awaitable[Dict]]
    ) -> None:
        """Register a task handler."""
        self._handlers[task_type] = handler
        
    async def process_task(self, task_type: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Process a single task."""
        handler = self._handlers.get(task_type)
        
        if not handler:
            raise ValueError(f"Unknown task type: {task_type}")
            
        return await handler(payload)
        
    async def _handle_analyze_file(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Handle file analysis task."""
        from ..collectors.file_crawler import FileCrawler, FileInfo
        
        file_path = payload.get("file_path")
        if not file_path:
            raise ValueError("file_path required")
            
        crawler = FileCrawler()
        # Process single file
        files = await crawler.collect_all(file_path)
        
        return {
            "files": [f.to_dict() for f in files],
            "count": len(files),
        }
        
    async def _handle_analyze_ast(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Handle AST analysis task."""
        from ..analyzers.ast_analyzer import ASTAnalyzer
        
        file_path = payload.get("file_path")
        content = payload.get("content")
        
        if not file_path:
            raise ValueError("file_path required")
            
        analyzer = ASTAnalyzer()
        result = await analyzer.analyze_file(file_path, content)
        
        return result
        
    async def _handle_analyze_dependencies(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Handle dependency analysis task."""
        from ..analyzers.dependency_mapper import DependencyMapper
        
        ast_results = payload.get("ast_results", [])
        root_path = payload.get("root_path", ".")
        
        mapper = DependencyMapper()
        graph = await mapper.map_dependencies(ast_results, root_path)
        
        return graph.to_dict()
        
    async def _handle_detect_patterns(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Handle pattern detection task."""
        from ..analyzers.pattern_detector import PatternDetector
        
        file_path = payload.get("file_path")
        content = payload.get("content")
        ast_result = payload.get("ast_result")
        
        if not file_path:
            raise ValueError("file_path required")
            
        detector = PatternDetector()
        matches = await detector.detect_patterns(file_path, content, ast_result)
        
        return {
            "patterns": [m.to_dict() for m in matches],
            "count": len(matches),
        }
        
    async def _handle_analyze_git(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Handle git analysis task."""
        from ..collectors.git_collector import GitCollector
        
        repo_path = payload.get("repo_path")
        if not repo_path:
            raise ValueError("repo_path required")
            
        collector = GitCollector()
        
        # Get commits
        commits = await collector.get_all_commits(repo_path)
        
        # Get stats
        stats = await collector.get_stats(commits)
        
        return {
            "commits": [c.to_dict() for c in commits[:100]],  # Limit for response size
            "total_commits": len(commits),
            "stats": stats,
        }
