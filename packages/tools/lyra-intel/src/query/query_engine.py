"""
Query Engine - Natural language queries over codebase.

Supports various query types:
- Find functions/classes by name
- Search by pattern
- Dependency queries
- Git history queries
- Metrics queries
"""

import re
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass, field
from enum import Enum
import logging

logger = logging.getLogger(__name__)


class QueryType(Enum):
    """Types of queries supported."""
    FIND = "find"           # Find specific entities
    SEARCH = "search"       # Text search
    ANALYZE = "analyze"     # Analysis queries
    COMPARE = "compare"     # Comparison queries
    METRICS = "metrics"     # Metrics queries
    HISTORY = "history"     # Git history queries
    DEPS = "dependencies"   # Dependency queries


@dataclass
class QueryResult:
    """Result from a query operation."""
    query: str
    query_type: QueryType
    results: List[Dict[str, Any]]
    total: int
    execution_time_ms: float
    suggestions: List[str] = field(default_factory=list)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "query": self.query,
            "query_type": self.query_type.value,
            "results": self.results,
            "total": self.total,
            "execution_time_ms": self.execution_time_ms,
            "suggestions": self.suggestions,
        }


@dataclass
class QueryConfig:
    """Configuration for query engine."""
    max_results: int = 100
    fuzzy_match: bool = True
    case_sensitive: bool = False
    include_context: bool = True
    context_lines: int = 3


class QueryEngine:
    """
    Natural language query engine for codebase exploration.
    
    Supports queries like:
    - "find all functions named test_*"
    - "show classes that inherit from BaseClass"
    - "what files import pandas"
    - "show me the most complex functions"
    - "who wrote the most code"
    """
    
    # Query patterns for natural language parsing
    QUERY_PATTERNS = [
        # Find patterns
        (r"find\s+(all\s+)?(?P<type>functions?|classes?|methods?|files?)\s+(named\s+)?(?P<pattern>.+)", QueryType.FIND),
        (r"show\s+(me\s+)?(all\s+)?(?P<type>functions?|classes?|methods?|files?)\s+(named\s+)?(?P<pattern>.+)", QueryType.FIND),
        (r"list\s+(all\s+)?(?P<type>functions?|classes?|methods?|files?)", QueryType.FIND),
        
        # Search patterns
        (r"search\s+(for\s+)?(?P<pattern>.+)", QueryType.SEARCH),
        (r"grep\s+(?P<pattern>.+)", QueryType.SEARCH),
        
        # Dependency patterns
        (r"what\s+(files?\s+)?imports?\s+(?P<module>.+)", QueryType.DEPS),
        (r"show\s+dependencies\s+(of\s+)?(?P<file>.+)", QueryType.DEPS),
        (r"who\s+uses\s+(?P<entity>.+)", QueryType.DEPS),
        
        # Analysis patterns
        (r"show\s+(me\s+)?(?P<type>complex|long|large)\s+(?P<entity>functions?|classes?|methods?|files?)", QueryType.ANALYZE),
        (r"(?P<type>most\s+complex|longest|largest)\s+(?P<entity>functions?|classes?|methods?|files?)", QueryType.ANALYZE),
        
        # History patterns
        (r"who\s+wrote\s+(?P<file>.+)", QueryType.HISTORY),
        (r"show\s+history\s+(of\s+)?(?P<file>.+)", QueryType.HISTORY),
        (r"recent\s+changes\s+(to\s+)?(?P<file>.+)?", QueryType.HISTORY),
        
        # Metrics patterns
        (r"how\s+many\s+(?P<type>files?|functions?|classes?|lines?|commits?)", QueryType.METRICS),
        (r"count\s+(?P<type>files?|functions?|classes?|lines?|commits?)", QueryType.METRICS),
        (r"total\s+(?P<type>files?|functions?|classes?|lines?|commits?)", QueryType.METRICS),
    ]
    
    def __init__(self, config: Optional[QueryConfig] = None):
        self.config = config or QueryConfig()
        self._database = None
        self._index = {}
    
    def set_database(self, database):
        """Set the database connection."""
        self._database = database
    
    def build_index(self, analysis_results: Dict[str, Any]):
        """Build search index from analysis results."""
        self._index = {
            "files": {},
            "functions": {},
            "classes": {},
            "imports": {},
        }
        
        # Index files
        for file_info in analysis_results.get("files", []):
            path = file_info.get("relative_path", "")
            self._index["files"][path] = file_info
        
        # Index code units
        for result in analysis_results.get("ast_results", []):
            file_path = result.get("file_path", "")
            for unit in result.get("code_units", []):
                unit_name = unit.get("name", "")
                unit_type = unit.get("type", "")
                
                if "function" in unit_type:
                    self._index["functions"][f"{file_path}::{unit_name}"] = {
                        **unit,
                        "file_path": file_path,
                    }
                elif unit_type == "class":
                    self._index["classes"][f"{file_path}::{unit_name}"] = {
                        **unit,
                        "file_path": file_path,
                    }
            
            # Index imports
            for imp in result.get("imports", []):
                module = imp.get("module", "")
                if module not in self._index["imports"]:
                    self._index["imports"][module] = []
                self._index["imports"][module].append({
                    "file_path": file_path,
                    **imp,
                })
        
        logger.info(f"Index built: {len(self._index['files'])} files, "
                   f"{len(self._index['functions'])} functions, "
                   f"{len(self._index['classes'])} classes")
    
    def query(self, query_string: str) -> QueryResult:
        """
        Execute a natural language query.
        
        Args:
            query_string: Natural language query
            
        Returns:
            QueryResult with matching entities
        """
        import time
        start_time = time.time()
        
        # Parse query
        query_type, parsed = self._parse_query(query_string)
        
        # Execute query
        results = []
        
        if query_type == QueryType.FIND:
            results = self._execute_find(parsed)
        elif query_type == QueryType.SEARCH:
            results = self._execute_search(parsed)
        elif query_type == QueryType.DEPS:
            results = self._execute_deps(parsed)
        elif query_type == QueryType.ANALYZE:
            results = self._execute_analyze(parsed)
        elif query_type == QueryType.HISTORY:
            results = self._execute_history(parsed)
        elif query_type == QueryType.METRICS:
            results = self._execute_metrics(parsed)
        else:
            # Default to search
            results = self._execute_search({"pattern": query_string})
        
        execution_time = (time.time() - start_time) * 1000
        
        # Generate suggestions
        suggestions = self._generate_suggestions(query_string, results)
        
        return QueryResult(
            query=query_string,
            query_type=query_type,
            results=results[:self.config.max_results],
            total=len(results),
            execution_time_ms=execution_time,
            suggestions=suggestions,
        )
    
    def _parse_query(self, query_string: str) -> Tuple[QueryType, Dict[str, Any]]:
        """Parse natural language query."""
        query_lower = query_string.lower().strip()
        
        for pattern, query_type in self.QUERY_PATTERNS:
            match = re.match(pattern, query_lower, re.IGNORECASE)
            if match:
                return query_type, match.groupdict()
        
        # Default to search
        return QueryType.SEARCH, {"pattern": query_string}
    
    def _execute_find(self, parsed: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Execute find query."""
        entity_type = parsed.get("type", "").lower()
        pattern = parsed.get("pattern", ".*")
        
        results = []
        
        # Convert glob pattern to regex
        if "*" in pattern or "?" in pattern:
            pattern = pattern.replace("*", ".*").replace("?", ".")
        
        try:
            regex = re.compile(pattern, re.IGNORECASE if not self.config.case_sensitive else 0)
        except re.error:
            regex = re.compile(re.escape(pattern), re.IGNORECASE)
        
        if "function" in entity_type or "method" in entity_type:
            for key, func in self._index.get("functions", {}).items():
                if regex.search(func.get("name", "")):
                    results.append({
                        "type": "function",
                        "name": func.get("name"),
                        "file_path": func.get("file_path"),
                        "line_start": func.get("line_start"),
                        "line_end": func.get("line_end"),
                        "complexity": func.get("complexity"),
                    })
        
        elif "class" in entity_type:
            for key, cls in self._index.get("classes", {}).items():
                if regex.search(cls.get("name", "")):
                    results.append({
                        "type": "class",
                        "name": cls.get("name"),
                        "file_path": cls.get("file_path"),
                        "line_start": cls.get("line_start"),
                        "line_end": cls.get("line_end"),
                    })
        
        elif "file" in entity_type:
            for path, file_info in self._index.get("files", {}).items():
                if regex.search(path) or regex.search(file_info.get("name", "")):
                    results.append({
                        "type": "file",
                        "path": path,
                        "name": file_info.get("name"),
                        "size_bytes": file_info.get("size_bytes"),
                        "line_count": file_info.get("line_count"),
                    })
        
        return results
    
    def _execute_search(self, parsed: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Execute text search."""
        pattern = parsed.get("pattern", "")
        results = []
        
        try:
            regex = re.compile(pattern, re.IGNORECASE if not self.config.case_sensitive else 0)
        except re.error:
            regex = re.compile(re.escape(pattern), re.IGNORECASE)
        
        # Search in all indices
        for func_key, func in self._index.get("functions", {}).items():
            if regex.search(func.get("name", "")):
                results.append({
                    "type": "function",
                    "match": func.get("name"),
                    "file_path": func.get("file_path"),
                    "line": func.get("line_start"),
                })
        
        for cls_key, cls in self._index.get("classes", {}).items():
            if regex.search(cls.get("name", "")):
                results.append({
                    "type": "class",
                    "match": cls.get("name"),
                    "file_path": cls.get("file_path"),
                    "line": cls.get("line_start"),
                })
        
        for path in self._index.get("files", {}).keys():
            if regex.search(path):
                results.append({
                    "type": "file",
                    "match": path,
                    "file_path": path,
                })
        
        return results
    
    def _execute_deps(self, parsed: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Execute dependency query."""
        module = parsed.get("module", "")
        file = parsed.get("file", "")
        entity = parsed.get("entity", "")
        
        results = []
        
        if module:
            # Find files that import this module
            importers = self._index.get("imports", {}).get(module, [])
            for imp in importers:
                results.append({
                    "type": "import",
                    "module": module,
                    "imported_by": imp.get("file_path"),
                    "line": imp.get("line"),
                })
        
        return results
    
    def _execute_analyze(self, parsed: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Execute analysis query."""
        analysis_type = parsed.get("type", "").lower()
        entity_type = parsed.get("entity", "").lower()
        
        results = []
        
        if "complex" in analysis_type and "function" in entity_type:
            # Find most complex functions
            functions = list(self._index.get("functions", {}).values())
            functions.sort(key=lambda x: x.get("complexity", 0), reverse=True)
            
            for func in functions[:20]:
                results.append({
                    "type": "function",
                    "name": func.get("name"),
                    "file_path": func.get("file_path"),
                    "complexity": func.get("complexity"),
                    "line_start": func.get("line_start"),
                })
        
        elif "long" in analysis_type and "function" in entity_type:
            # Find longest functions
            functions = list(self._index.get("functions", {}).values())
            functions.sort(
                key=lambda x: (x.get("line_end", 0) - x.get("line_start", 0)),
                reverse=True
            )
            
            for func in functions[:20]:
                length = func.get("line_end", 0) - func.get("line_start", 0)
                results.append({
                    "type": "function",
                    "name": func.get("name"),
                    "file_path": func.get("file_path"),
                    "length": length,
                    "line_start": func.get("line_start"),
                })
        
        elif "large" in analysis_type and "file" in entity_type:
            # Find largest files
            files = list(self._index.get("files", {}).items())
            files.sort(key=lambda x: x[1].get("size_bytes", 0), reverse=True)
            
            for path, file_info in files[:20]:
                results.append({
                    "type": "file",
                    "path": path,
                    "size_bytes": file_info.get("size_bytes"),
                    "line_count": file_info.get("line_count"),
                })
        
        return results
    
    def _execute_history(self, parsed: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Execute git history query."""
        # Would query the database for git history
        return []
    
    def _execute_metrics(self, parsed: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Execute metrics query."""
        metric_type = parsed.get("type", "").lower()
        
        if "file" in metric_type:
            return [{"metric": "files", "count": len(self._index.get("files", {}))}]
        
        if "function" in metric_type:
            return [{"metric": "functions", "count": len(self._index.get("functions", {}))}]
        
        if "class" in metric_type:
            return [{"metric": "classes", "count": len(self._index.get("classes", {}))}]
        
        if "line" in metric_type:
            total_lines = sum(
                f.get("line_count", 0) 
                for f in self._index.get("files", {}).values()
            )
            return [{"metric": "lines", "count": total_lines}]
        
        return []
    
    def _generate_suggestions(self, query: str, results: List[Dict]) -> List[str]:
        """Generate query suggestions."""
        suggestions = []
        
        if not results:
            suggestions.append("Try a broader search pattern")
            suggestions.append("Use 'list all functions' to see available functions")
        
        if len(results) > self.config.max_results:
            suggestions.append(f"Results limited to {self.config.max_results}. Be more specific.")
        
        return suggestions
    
    def autocomplete(self, partial: str) -> List[str]:
        """Provide autocomplete suggestions."""
        suggestions = []
        partial_lower = partial.lower()
        
        # Suggest query templates
        templates = [
            "find functions named ",
            "find classes named ",
            "show complex functions",
            "what imports ",
            "who wrote ",
            "how many files",
            "how many functions",
        ]
        
        for template in templates:
            if template.startswith(partial_lower):
                suggestions.append(template)
        
        # Suggest entity names
        if "find" in partial_lower or "show" in partial_lower:
            for func in list(self._index.get("functions", {}).values())[:10]:
                suggestions.append(f"find function {func.get('name')}")
            for cls in list(self._index.get("classes", {}).values())[:10]:
                suggestions.append(f"find class {cls.get('name')}")
        
        return suggestions[:10]
